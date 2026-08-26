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
    const position = nearestPositionName(fielder.x, fielder.y, state.hand);
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
    const name = nearestPositionName(x, y, state.hand);
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
    const spots = positionsFor(state.hand);
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
    const spots = positionsFor(state.hand);
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
          : nearestPositionName(fielder.x, fielder.y, state.hand);
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
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'iconbtn';
        rename.title = 'Rename';
        rename.textContent = '✎';
        rename.addEventListener('click', function () {
          const next = prompt('Player name', player.name);
          if (next && next.trim()) {
            player.name = next.trim().slice(0, 24);
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
      const apply = function () { applyTemplate(template); };
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
      nearestPositionName(fielder.x, fielder.y, state.hand);
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
          nearestPositionName(x, y, state.hand));
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
    const dlg = $('shareDlg');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
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
      const sample = sampleState();
      state.squad = sample.squad;
      state.fielders = [];
      selectedFielderIndex = -1;
      commit();
      toast('Sample XI loaded.');
    });

    $('btnClearSquad').addEventListener('click', function () {
      if (!isAdmin()) return;
      if (!state.squad.length) return;
      if (!confirm('Remove every player from the squad?')) return;
      state.squad = [];
      state.fielders = [];
      selectedPlayerId = null;
      selectedFielderIndex = -1;
      commit();
    });

    $('btnAuto').addEventListener('click', autoArrange);

    $('btnFlip').addEventListener('click', function () {
      if (!canEdit()) return;
      state.fielders.forEach(function (f) { f.x = 2 * FIELD.CX - f.x; });
      commit();
    });

    $('btnRotate').addEventListener('click', function () {
      if (!canEdit()) return;
      state.rot = ((Number(state.rot) || 0) + 90) % 360;
      commit();
      toast(ROTATION_NOTE[state.rot]);
    });

    $('btnClearField').addEventListener('click', function () {
      if (!canEdit() || !state.fielders.length) return;
      state.fielders = [];
      selectedFielderIndex = -1;
      commit();
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

  function start() {
    bindEvents();
    renderTemplates();
    if (!loadFromHash()) {
      const saved = loadCurrent();
      state = saved || sampleState();
      mode = MODES.ADMIN;
      if (!saved) applyTemplateSilently(TEMPLATES[1]);
    }
    syncInputs();
    render();
    persist();
  }

  function applyTemplateSilently(template) {
    const spots = positionsFor(state.hand);
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
  }

  document.addEventListener('DOMContentLoaded', start);
})();
