/* Wiring: squad, field, sharing, export. */

(function () {
  const MAX_ON_FIELD = 11;
  const ROTATION_NOTE = {
    0: 'Bowling from the top of the ground.',
    90: "Turned a quarter — bowler's end on the right.",
    180: "Turned half way — looking from the batter's end.",
    270: "Turned a quarter — bowler's end on the left.",
  };

  const AUTO_ORDER = ['keeper', 'bowlerend', 'slip1', 'point', 'cover', 'midoff',
    'midon', 'midwicket', 'squareleg', 'fineleg', 'thirdman', 'deepmidwicket',
    'deepcover', 'longoff', 'longon', 'gully', 'backwardpoint', 'extracover'];

  let state = defaultState();
  let mode = MODES.ADMIN;
  let selectedPlayerId = null;
  let selectedFielderIndex = -1;
  let showGuides = false;
  let suppressHash = false;
  let themeChoice = 'auto';   // 'auto' follows the device, or 'light' / 'dark'

  const $ = function (id) { return document.getElementById(id); };

  function canEdit() { return mode !== MODES.VIEW; }
  function isAdmin() { return mode === MODES.ADMIN; }

  /* ------------------------------------------------------------- utilities */

  function showReadout(text) {
    const node = $('dragReadout');
    node.textContent = text;
    node.hidden = !text;
  }

  function announcePosition(fielder) {
    if (!fielder) return;
    const player = playerById(fielder.pid);
    const who = player ? player.name : 'Fielder';
    const position = nameAt(state, fielder.x, fielder.y);
    if (position === 'Wicketkeeper') toast(who + ' is keeping wicket.');
    else if (position === 'Bowler') toast(who + " is at the bowler's end.");
    else toast(who + ' is at ' + position.toLowerCase() + '.');
  }

  let toastTimer = null;
  function toast(message) {
    const node = $('toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2200);
  }

  function playerById(id) {
    return state.squad.find(function (p) { return p.id === id; });
  }

  function fielderIndexOf(playerId) {
    return state.fielders.findIndex(function (f) { return f.pid === playerId; });
  }

  function renumberSquad() {
    state.squad.forEach(function (p, i) { p.num = i + 1; });
  }

  /* ---------------------------------------------------------------- theming */

  const THEME_KEY = 'cf.theme';
  // Words, not symbols: a glyph that a device lacks a font for reads as junk.
  const THEME_LABEL = { auto: 'Theme: Auto', light: 'Theme: Light', dark: 'Theme: Dark' };

  function prefersLight() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }

  function resolvedTheme() {
    if (themeChoice === 'light' || themeChoice === 'dark') return themeChoice;
    return prefersLight() ? 'light' : 'dark';
  }

  function applyTheme(redraw) {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    setFieldTheme(theme);
    const btn = $('btnTheme');
    btn.textContent = THEME_LABEL[themeChoice];
    btn.title = themeChoice === 'auto'
      ? 'Following your device (' + theme + '). Click for light.'
      : 'Theme: ' + themeChoice + '. Click to change.';
    if (redraw) renderBoard();
  }

  function startTheme() {
    const stored = safeGet(THEME_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') themeChoice = stored;
    applyTheme(false);
    if (window.matchMedia) {
      const query = window.matchMedia('(prefers-color-scheme: light)');
      const onChange = function () { if (themeChoice === 'auto') applyTheme(true); };
      if (query.addEventListener) query.addEventListener('change', onChange);
      else if (query.addListener) query.addListener(onChange);
    }
  }

  /* ------------------------------------------------------------ persistence */

  function persist() {
    // Only the admin's own board is kept in this browser; opening someone
    // else's link must not overwrite it.
    if (isAdmin()) saveCurrent(state);
    if (!canEdit()) return;
    suppressHash = true;
    const link = '#d=' + encodeState(state, mode);
    history.replaceState(null, '', link);
    setTimeout(function () { suppressHash = false; }, 0);
  }

  function commit() {
    persist();
    render();
  }

  /* ---------------------------------------------------------------- placing */

  function nextUnplacedPlayer() {
    return state.squad.find(function (p) { return fielderIndexOf(p.id) === -1; });
  }

  function roleForSpot(x, y) {
    const name = nameAt(state, x, y);
    const hasKeeper = state.fielders.some(function (f) { return f.role === 'k'; });
    const hasBowler = state.fielders.some(function (f) { return f.role === 'b'; });
    if (name === 'Wicketkeeper' && !hasKeeper) return 'k';
    if (name === 'Bowler' && !hasBowler) return 'b';
    return 'f';
  }

  function placeAt(x, y) {
    if (!canEdit()) return;

    if (selectedPlayerId) {
      const existing = fielderIndexOf(selectedPlayerId);
      if (existing >= 0) {
        state.fielders[existing].x = x;
        state.fielders[existing].y = y;
      } else {
        if (state.fielders.length >= MAX_ON_FIELD) {
          toast('Eleven players are already on the field.');
          return;
        }
        state.fielders.push({ pid: selectedPlayerId, x: x, y: y, role: roleForSpot(x, y) });
      }
      selectedFielderIndex = fielderIndexOf(selectedPlayerId);
      selectedPlayerId = null;
      commit();
      announcePosition(state.fielders[selectedFielderIndex]);
      return;
    }

    const next = nextUnplacedPlayer();
    if (!next) {
      if (!state.squad.length) {
        toast(isAdmin() ? 'Add players to the squad first.' : 'The squad is empty.');
      } else {
        toast('Everyone is already on the field. Tap a fielder to move them.');
      }
      return;
    }
    if (state.fielders.length >= MAX_ON_FIELD) {
      toast('Eleven players are already on the field.');
      return;
    }
    state.fielders.push({ pid: next.id, x: x, y: y, role: roleForSpot(x, y) });
    selectedFielderIndex = state.fielders.length - 1;
    commit();
    announcePosition(state.fielders[selectedFielderIndex]);
  }

  function freeSpotFor(index) {
    const spots = positionsFor(state.hand, state.end);
    const taken = state.fielders.map(function (f) { return { x: f.x, y: f.y }; });
    const order = AUTO_ORDER.concat(spots.map(function (s) { return s.id; }));
    for (let i = 0; i < order.length; i++) {
      const spot = spots.find(function (s) { return s.id === order[i]; });
      if (!spot) continue;
      const busy = taken.some(function (t) { return Math.hypot(t.x - spot.x, t.y - spot.y) < 34; });
      if (!busy) return spot;
    }
    return spots[(index || 0) % spots.length];
  }

  function togglePlayerOnField(playerId) {
    if (!canEdit()) return;
    const idx = fielderIndexOf(playerId);
    if (idx >= 0) {
      state.fielders.splice(idx, 1);
      if (selectedFielderIndex === idx) selectedFielderIndex = -1;
      commit();
      return;
    }
    if (state.fielders.length >= MAX_ON_FIELD) {
      toast('Eleven players are already on the field.');
      return;
    }
    const spot = freeSpotFor(state.fielders.length);
    state.fielders.push({ pid: playerId, x: spot.x, y: spot.y, role: roleForSpot(spot.x, spot.y) });
    selectedFielderIndex = state.fielders.length - 1;
    commit();
    announcePosition(state.fielders[selectedFielderIndex]);
  }

  function setRole(index, role) {
    const fielder = state.fielders[index];
    if (!fielder) return;
    if (role === 'k' || role === 'b') {
      state.fielders.forEach(function (f) { if (f.role === role) f.role = 'f'; });
    }
    fielder.role = role;
    commit();
  }

  function applyTemplate(template) {
    if (!canEdit()) return;
    if (!state.squad.length) {
      toast(isAdmin() ? 'Add players to the squad first.' : 'The squad is empty.');
      return;
    }
    const spots = positionsFor(state.hand, state.end);
    const players = state.squad.slice(0, MAX_ON_FIELD);
    state.fielders = [];
    template.positions.slice(0, players.length).forEach(function (posId, i) {
      const spot = spots.find(function (s) { return s.id === posId; });
      if (!spot) return;
      state.fielders.push({
        pid: players[i].id,
        x: spot.x,
        y: spot.y,
        role: posId === 'keeper' ? 'k' : posId === 'bowlerend' ? 'b' : 'f',
      });
    });
    selectedFielderIndex = -1;
    selectedPlayerId = null;
    commit();
    toast(template.name + ' applied.');
  }

  function autoArrange() {
    if (!canEdit()) return;
    const unplaced = state.squad.filter(function (p) { return fielderIndexOf(p.id) === -1; });
    if (!unplaced.length) {
      toast(state.squad.length ? 'Everyone is already on the field.' : 'Add players to the squad first.');
      return;
    }
    unplaced.forEach(function (p) {
      if (state.fielders.length >= MAX_ON_FIELD) return;
      const spot = freeSpotFor(state.fielders.length);
      state.fielders.push({
        pid: p.id,
        x: spot.x,
        y: spot.y,
        role: spot.id === 'keeper' ? 'k' : spot.id === 'bowlerend' ? 'b' : 'f',
      });
    });
    commit();
  }


  /* ---------------------------------------------------------------- records */

  let pendingRecord = null;
  let importTarget = null;     // the squad player an import was opened for
  let pasteTimer = null;

  /* One styled confirmation for everything that overwrites or throws work
     away, so the browser's own dialog never appears. */
  let confirmSettle = null;

  function askConfirm(options) {
    return new Promise(function (resolve) {
      const dlg = $('confirmDlg');
      $('confirmTitle').textContent = options.title;
      $('confirmBody').textContent = options.body;
      const ok = $('btnConfirmOk');
      ok.textContent = options.confirm || 'Do it';
      ok.className = 'btn ' + (options.danger ? 'danger' : 'primary');
      confirmSettle = function (answer) {
        confirmSettle = null;
        closeDialog(dlg);
        resolve(answer);
      };
      showDialog(dlg);
      ok.focus();
    });
  }

  function showDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  function fig(label, value) {
    return '<div class="fig"><b>' + value + '</b><span>' + label + '</span></div>';
  }

  /* 136.83 balls-over-six is 136 overs and 5 balls, which is written 136.5. */
  function oversText(overs) {
    if (overs == null || !isFinite(overs)) return '—';
    const balls = Math.round(overs * 6);
    return Math.floor(balls / 6) + '.' + (balls % 6);
  }

  function round(n, places) {
    if (n == null || !isFinite(n)) return '—';
    const p = Math.pow(10, places == null ? 1 : places);
    return String(Math.round(n * p) / p);
  }

  function renderRecords() {
    const known = state.squad.filter(function (p) { return statsFor(p.name); }).length;
    $('recordsCount').textContent = state.squad.length
      ? known + ' of ' + state.squad.length
      : 'no squad yet';
  }

  function openImport(player) {
    pendingRecord = null;
    importTarget = player || null;
    $('statsPaste').value = '';
    $('statsMsg').textContent = '';
    $('statsPreview').hidden = true;
    $('scoutRead').hidden = true;

    const banner = $('importFor');
    if (importTarget) {
      banner.textContent = 'Importing for ' + importTarget.name;
      banner.hidden = false;
      $('attachHint').textContent = 'The record will be saved to ' + importTarget.name + '.';
      // Hide the picker, never the row: the Save button lives in it.
      $('statsAttach').hidden = true;
      $('btnSaveStats').textContent = 'Save to ' + importTarget.name;
    } else {
      banner.hidden = true;
      $('attachHint').textContent = 'Attach the record to a squad player.';
      $('statsAttach').hidden = false;
      $('btnSaveStats').textContent = 'Save';
    }

    showDialog($('statsDlg'));
    $('statsPaste').focus();
  }

  /* Pick the squad player whose name is closest to the record's. */
  function bestMatch(name) {
    const key = statsKey(name);
    let best = null;
    state.squad.forEach(function (p) {
      const k = statsKey(p.name);
      if (!k || !key) return;
      const score = k === key ? 3
        : key.indexOf(k) > -1 || k.indexOf(key) > -1 ? 2
        : k.slice(0, 4) === key.slice(0, 4) ? 1 : 0;
      if (score && (!best || score > best.score)) best = { player: p, score: score };
    });
    return best ? best.player : null;
  }

  function showPreview(record) {
    const d = deriveStats(record);
    $('previewName').textContent = record.name || 'Unnamed player';
    const bits = [];
    if (record.role) bits.push(record.role);
    if (record.battingStyle) bits.push(record.battingStyle);
    if (record.bowlingStyle) bits.push(record.bowlingStyle);
    if (record.leagues.length) bits.push(record.leagues.length + ' leagues');
    $('previewLine').textContent = bits.join(' · ');

    $('previewFigures').innerHTML = [
      fig('matches', record.mat),
      fig('runs', record.runs),
      fig('strike rate', round(d.strikeRate)),
      fig('wickets', record.wkts),
      fig('catches', record.catches),
    ].join('');

    if (importTarget) {
      $('btnSaveStats').disabled = false;
      $('statsPreview').hidden = false;
      return;
    }

    const select = $('statsAttach');
    select.innerHTML = '';
    if (!state.squad.length) {
      select.innerHTML = '<option value="">add players to the squad first</option>';
      $('btnSaveStats').disabled = true;
    } else {
      $('btnSaveStats').disabled = false;
      const match = bestMatch(record.name);
      state.squad.forEach(function (p) {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (match && match.id === p.id) option.selected = true;
        select.appendChild(option);
      });
    }
    $('statsPreview').hidden = false;
  }

  function readPaste(quiet) {
    const result = readPastedRecord($('statsPaste').value);
    if (result.error) {
      $('statsMsg').textContent = quiet ? '' : result.error;
      $('statsPreview').hidden = true;
      return;
    }
    pendingRecord = result.record;
    $('statsMsg').textContent = 'Read from ' + result.via + '.';
    showPreview(pendingRecord);
  }

  function saveRecordToPlayer() {
    if (!pendingRecord) return;
    const player = importTarget || playerById($('statsAttach').value);
    if (!player) return;
    saveStatsFor(player.name, pendingRecord);
    toast(pendingRecord.name + "'s record saved to " + player.name + '.');
    closeDialog($('statsDlg'));
    render();
  }

  function scoutBatter() {
    if (!pendingRecord) return;
    const read = readBatter(pendingRecord);
    const box = $('scoutRead');
    const hand = /left/i.test(pendingRecord.battingStyle || '') ? 'l' : 'r';
    box.innerHTML = '<h3>' + (pendingRecord.name || 'This batter') + ' — ' + read.shape + '</h3>' +
      '<ul>' + read.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul>' +
      '<p class="hint">' + read.unknown + '</p>';

    const apply = document.createElement('button');
    apply.className = 'btn small';
    apply.type = 'button';
    apply.textContent = 'Set this field';
    apply.addEventListener('click', function () {
      const template = TEMPLATES.find(function (t) { return t.id === templateForRead(read); });
      state.hand = hand;
      syncInputs();
      if (template) applyTemplate(template);
      else commit();
      closeDialog($('statsDlg'));
    });
    box.appendChild(apply);
    box.hidden = false;
  }

  function openPlayerCard(player) {
    const record = statsFor(player.name);
    if (!record) return;
    const d = deriveStats(record);
    const rows = record.leagues.filter(function (L) { return L.mat; }).map(function (L) {
      return '<tr><td>' + L.league + '</td><td>' + L.mat + '</td><td>' + L.runs +
        '</td><td>' + L.wkts + '</td><td>' + L.catches + '</td></tr>';
    }).join('');

    $('cardBody').innerHTML =
      '<h2>' + player.name + '</h2>' +
      '<p class="hint">' + [record.role, record.battingStyle, record.bowlingStyle]
        .filter(Boolean).join(' · ') + '</p>' +
      '<div class="figures">' +
        fig('matches', record.mat) +
        fig('runs', record.runs) +
        fig('average', round(d.battingAvg, 2)) +
        fig('strike rate', round(d.strikeRate)) +
        fig('wickets', record.wkts) +
        fig('economy', round(d.economy, 2)) +
        fig('catches', record.catches) +
        fig('catches a match', round(d.catchesPerMatch, 2)) +
      '</div>' +
      (rows ? '<div class="tablewrap"><table><thead><tr><th>League</th><th>Mat</th>' +
        '<th>Runs</th><th>Wkts</th><th>Ct</th></tr></thead><tbody>' + rows +
        '</tbody></table></div>' : '') +
      '<p class="hint">From ' + (record.url || 'a pasted page') + ', read ' + record.updated +
      '. Kept on this device only.</p>';

    const remove = document.createElement('button');
    remove.className = 'btn small ghost danger';
    remove.type = 'button';
    remove.textContent = 'Forget this record';
    remove.addEventListener('click', function () {
      forgetStatsFor(player.name);
      closeDialog($('cardDlg'));
      render();
    });
    $('cardBody').appendChild(remove);
    showDialog($('cardDlg'));
  }

  function line(label, entry, detail) {
    if (!entry) return '';
    return '<li><span class="who">' + entry.player.name + '</span>' +
      '<span class="what">' + label + '</span>' +
      '<span class="why">' + detail + '</span></li>';
  }

  function showSuggestions() {
    const s = suggestRoles(state.squad);
    const box = $('suggestions');
    if (!s.keeper && !s.death && !s.strike) {
      box.innerHTML = '<p class="hint">No records yet — import a player first.</p>';
      box.hidden = false;
      return;
    }

    const catchers = s.catchers.map(function (e) {
      return line('close catcher', e, round(e.derived.catchesPerMatch, 2) + ' catches a match, ' +
        e.record.catches + ' in ' + e.record.mat);
    }).join('');

    box.innerHTML = '<ul class="suggest">' +
      line('wicketkeeper', s.keeper, s.keeper ? round(s.keeper.derived.catchesPerMatch, 2) +
        ' catches a match, ' + s.keeper.record.catches + ' in ' + s.keeper.record.mat : '') +
      catchers +
      line('death overs', s.death, s.death ? 'economy ' + round(s.death.derived.economy, 2) +
        ' over ' + oversText(s.death.derived.overs) + ' overs' : '') +
      line('strike bowler', s.strike, s.strike && s.strike.derived.bowlingSR
        ? 'a wicket every ' + round(s.strike.derived.bowlingSR) + ' balls' : '') +
      '</ul>' +
      '<p class="hint">Catches count where a player has fielded, not how good their hands are, and ' +
      'nothing here knows who is quick or who has an arm.' +
      (s.missing ? ' No record for ' + s.missing + ' of the squad.' : '') + '</p>';

    const apply = document.createElement('button');
    apply.className = 'btn small';
    apply.type = 'button';
    apply.textContent = 'Put the catchers in';
    apply.addEventListener('click', function () { applyCatchers(s); });
    box.appendChild(apply);
    box.hidden = false;
  }

  /* Places the keeper and the next best pair of hands, and leaves the rest of
     the field alone — the records do not support any more than that. */
  function applyCatchers(s) {
    if (!canEdit() || !s.keeper) return;
    const spots = positionsFor(state.hand, state.end);
    const put = function (playerId, spotId, role) {
      const spot = spots.find(function (x) { return x.id === spotId; });
      if (!spot) return;
      const at = fielderIndexOf(playerId);
      if (at >= 0) {
        state.fielders[at].x = spot.x;
        state.fielders[at].y = spot.y;
        state.fielders[at].role = role;
      } else if (state.fielders.length < MAX_ON_FIELD) {
        state.fielders.push({ pid: playerId, x: spot.x, y: spot.y, role: role });
      }
    };
    state.fielders.forEach(function (f) { if (f.role === 'k') f.role = 'f'; });
    put(s.keeper.player.id, 'keeper', 'k');
    ['slip1', 'slip2', 'gully'].forEach(function (spotId, i) {
      if (s.catchers[i]) put(s.catchers[i].player.id, spotId, 'f');
    });
    selectedFielderIndex = -1;
    commit();
    toast('Keeper and catchers placed.');
  }

  /* ------------------------------------------------------------------ teams */

  const TEAMS_STORE = 'cf.teams';

  function listTeams() {
    try {
      const raw = safeGet(TEAMS_STORE);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function writeTeams(teams) {
    safeSet(TEAMS_STORE, JSON.stringify(teams.slice(0, 30)));
  }

  function saveTeam(name) {
    const teams = listTeams().filter(function (t) { return t.name !== name; });
    teams.unshift({
      name: name,
      at: Date.now(),
      players: state.squad.map(function (p) { return p.name; }),
    });
    writeTeams(teams);
  }

  function renderTeams() {
    const list = $('teamList');
    if (!list) return;
    list.innerHTML = '';
    const teams = listTeams();
    if (!teams.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Save the squad here and you can bring it back any time.';
      list.appendChild(li);
      return;
    }
    teams.forEach(function (team) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'sname';
      name.textContent = team.name;
      li.appendChild(name);

      const count = document.createElement('span');
      count.className = 'ptag';
      count.textContent = team.players.length + ' players';
      li.appendChild(count);

      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn small ghost';
      restore.textContent = 'Restore';
      restore.addEventListener('click', function () {
        askConfirm({
          title: 'Restore ' + team.name + '?',
          body: 'The squad becomes those ' + team.players.length + ' players and the field is cleared. '
            + 'Career records stay where they are and reattach by name.',
          confirm: 'Restore',
        }).then(function (yes) {
          if (!yes) return;
          state.squad = team.players.map(function (n, i) {
            return { id: uid(), name: n, num: i + 1 };
          });
          state.fielders = [];
          selectedPlayerId = null;
          selectedFielderIndex = -1;
          commit();
          toast(team.name + ' restored.');
        });
      });
      li.appendChild(restore);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'iconbtn';
      del.title = 'Delete this team';
      del.textContent = '✕';
      del.addEventListener('click', function () {
        askConfirm({
          title: 'Delete ' + team.name + '?',
          body: 'The saved team is removed from this device. Nothing else changes.',
          confirm: 'Delete',
          danger: true,
        }).then(function (yes) {
          if (!yes) return;
          writeTeams(listTeams().filter(function (t) { return t.name !== team.name; }));
          renderTeams();
        });
      });
      li.appendChild(del);

      list.appendChild(li);
    });
  }

  /* --------------------------------------------------------------- rendering */

  function syncInputs() {
    $('inpTitle').value = state.title;
    $('inpOpp').value = state.bowlingTo;
    $('inpNotes').value = state.notes;
    document.querySelectorAll('.seg[data-hand]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.hand === state.hand));
      btn.disabled = !canEdit();
    });
    ['inpTitle', 'inpOpp', 'inpNotes'].forEach(function (id) {
      $(id).disabled = !canEdit();
    });
  }

  function renderMode() {
    document.body.classList.remove('mode-admin', 'mode-edit', 'mode-view');
    document.body.classList.add('mode-' + mode);
    const badge = $('modeBadge');
    badge.className = 'badge ' + (mode === MODES.ADMIN ? '' : mode);
    badge.textContent = mode === MODES.ADMIN ? 'Admin' : mode === MODES.EDIT ? 'Can edit' : 'View only';

    const hint = $('viewHint');
    if (mode === MODES.VIEW) {
      hint.hidden = false;
      hint.innerHTML = 'You are viewing a shared setup, so nothing here can be changed. ' +
        'You can still save it as an image. ';
      const fork = document.createElement('button');
      fork.className = 'btn small';
      fork.type = 'button';
      fork.textContent = 'Make my own copy';
      fork.addEventListener('click', function () {
        mode = MODES.ADMIN;
        state.title = state.title + ' (copy)';
        selectedFielderIndex = -1;
        persist();
        syncInputs();
        render();
        toast('This copy is yours to edit.');
      });
      hint.appendChild(fork);
    } else if (mode === MODES.EDIT) {
      hint.hidden = false;
      hint.textContent = 'You can move fielders and change the plan. The squad list is set by the owner.';
    } else {
      hint.hidden = true;
    }

    $('btnAuto').disabled = !canEdit();
    $('btnFlip').disabled = !canEdit();
    $('btnRotate').disabled = !canEdit();
    $('btnSwitchEnds').disabled = !canEdit();
    $('btnClearField').disabled = !canEdit();
    $('squadHint').textContent = canEdit()
      ? 'Tap a player, then tap the ground to place them. Drag any fielder to move.'
      : 'Squad and positions are read-only in this link.';
  }

  function renderSquad() {
    const list = $('squadList');
    list.innerHTML = '';
    $('squadCount').textContent = state.squad.length
      ? state.fielders.length + ' of ' + state.squad.length + ' on field'
      : 'empty';

    if (!state.squad.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = isAdmin()
        ? 'No players yet. Add them above, or load a sample XI.'
        : 'The owner has not added any players.';
      list.appendChild(li);
      return;
    }

    state.squad.forEach(function (player) {
      const idx = fielderIndexOf(player.id);
      const fielder = idx >= 0 ? state.fielders[idx] : null;
      const li = document.createElement('li');
      li.dataset.id = player.id;
      if (selectedPlayerId === player.id) li.classList.add('selected');
      if (fielder) li.classList.add('placed');

      const num = document.createElement('span');
      num.className = 'pnum' + (fielder && fielder.role !== 'f' ? ' ' + fielder.role : '');
      num.textContent = player.num;
      li.appendChild(num);

      const name = document.createElement('button');
      name.type = 'button';
      name.className = 'pname';
      name.textContent = player.name;
      name.addEventListener('click', function () {
        if (!canEdit()) return;
        selectedPlayerId = selectedPlayerId === player.id ? null : player.id;
        const onField = fielderIndexOf(player.id);
        selectedFielderIndex = onField;
        render();
        if (selectedPlayerId) {
          toast(onField >= 0
            ? 'Tap the ground to move ' + player.name + '.'
            : 'Tap the ground to place ' + player.name + '.');
        }
      });
      li.appendChild(name);

      if (fielder) {
        const tag = document.createElement('span');
        tag.className = 'ptag';
        tag.textContent = fielder.role === 'k' ? 'WK' : fielder.role === 'b' ? 'Bowl'
          : nameAt(state, fielder.x, fielder.y);
        li.appendChild(tag);
      }

      if (canEdit()) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'iconbtn';
        toggle.title = fielder ? 'Take off the field' : 'Place on the field';
        toggle.textContent = fielder ? '−' : '+';
        toggle.addEventListener('click', function () { togglePlayerOnField(player.id); });
        li.appendChild(toggle);
      }

      if (isAdmin()) {
        const held = statsFor(player.name);
        const rec = document.createElement('button');
        rec.type = 'button';
        rec.className = 'iconbtn rec' + (held ? ' has' : '');
        rec.title = held ? player.name + "'s career record" : 'Import ' + player.name + "'s record";
        rec.textContent = held ? 'i' : '↓';
        rec.addEventListener('click', function () {
          if (held) openPlayerCard(player); else openImport(player);
        });
        li.appendChild(rec);
      }

      if (isAdmin()) {
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'iconbtn';
        rename.title = 'Rename';
        rename.textContent = '✎';
        rename.addEventListener('click', function () {
          const next = prompt('Player name', player.name);
          if (next && next.trim()) {
            const was = player.name;
            const record = statsFor(was);
            player.name = next.trim().slice(0, 24);
            if (record) {
              forgetStatsFor(was);
              saveStatsFor(player.name, record);
            }
            commit();
          }
        });
        li.appendChild(rename);

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'iconbtn';
        del.title = 'Remove from squad';
        del.textContent = '✕';
        del.addEventListener('click', function () {
          state.squad = state.squad.filter(function (p) { return p.id !== player.id; });
          state.fielders = state.fielders.filter(function (f) { return f.pid !== player.id; });
          if (selectedPlayerId === player.id) selectedPlayerId = null;
          selectedFielderIndex = -1;
          renumberSquad();
          commit();
        });
        li.appendChild(del);
      }

      list.appendChild(li);
    });
  }

  function renderTemplates() {
    const list = $('templateList');
    list.innerHTML = '';
    TEMPLATES.forEach(function (template) {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.innerHTML = '<span class="tname"></span><span class="tnote"></span>';
      li.querySelector('.tname').textContent = template.name;
      li.querySelector('.tnote').textContent = template.note;
      const apply = function () {
        if (!state.fielders.length) { applyTemplate(template); return; }
        askConfirm({
          title: 'Set the ' + template.name.toLowerCase() + '?',
          body: 'All ' + state.fielders.length + ' fielders move to that field. What you have set out now is lost.',
          confirm: 'Set the field',
        }).then(function (yes) { if (yes) applyTemplate(template); });
      };
      li.addEventListener('click', apply);
      li.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); apply(); }
      });
      list.appendChild(li);
    });
  }

  function renderSaved() {
    const list = $('savedList');
    list.innerHTML = '';
    const saved = listSaved();
    if (!saved.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Nothing saved yet. Saved setups stay in this browser only.';
      list.appendChild(li);
      return;
    }
    saved.forEach(function (entry) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'sname';
      name.textContent = entry.name;
      li.appendChild(name);

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn small ghost';
      open.textContent = 'Open';
      open.addEventListener('click', function () {
        const loaded = loadNamed(entry.name);
        if (!loaded) return;
        state = loaded;
        mode = MODES.ADMIN;
        selectedPlayerId = null;
        selectedFielderIndex = -1;
        persist();
        syncInputs();
        render();
        toast('Opened "' + entry.name + '".');
      });
      li.appendChild(open);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'iconbtn';
      del.title = 'Delete';
      del.textContent = '✕';
      del.addEventListener('click', function () {
        deleteNamed(entry.name);
        renderSaved();
      });
      li.appendChild(del);

      list.appendChild(li);
    });
  }

  function renderStats() {
    const bar = $('statsBar');
    bar.innerHTML = '';
    const stats = computeStats(state);
    const add = function (label, value, warn) {
      const node = document.createElement('div');
      node.className = 'stat' + (warn ? ' warn' : '');
      node.innerHTML = '<b></b> <span></span>';
      node.querySelector('b').textContent = value;
      node.querySelector('span').textContent = label;
      bar.appendChild(node);
    };
    add('on the field', stats.onField + ' / 11', stats.onField > 11);
    add('inside the circle', stats.inside);
    add('outside the circle', stats.outside);
    add('leg side', stats.leg, stats.leg > 5);
    add('off side', stats.off);
    if (stats.leg > 5) {
      const warn = document.createElement('div');
      warn.className = 'stat warn';
      warn.textContent = 'More than five fielders on the leg side is a no-ball in limited-overs cricket.';
      bar.appendChild(warn);
    }
  }

  function renderSelBar() {
    const bar = $('selBar');
    const fielder = state.fielders[selectedFielderIndex];
    if (!canEdit() || !fielder) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const player = playerById(fielder.pid);
    $('selName').textContent = (player ? player.name : 'Fielder') + ' — ' +
      nameAt(state, fielder.x, fielder.y);
    bar.querySelectorAll('[data-role]').forEach(function (btn) {
      btn.classList.toggle('primary', btn.dataset.role === fielder.role);
    });
  }

  function renderBoard() {
    renderField($('fieldWrap'), state, {
      canEdit: canEdit(),
      showGuides: showGuides,
      selectedIndex: selectedFielderIndex,
      onDrag: function (index, x, y) {
        const fielder = state.fielders[index];
        const player = fielder ? playerById(fielder.pid) : null;
        showReadout((player ? player.name : 'Fielder') + ' → ' +
          nameAt(state, x, y));
      },
      onMove: function (index, x, y) {
        const fielder = state.fielders[index];
        if (!fielder) return;
        fielder.x = x;
        fielder.y = y;
        selectedFielderIndex = index;
        showReadout('');
        commit();
        announcePosition(fielder);
      },
      onSelect: function (index) {
        selectedFielderIndex = index;
        selectedPlayerId = null;
        renderSquad();
        renderSelBar();
        const chips = $('fieldWrap').querySelectorAll('g.chip');
        chips.forEach(function (chip) {
          chip.classList.toggle('selected', Number(chip.dataset.index) === index);
        });
      },
      onPlace: function (x, y) { placeAt(x, y); },
    });
  }

  function render() {
    renderMode();
    renderSquad();
    renderRecords();
    renderTeams();
    renderSaved();
    renderBoard();
    renderStats();
    renderSelBar();
  }

  /* ----------------------------------------------------------------- sharing */

  function openShare() {
    $('linkView').value = buildLink(state, MODES.VIEW);
    $('linkEdit').value = buildLink(state, MODES.EDIT);
    $('linkAdmin').value = buildLink(state, MODES.ADMIN);
    showDialog($('shareDlg'));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  /* -------------------------------------------------------------------- init */

  function loadFromHash() {
    const parsed = readHash();
    if (!parsed) return false;
    state = parsed.state;
    mode = parsed.mode;
    selectedPlayerId = null;
    selectedFielderIndex = -1;
    return true;
  }

  function bindEvents() {
    $('inpTitle').addEventListener('input', function (e) {
      state.title = e.target.value;
      persist();
      renderBoard();
    });
    $('inpOpp').addEventListener('input', function (e) {
      state.bowlingTo = e.target.value;
      persist();
      renderBoard();
    });
    $('inpNotes').addEventListener('input', function (e) {
      state.notes = e.target.value;
      persist();
      renderBoard();
    });

    document.querySelectorAll('.seg[data-hand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!canEdit()) return;
        state.hand = btn.dataset.hand;
        syncInputs();
        commit();
      });
    });

    $('btnAddPlayer').addEventListener('click', addPlayerFromInput);
    $('inpNewPlayer').addEventListener('keydown', function (evt) {
      if (evt.key === 'Enter') addPlayerFromInput();
    });

    $('btnSampleSquad').addEventListener('click', function () {
      if (!isAdmin()) return;
      const replacing = state.squad.length;
      const ask = replacing
        ? askConfirm({
            title: 'Replace the squad with the sample XI?',
            body: 'Your ' + replacing + ' players go, and the field is cleared. Save the team first '
              + 'if you want them back.',
            confirm: 'Replace',
            danger: true,
          })
        : Promise.resolve(true);
      ask.then(function (yes) {
        if (!yes) return;
        const sample = sampleState();
        state.squad = sample.squad;
        state.fielders = [];
        selectedPlayerId = null;
        selectedFielderIndex = -1;
        commit();
        toast('Sample XI loaded.');
      });
    });

    $('btnClearSquad').addEventListener('click', function () {
      if (!isAdmin() || !state.squad.length) return;
      askConfirm({
        title: 'Clear the squad?',
        body: 'All ' + state.squad.length + ' players go and the field empties. Career records stay '
          + 'on this device. Save the team first if you want it back.',
        confirm: 'Clear the squad',
        danger: true,
      }).then(function (yes) {
        if (!yes) return;
        state.squad = [];
        state.fielders = [];
        selectedPlayerId = null;
        selectedFielderIndex = -1;
        commit();
      });
    });

    $('btnAuto').addEventListener('click', function () {
      if (!canEdit()) return;
      const waiting = state.squad.filter(function (p) { return fielderIndexOf(p.id) === -1; }).length;
      if (!waiting) { autoArrange(); return; }
      askConfirm({
        title: 'Arrange the rest of the squad?',
        body: 'The ' + waiting + (waiting === 1 ? ' player who is' : ' players who are')
          + ' not on the field will be placed at standard positions. Anyone already out there stays put.',
        confirm: 'Arrange',
      }).then(function (yes) { if (yes) autoArrange(); });
    });

    $('btnFlip').addEventListener('click', function () {
      if (!canEdit()) return;
      state.fielders.forEach(function (f) { f.x = 2 * FIELD.CX - f.x; });
      commit();
    });

    $('btnSwitchEnds').addEventListener('click', function () {
      if (!canEdit()) return;
      state.end = !state.end;
      commit();
      toast(state.end
        ? 'Batting from the far end — off and leg have swapped.'
        : 'Batting from the near end again.');
    });

    $('btnRotate').addEventListener('click', function () {
      if (!canEdit()) return;
      state.rot = ((Number(state.rot) || 0) + 90) % 360;
      commit();
      toast(ROTATION_NOTE[state.rot]);
    });

    $('btnClearField').addEventListener('click', function () {
      if (!canEdit() || !state.fielders.length) return;
      askConfirm({
        title: 'Take everyone off the field?',
        body: 'All ' + state.fielders.length + ' fielders come off. The squad is untouched.',
        confirm: 'Clear the field',
        danger: true,
      }).then(function (yes) {
        if (!yes) return;
        state.fielders = [];
        selectedFielderIndex = -1;
        commit();
      });
    });

    $('chkGuides').addEventListener('change', function (e) {
      showGuides = e.target.checked;
      renderBoard();
    });

    $('selBar').querySelectorAll('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () { setRole(selectedFielderIndex, btn.dataset.role); });
    });

    $('btnRemoveFielder').addEventListener('click', function () {
      if (selectedFielderIndex < 0) return;
      state.fielders.splice(selectedFielderIndex, 1);
      selectedFielderIndex = -1;
      commit();
    });

    $('btnSaveLocal').addEventListener('click', function () {
      const input = $('inpSaveName');
      const name = (input.value || state.title || 'Fielding setup').trim();
      if (!name) return;
      saveNamed(name, state);
      input.value = '';
      renderSaved();
      toast('Saved "' + name + '" to this browser.');
    });

    $('btnTheme').addEventListener('click', function () {
      const order = ['auto', 'light', 'dark'];
      themeChoice = order[(order.indexOf(themeChoice) + 1) % order.length];
      safeSet(THEME_KEY, themeChoice);
      applyTheme(true);
    });

    $('btnConfirmOk').addEventListener('click', function () { if (confirmSettle) confirmSettle(true); });
    $('btnConfirmNo').addEventListener('click', function () { if (confirmSettle) confirmSettle(false); });
    $('confirmDlg').addEventListener('close', function () { if (confirmSettle) confirmSettle(false); });
    $('confirmDlg').addEventListener('cancel', function () { if (confirmSettle) confirmSettle(false); });

    $('btnSaveTeam').addEventListener('click', function () {
      if (!isAdmin()) return;
      const input = $('inpTeamName');
      const name = (input.value || '').trim();
      if (!name) { toast('Give the team a name first.'); input.focus(); return; }
      if (!state.squad.length) { toast('There is no squad to save.'); return; }
      const exists = listTeams().some(function (t) { return t.name === name; });
      const ask = exists
        ? askConfirm({
            title: 'Overwrite ' + name + '?',
            body: 'A saved team already has that name. It will be replaced by the current squad of '
              + state.squad.length + '.',
            confirm: 'Overwrite',
          })
        : Promise.resolve(true);
      ask.then(function (yes) {
        if (!yes) return;
        saveTeam(name);
        input.value = '';
        renderTeams();
        toast(name + ' saved — ' + state.squad.length + ' players.');
      });
    });

    $('statsPaste').addEventListener('input', function () {
      if (pasteTimer) clearTimeout(pasteTimer);
      pasteTimer = setTimeout(function () { readPaste(true); }, 250);
    });

    $('btnImportStats').addEventListener('click', function () { openImport(null); });
    $('btnReadStats').addEventListener('click', readPaste);
    $('btnSaveStats').addEventListener('click', saveRecordToPlayer);
    $('btnScout').addEventListener('click', scoutBatter);
    $('btnSuggest').addEventListener('click', showSuggestions);
    $('btnCloseStats').addEventListener('click', function () { closeDialog($('statsDlg')); });
    $('btnCloseCard').addEventListener('click', function () { closeDialog($('cardDlg')); });

    $('btnShare').addEventListener('click', openShare);

    $('shareDlg').addEventListener('click', function (evt) {
      const target = evt.target.closest('[data-copy]');
      if (!target) return;
      const input = $(target.dataset.copy);
      copyText(input.value).then(function () {
        toast('Link copied.');
      }).catch(function () {
        input.select();
        toast('Press Ctrl/Cmd + C to copy.');
      });
    });

    $('btnExport').addEventListener('click', function () {
      const svg = document.getElementById('fieldSvg');
      if (!svg) return;
      downloadPng(svg, state.title).then(function () {
        toast('Image saved.');
      }).catch(function (err) {
        toast(err.message);
      });
    });

    $('btnCopyImage').addEventListener('click', function () {
      const svg = document.getElementById('fieldSvg');
      if (!svg) return;
      copyPngToClipboard(svg).then(function () {
        toast('Image copied to the clipboard.');
      }).catch(function () {
        toast('This browser cannot copy images — use "Save as image".');
      });
    });

    window.addEventListener('hashchange', function () {
      if (suppressHash) return;
      if (loadFromHash()) {
        syncInputs();
        render();
      }
    });
  }

  function addPlayerFromInput() {
    if (!isAdmin()) return;
    const input = $('inpNewPlayer');
    const name = input.value.trim();
    if (!name) return;
    state.squad.push({ id: uid(), name: name.slice(0, 24), num: state.squad.length + 1 });
    input.value = '';
    input.focus();
    renumberSquad();
    commit();
  }

  /* The plain address always opens on an empty ground: whoever follows it must
     never be shown a team they have nothing to do with. A board kept in this
     browser is offered, never restored on its own, and nothing is written back
     to storage until the visitor changes something. */
  function offerLastBoard() {
    const saved = loadCurrent();
    if (!saved || (!saved.squad.length && !saved.fielders.length)) return;
    const bar = $('resumeBar');
    const what = saved.squad.length
      ? '"' + (saved.title || 'Fielding setup') + '" with ' + saved.squad.length + ' players'
      : '"' + (saved.title || 'Fielding setup') + '"';
    $('resumeText').textContent = 'You last worked on ' + what + ' in this browser.';
    bar.hidden = false;

    $('btnResume').onclick = function () {
      state = saved;
      mode = MODES.ADMIN;
      selectedPlayerId = null;
      selectedFielderIndex = -1;
      bar.hidden = true;
      persist();
      syncInputs();
      render();
    };
    $('btnDismissResume').onclick = function () { bar.hidden = true; };
  }

  function start() {
    bindEvents();
    startTheme();
    renderTemplates();
    if (!loadFromHash()) {
      state = defaultState();
      mode = MODES.ADMIN;
      offerLastBoard();
    }
    syncInputs();
    render();
  }

  document.addEventListener('DOMContentLoaded', start);
})();
