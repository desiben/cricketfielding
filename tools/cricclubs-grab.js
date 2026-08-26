/* Cricket Fielding Board — CricClubs grab.

   This is the source of the bookmarklet. It runs inside a CricClubs player
   profile, which is why it can read the page at all: same site, ordinary
   access. Nothing is sent anywhere — it puts the player's record on your
   clipboard and you paste it into the board.

   Every league tab is already present in the page, so one click takes the whole
   record rather than the league on screen. */

(function () {
  function txt(el) { return ((el && el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function num(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  // Overs are not decimals: 19.5 means nineteen overs and five balls.
  function balls(v) { var p = String(v).split('.'); return num(p[0]) * 6 + num(p[1] || 0); }

  function grab() {
    var player = {
      name: txt(document.querySelector('h1')) || document.title.split('-')[0].trim(),
      url: location.href,
      grabbed: new Date().toISOString().slice(0, 10),
    };

    var keys = /^(CC Player ID|Current Team|Teams|Playing Role|Batting Style|Bowling Style)\s*:\s*(.+)$/;
    Array.prototype.forEach.call(document.querySelectorAll('div,p,li,span'), function (el) {
      if (el.children.length > 1) return;
      var m = txt(el).match(keys);
      if (m && !player[m[1]]) player[m[1]] = m[2];
    });

    var leagues = Array.prototype.map.call(
      document.querySelectorAll('li.resp-tab-item.hor_1'), txt);

    // A stats table announces itself in its own header row.
    var tables = [];
    Array.prototype.forEach.call(document.querySelectorAll('table'), function (tb) {
      var rows = Array.prototype.map.call(tb.rows, function (r) {
        return Array.prototype.map.call(r.cells, txt);
      });
      if (rows.length < 2 || rows[0].length < 8) return;
      var head = rows[0];
      var kind = head.indexOf('HS') > -1 ? 'bat' : head.indexOf('Catches') > -1 ? 'bowl' : null;
      if (!kind) return;
      function at(n) { return head.indexOf(n); }
      var data = rows.slice(1).filter(function (r) {
        return r.length === head.length && r[0] && !/View statistics|Loading/i.test(r[0]);
      });
      tables.push({
        kind: kind,
        rows: data.map(function (r) {
          return kind === 'bat' ? {
            format: r[0], mat: num(r[at('Mat')]), inns: num(r[at('Inns')]), no: num(r[at('NO')]),
            runs: num(r[at('Runs')]), balls: num(r[at('Balls')]), hs: num(r[at('HS')]),
            hundreds: num(r[at("100's")]), fifties: num(r[at("50's")]),
            ducks: num(r[at("0's")]), fours: num(r[at("4's")]), sixes: num(r[at("6's")]),
          } : {
            format: r[0], mat: num(r[at('Mat')]), inns: num(r[at('Inns')]),
            ballsBowled: balls(r[at('Overs')]), conceded: num(r[at('Runs')]),
            wkts: num(r[at('Wkts')]), best: r[at('BBF')], maidens: num(r[at('Mdns')]),
            wides: num(r[at('Wides')]), catches: num(r[at('Catches')]),
          };
        }),
      });
    });

    // They come in pairs, batting then bowling, one pair per league tab.
    player.leagues = [];
    for (var i = 0; i + 1 < tables.length; i += 2) {
      player.leagues.push({
        league: leagues[i / 2] || 'League ' + (i / 2 + 1),
        batting: tables[i].rows,
        bowling: tables[i + 1].rows,
      });
    }

    // How this player has got out — only for the league currently on screen.
    player.dismissals = {};
    Array.prototype.forEach.call(document.querySelectorAll('table'), function (tb) {
      if (Object.keys(player.dismissals).length) return;
      var rows = Array.prototype.map.call(tb.rows, function (r) {
        return Array.prototype.map.call(r.cells, txt);
      });
      if (!rows.length || rows[0][0] !== 'Out type') return;
      rows.slice(1).forEach(function (r) { player.dismissals[r[0]] = num(r[1]); });
    });

    return player;
  }

  var player = grab();
  var count = (player.leagues || []).length;

  if (!count) {
    alert('No stats tables found here.\n\nOpen a player profile page and try again.');
    return;
  }

  var json = JSON.stringify(player);
  var message = 'Copied ' + player.name + ' — ' + count +
    (count === 1 ? ' league' : ' leagues') + '.\n\nNow paste it into the fielding board.';

  function byHand() {
    var box = document.createElement('textarea');
    box.value = json;
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    try { document.execCommand('copy'); } catch (err) { /* nothing else to try */ }
    box.remove();
    alert(message);
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(function () { alert(message); }, byHand);
  } else {
    byHand();
  }
})();
