/* Player records: reading them in, working them out, and what they support.

   Records are kept on this device only, keyed by the player's name, so they
   survive reloads and are never carried in a shared link. */

const STATS_STORE = 'cf.stats';

function statsKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z]/g, '');
}

function loadStats() {
  try {
    const raw = safeGet(STATS_STORE);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveStatsFor(name, record) {
  const all = loadStats();
  all[statsKey(name)] = record;
  safeSet(STATS_STORE, JSON.stringify(all));
}

function forgetStatsFor(name) {
  const all = loadStats();
  delete all[statsKey(name)];
  safeSet(STATS_STORE, JSON.stringify(all));
}

function statsFor(name) {
  return loadStats()[statsKey(name)] || null;
}

/* ------------------------------------------------------------------ totals */

function emptyRecord() {
  return {
    name: '', url: '', updated: '', role: '', battingStyle: '', bowlingStyle: '', team: '',
    mat: 0, inns: 0, no: 0, runs: 0, balls: 0, fours: 0, sixes: 0, hs: 0,
    hundreds: 0, fifties: 0, ducks: 0,
    bowlInns: 0, ballsBowled: 0, conceded: 0, wkts: 0, catches: 0,
    dismissals: {}, leagues: [],
  };
}

const BAT_FIELDS = ['mat', 'inns', 'no', 'runs', 'balls', 'fours', 'sixes',
  'hundreds', 'fifties', 'ducks'];
const BOWL_FIELDS = ['bowlInns', 'ballsBowled', 'conceded', 'wkts', 'catches'];

function addLeagueToRecord(record, league) {
  (league.batting || []).forEach(function (b) {
    BAT_FIELDS.forEach(function (f) { record[f] += Number(b[f]) || 0; });
    record.hs = Math.max(record.hs, Number(b.hs) || 0);
  });
  (league.bowling || []).forEach(function (w) {
    record.bowlInns += Number(w.inns) || 0;
    record.ballsBowled += Number(w.ballsBowled) || 0;
    record.conceded += Number(w.conceded) || 0;
    record.wkts += Number(w.wkts) || 0;
    record.catches += Number(w.catches) || 0;
  });
}

/* Everything the record supports, computed once. Anything that needs a
   denominator we do not have comes back null rather than zero, so the
   interface can leave it blank instead of claiming a figure. */
function deriveStats(r) {
  if (!r) return null;
  const outs = r.inns - r.no;
  const boundaries = r.fours + r.sixes;
  const boundaryRuns = r.fours * 4 + r.sixes * 6;
  const overs = r.ballsBowled / 6;
  // Neither a not out nor a retirement is a dismissal, which is why the site's
  // own average divides by innings less both.
  const dismissed = Object.keys(r.dismissals || {}).reduce(function (sum, k) {
    return /not out|retired/i.test(k) ? sum : sum + (Number(r.dismissals[k]) || 0);
  }, 0);
  const caught = Object.keys(r.dismissals || {}).reduce(function (sum, k) {
    return /caught|catch/i.test(k) ? sum + (Number(r.dismissals[k]) || 0) : sum;
  }, 0);

  return {
    battingAvg: outs > 0 ? r.runs / outs : null,
    strikeRate: r.balls > 0 ? (r.runs / r.balls) * 100 : null,
    ballsPerInnings: r.inns > 0 ? r.balls / r.inns : null,
    boundaryRuns: boundaryRuns,
    boundaryShare: r.runs > 0 ? boundaryRuns / r.runs : null,
    ballsPerBoundary: boundaries > 0 ? r.balls / boundaries : null,
    betweenBoundarySR: r.balls > boundaries
      ? ((r.runs - boundaryRuns) / (r.balls - boundaries)) * 100 : null,
    catchesPerMatch: r.mat > 0 ? r.catches / r.mat : null,
    economy: overs > 0 ? r.conceded / overs : null,
    bowlingAvg: r.wkts > 0 ? r.conceded / r.wkts : null,
    bowlingSR: r.wkts > 0 ? r.ballsBowled / r.wkts : null,
    overs: overs,
    caughtShare: dismissed > 0 ? caught / dismissed : null,
    dismissalsCounted: dismissed,
  };
}

/* --------------------------------------------------------------- importing */

/* What the bookmarklet puts on the clipboard. */
function recordFromGrab(grab) {
  const r = emptyRecord();
  r.name = grab.name || '';
  r.url = grab.url || '';
  r.updated = grab.grabbed || new Date().toISOString().slice(0, 10);
  r.role = grab['Playing Role'] || '';
  r.battingStyle = grab['Batting Style'] || '';
  r.bowlingStyle = grab['Bowling Style'] || '';
  r.team = grab['Current Team'] || '';
  r.dismissals = grab.dismissals || {};
  (grab.leagues || []).forEach(function (league) {
    addLeagueToRecord(r, league);
    r.leagues.push({
      league: league.league,
      mat: (league.batting || []).reduce(function (s, b) { return s + (Number(b.mat) || 0); }, 0),
      runs: (league.batting || []).reduce(function (s, b) { return s + (Number(b.runs) || 0); }, 0),
      wkts: (league.bowling || []).reduce(function (s, w) { return s + (Number(w.wkts) || 0); }, 0),
      catches: (league.bowling || []).reduce(function (s, w) { return s + (Number(w.catches) || 0); }, 0),
    });
  });
  return r;
}

/* A plain-text paste: the profile page selected and copied. Rows are found by
   their own header, so it does not matter what else came along with them. */
function recordFromText(text) {
  const r = emptyRecord();
  const lines = String(text).split(/\r?\n/).map(function (l) { return l.trim(); });

  const nameLine = lines.find(function (l) {
    return /^[A-Z][a-z]+( [A-Z][a-z'.-]+)+( Verified)?$/.test(l);
  });
  if (nameLine) r.name = nameLine.replace(/\s*Verified$/, '').trim();

  lines.forEach(function (l) {
    const m = l.match(/^(Playing Role|Batting Style|Bowling Style|Current Team)\s*:\s*(.+)$/);
    if (!m) return;
    if (m[1] === 'Playing Role') r.role = m[2];
    if (m[1] === 'Batting Style') r.battingStyle = m[2];
    if (m[1] === 'Bowling Style') r.bowlingStyle = m[2];
    if (m[1] === 'Current Team') r.team = m[2];
  });

  const cells = function (line) {
    return line.split(/\t|\s{2,}/).map(function (c) { return c.trim(); }).filter(function (c) { return c !== ''; });
  };
  const num = function (v) { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const ballsOf = function (v) { const p = String(v).split('.'); return num(p[0]) * 6 + num(p[1] || 0); };

  let header = null;
  let kind = null;
  lines.forEach(function (line) {
    const c = cells(line);
    if (c.indexOf('Mat') > -1 && c.indexOf('HS') > -1) { header = c; kind = 'bat'; return; }
    if (c.indexOf('Wkts') > -1 && c.indexOf('Catches') > -1) { header = c; kind = 'bowl'; return; }
    if (!header || c.length !== header.length) return;
    if (!/^[A-Za-z]/.test(c[0])) return;             // the row starts with a format name
    const at = function (n) { return header.indexOf(n); };
    if (kind === 'bat') {
      r.mat += num(c[at('Mat')]); r.inns += num(c[at('Inns')]); r.no += num(c[at('NO')]);
      r.runs += num(c[at('Runs')]); r.balls += num(c[at('Balls')]);
      r.fours += num(c[at("4's")]); r.sixes += num(c[at("6's")]);
      r.hundreds += num(c[at("100's")]); r.fifties += num(c[at("50's")]);
      r.ducks += num(c[at("0's")]);
      r.hs = Math.max(r.hs, num(c[at('HS')]));
    } else {
      r.bowlInns += num(c[at('Inns')]); r.ballsBowled += ballsOf(c[at('Overs')]);
      r.conceded += num(c[at('Runs')]); r.wkts += num(c[at('Wkts')]);
      r.catches += num(c[at('Catches')]);
    }
  });

  // "Out type / Count" pairs, however they were laid out.
  let outSection = false;
  lines.forEach(function (line) {
    if (/^Out type/i.test(line)) { outSection = true; return; }
    if (!outSection) return;
    const m = line.match(/^([A-Za-z][A-Za-z ]{2,20}?)\s+(\d+)$/);
    if (m) r.dismissals[m[1].trim()] = num(m[2]);
  });

  r.updated = new Date().toISOString().slice(0, 10);
  return r;
}

/* Accepts either form and says which it understood. */
function readPastedRecord(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { error: 'Nothing pasted.' };
  if (trimmed[0] === '{') {
    try {
      const grab = JSON.parse(trimmed);
      const record = recordFromGrab(grab);
      if (!record.mat && !record.runs) return { error: 'That looks like a grab, but it carried no figures.' };
      return { record: record, via: 'the bookmarklet' };
    } catch (err) {
      return { error: 'That started like a grab but the text is incomplete — copy it again.' };
    }
  }
  const record = recordFromText(trimmed);
  if (!record.mat && !record.runs) {
    return { error: 'No stats tables found in that text. Copy the whole profile page, or use the bookmarklet.' };
  }
  return { record: record, via: 'the pasted page' };
}

/* ------------------------------------------------------------ what it says */

/* Ranked suggestions for who does what, each carrying the figure it rests on
   and how big the sample is. Never a bare ordering. */
function suggestRoles(squad) {
  const withStats = squad.map(function (p) {
    const record = statsFor(p.name);
    return { player: p, record: record, derived: deriveStats(record) };
  }).filter(function (e) { return e.record; });

  const out = { keeper: null, catchers: [], death: null, strike: null, missing: squad.length - withStats.length };
  if (!withStats.length) return out;

  const byCatching = withStats.filter(function (e) { return e.record.mat >= 5 && e.derived.catchesPerMatch != null; })
    .sort(function (a, b) { return b.derived.catchesPerMatch - a.derived.catchesPerMatch; });

  if (byCatching.length) {
    out.keeper = byCatching[0];
    out.catchers = byCatching.slice(1, 4);
  }

  const bowlers = withStats.filter(function (e) { return e.record.ballsBowled >= 120; });
  const byEconomy = bowlers.slice().sort(function (a, b) { return a.derived.economy - b.derived.economy; });
  const byStrike = bowlers.filter(function (e) { return e.derived.bowlingSR != null; })
    .sort(function (a, b) { return a.derived.bowlingSR - b.derived.bowlingSR; });

  out.death = byEconomy[0] || null;
  out.strike = byStrike[0] || null;
  return out;
}

/* How to bowl at a batter, from what the record can actually support. */
function readBatter(record) {
  const d = deriveStats(record);
  if (!d) return null;
  const notes = [];
  let shape = 'balanced';

  if (d.boundaryShare != null && d.boundaryShare >= 0.55) {
    shape = 'protect the rope';
    notes.push(Math.round(d.boundaryShare * 100) + '% of his runs come in boundaries — go back early.');
  } else if (d.boundaryShare != null && d.boundaryShare <= 0.4) {
    shape = 'squeeze the ring';
    notes.push('Only ' + Math.round(d.boundaryShare * 100) + '% of his runs are boundaries — he works it around, so save the single.');
  }

  if (d.betweenBoundarySR != null && d.betweenBoundarySR < 90 && shape === 'protect the rope') {
    notes.push('Between boundaries he scores at ' + Math.round(d.betweenBoundarySR) + ' — the ring is cheap to leave thin.');
  }

  if (d.ballsPerBoundary != null && d.ballsPerBoundary < 6) {
    notes.push('A boundary every ' + d.ballsPerBoundary.toFixed(1) + ' balls, so the field has to be right from his first over.');
  }

  if (d.caughtShare != null && d.dismissalsCounted >= 10) {
    notes.push(Math.round(d.caughtShare * 100) + '% of his dismissals are catches (' +
      d.dismissalsCounted + ' counted) — catchers earn their place.');
  }

  if (record.battingStyle) {
    notes.push('Listed as ' + record.battingStyle + '.');
  }

  return { shape: shape, notes: notes, derived: d, unknown: 'Nothing here says which side he scores — no CricClubs page carries that.' };
}

/* Which ready-made field the read points at. */
function templateForRead(read) {
  if (!read) return null;
  if (read.shape === 'protect the rope') return 'death';
  if (read.shape === 'squeeze the ring') return 'pp1';
  return 'middle';
}
