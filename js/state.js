/* Setup model, link encoding/decoding and local storage.

   There is no server: the whole setup travels inside the link fragment, so a
   link can be shared with anyone and works from any static host. */

const MODES = { ADMIN: 'admin', EDIT: 'edit', VIEW: 'view' };
const STORE_CURRENT = 'cf.current';
const STORE_SAVED = 'cf.saved';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultState() {
  return {
    title: 'Fielding setup',
    hand: 'r',
    flip: false,   // true = the ground is viewed from the batter's end
    bowlingTo: '',
    notes: '',
    squad: [],
    fielders: [], // { pid, x, y, role: 'f' | 'k' | 'b' }
  };
}

function sampleState() {
  const s = defaultState();
  s.title = 'Saturday XI';
  const names = ['R. Sharma', 'V. Kohli', 'S. Gill', 'K. Rahul', 'H. Pandya',
    'R. Jadeja', 'A. Patel', 'J. Bumrah', 'M. Shami', 'K. Yadav', 'M. Siraj'];
  s.squad = names.map(function (n, i) {
    return { id: uid(), name: n, num: i + 1 };
  });
  return s;
}

/* ---------------------------------------------------------------- encoding */

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

const ROLE_CODE = { f: 0, k: 1, b: 2 };
const CODE_ROLE = ['f', 'k', 'b'];

/* Compact payload: short keys, integer coordinates, fielders reference the
   squad by index so player names are never repeated. */
function encodeState(state, mode) {
  const index = {};
  state.squad.forEach(function (p, i) { index[p.id] = i; });
  const payload = {
    v: 1,
    m: mode === MODES.ADMIN ? 'a' : mode === MODES.EDIT ? 'e' : 'v',
    t: state.title || '',
    h: state.hand || 'r',
    p: state.flip ? 1 : 0,
    o: state.bowlingTo || '',
    n: state.notes || '',
    s: state.squad.map(function (p) { return p.name; }),
    f: state.fielders.map(function (f) {
      return [
        index[f.pid] == null ? -1 : index[f.pid],
        Math.round(f.x),
        Math.round(f.y),
        ROLE_CODE[f.role] || 0,
      ];
    }),
  };
  return toBase64Url(JSON.stringify(payload));
}

function decodeState(encoded) {
  const raw = JSON.parse(fromBase64Url(encoded));
  const state = defaultState();
  state.title = raw.t || 'Fielding setup';
  state.hand = raw.h === 'l' ? 'l' : 'r';
  state.flip = raw.p === 1;
  state.bowlingTo = raw.o || '';
  state.notes = raw.n || '';
  state.squad = (raw.s || []).map(function (name, i) {
    return { id: uid(), name: String(name), num: i + 1 };
  });
  state.fielders = (raw.f || []).map(function (f) {
    const idx = f[0];
    const player = idx >= 0 ? state.squad[idx] : null;
    return {
      pid: player ? player.id : null,
      x: Number(f[1]),
      y: Number(f[2]),
      role: CODE_ROLE[f[3]] || 'f',
    };
  }).filter(function (f) {
    return isFinite(f.x) && isFinite(f.y);
  });
  const mode = raw.m === 'a' ? MODES.ADMIN : raw.m === 'e' ? MODES.EDIT : MODES.VIEW;
  return { state: state, mode: mode };
}

function buildLink(state, mode) {
  const base = location.origin + location.pathname;
  return base + '#d=' + encodeState(state, mode);
}

function readHash() {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const d = params.get('d');
  if (!d) return null;
  try {
    return decodeState(d);
  } catch (err) {
    console.warn('Could not read the setup from this link:', err);
    return null;
  }
}

/* ----------------------------------------------------------------- storage */

function safeGet(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}

function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (err) { /* private mode */ }
}

function saveCurrent(state) {
  safeSet(STORE_CURRENT, encodeState(state, MODES.ADMIN));
}

function loadCurrent() {
  const raw = safeGet(STORE_CURRENT);
  if (!raw) return null;
  try { return decodeState(raw).state; } catch (err) { return null; }
}

function listSaved() {
  try {
    const raw = safeGet(STORE_SAVED);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveNamed(name, state) {
  const all = listSaved().filter(function (s) { return s.name !== name; });
  all.unshift({ name: name, at: Date.now(), data: encodeState(state, MODES.ADMIN) });
  safeSet(STORE_SAVED, JSON.stringify(all.slice(0, 30)));
}

function deleteNamed(name) {
  safeSet(STORE_SAVED, JSON.stringify(listSaved().filter(function (s) {
    return s.name !== name;
  })));
}

function loadNamed(name) {
  const entry = listSaved().find(function (s) { return s.name === name; });
  if (!entry) return null;
  try { return decodeState(entry.data).state; } catch (err) { return null; }
}
