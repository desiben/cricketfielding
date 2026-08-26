/* Draws the ground as a self-contained SVG and handles dragging.

   Everything is drawn with presentation attributes (no external CSS) so the
   same node can be serialised straight into a PNG. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, text) {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
  }
  if (text != null) node.textContent = text;
  return node;
}

const FONT = 'ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const COLORS = {
  bg: '#0b1a13',
  grass: '#2f7d4f',
  grassAlt: '#338755',
  ring: '#ffffff',
  pitch: '#cdb98a',
  pitchEdge: '#b8a274',
  fielder: '#f8fafc',
  keeper: '#f59e0b',
  bowler: '#ef4444',
  chipText: '#0b1a13',
  label: '#ffffff',
  labelHalo: '#0b3b26',
  muted: '#9fd3b6',
};

/* Fielder coordinates are always stored with the batter at the bottom of the
   ground. When the setup is flipped, the whole ground is turned end for end for
   drawing only: a half-turn about the centre, which is its own inverse, so the
   same function converts a pointer position back into stored coordinates.
   Labels keep their upright offsets, so only anchor points move. */
function viewPoint(state, x, y) {
  if (!state.flip) return { x: x, y: y };
  return { x: 2 * FIELD.CX - x, y: 2 * FIELD.CY - y };
}

function initials(name) {
  const parts = String(name || '').trim().split(/[\s.]+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function labelText(x, y, str, size, weight, anchor, fill) {
  return svgEl('text', {
    x: x,
    y: y,
    'font-family': FONT,
    'font-size': size,
    'font-weight': weight || '600',
    'text-anchor': anchor || 'middle',
    fill: fill || COLORS.label,
  }, str);
}

function haloLabel(x, y, str, size, weight) {
  const t = labelText(x, y, str, size, weight);
  t.setAttribute('stroke', COLORS.labelHalo);
  t.setAttribute('stroke-width', '3.5');
  t.setAttribute('stroke-linejoin', 'round');
  t.setAttribute('paint-order', 'stroke');
  return t;
}

function drawGround(svg, state) {
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'groundClip' });
  clip.appendChild(svgEl('circle', { cx: FIELD.CX, cy: FIELD.CY, r: FIELD.R }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: FIELD.W, height: FIELD.H, fill: COLORS.bg }));

  // Outfield with mown stripes.
  svg.appendChild(svgEl('circle', { cx: FIELD.CX, cy: FIELD.CY, r: FIELD.R, fill: COLORS.grass }));
  const stripes = svgEl('g', { 'clip-path': 'url(#groundClip)', opacity: '0.55' });
  const stripeW = FIELD.R / 5;
  for (let x = FIELD.CX - FIELD.R; x < FIELD.CX + FIELD.R; x += stripeW * 2) {
    stripes.appendChild(svgEl('rect', {
      x: x, y: FIELD.CY - FIELD.R, width: stripeW, height: FIELD.R * 2, fill: COLORS.grassAlt,
    }));
  }
  svg.appendChild(stripes);

  // Boundary rope.
  svg.appendChild(svgEl('circle', {
    cx: FIELD.CX, cy: FIELD.CY, r: FIELD.R,
    fill: 'none', stroke: COLORS.ring, 'stroke-width': 5, opacity: '0.9',
  }));

  // 30-yard circle: semicircles around each set of stumps joined by straights.
  const r30 = FIELD.R30;
  const d = 'M ' + (FIELD.CX - r30) + ' ' + FIELD.BOWLER_Y +
    ' A ' + r30 + ' ' + r30 + ' 0 0 1 ' + (FIELD.CX + r30) + ' ' + FIELD.BOWLER_Y +
    ' L ' + (FIELD.CX + r30) + ' ' + FIELD.STRIKER_Y +
    ' A ' + r30 + ' ' + r30 + ' 0 0 1 ' + (FIELD.CX - r30) + ' ' + FIELD.STRIKER_Y + ' Z';
  svg.appendChild(svgEl('path', {
    d: d, fill: 'none', stroke: COLORS.ring, 'stroke-width': 3,
    'stroke-dasharray': '12 10', opacity: '0.85',
  }));

  // Square and pitch.
  svg.appendChild(svgEl('rect', {
    x: FIELD.CX - 62, y: FIELD.BOWLER_Y - 40, width: 124,
    height: (FIELD.STRIKER_Y - FIELD.BOWLER_Y) + 80,
    fill: '#4f8f63', opacity: '0.75', rx: 4,
  }));
  svg.appendChild(svgEl('rect', {
    x: FIELD.CX - 18, y: FIELD.BOWLER_Y - 22, width: 36,
    height: (FIELD.STRIKER_Y - FIELD.BOWLER_Y) + 44,
    fill: COLORS.pitch, stroke: COLORS.pitchEdge, 'stroke-width': 1.5, rx: 2,
  }));

  [FIELD.BOWLER_Y, FIELD.STRIKER_Y].forEach(function (y) {
    // Popping crease.
    const cy = y === FIELD.STRIKER_Y ? y - 12 : y + 12;
    svg.appendChild(svgEl('line', {
      x1: FIELD.CX - 17, y1: cy, x2: FIELD.CX + 17, y2: cy,
      stroke: '#ffffff', 'stroke-width': 1.6, opacity: '0.9',
    }));
    // Stumps.
    for (let i = -1; i <= 1; i++) {
      svg.appendChild(svgEl('line', {
        x1: FIELD.CX + i * 5, y1: y - 5, x2: FIELD.CX + i * 5, y2: y + 5,
        stroke: '#f8fafc', 'stroke-width': 2.4, 'stroke-linecap': 'round',
      }));
    }
  });

  // Batters. The striker's stance shows which hand is on strike. Turning the
  // ground end for end swaps the ends and puts the off side on the other hand.
  const striker = viewPoint(state, FIELD.STRIKER_X, FIELD.STRIKER_Y);
  const bowlerEnd = viewPoint(state, FIELD.BOWLER_X, FIELD.BOWLER_Y);
  const down = state.flip ? -1 : 1;
  const offLeft = (state.hand === 'r') !== !!state.flip;
  const strikerX = striker.x + (offLeft ? 16 : -16);
  svg.appendChild(svgEl('circle', {
    cx: strikerX, cy: striker.y - 4 * down, r: 9,
    fill: '#111827', stroke: '#ffffff', 'stroke-width': 2,
  }));
  svg.appendChild(svgEl('line', {
    x1: strikerX + (offLeft ? 8 : -8), y1: striker.y + 2 * down,
    x2: strikerX + (offLeft ? 18 : -18), y2: striker.y + 16 * down,
    stroke: '#f8fafc', 'stroke-width': 3, 'stroke-linecap': 'round',
  }));
  svg.appendChild(haloLabel(strikerX + (offLeft ? 34 : -34), striker.y + 6 * down,
    state.hand === 'r' ? 'RHB' : 'LHB', 15, '700'));

  svg.appendChild(svgEl('circle', {
    cx: bowlerEnd.x - 16, cy: bowlerEnd.y + 6 * down, r: 8,
    fill: '#111827', stroke: '#ffffff', 'stroke-width': 2, opacity: '0.85',
  }));

  // Off / leg side hints.
  const offX = offLeft ? FIELD.CX - FIELD.R + 60 : FIELD.CX + FIELD.R - 60;
  const legX = offLeft ? FIELD.CX + FIELD.R - 60 : FIELD.CX - FIELD.R + 60;
  svg.appendChild(labelText(offX, FIELD.CY + 6, 'OFF SIDE', 16, '700', 'middle', 'rgba(255,255,255,0.45)'));
  svg.appendChild(labelText(legX, FIELD.CY + 6, 'LEG SIDE', 16, '700', 'middle', 'rgba(255,255,255,0.45)'));
}

function drawHeader(svg, state, stats) {
  svg.appendChild(labelText(40, 46, state.title || 'Fielding setup', 30, '800', 'start'));
  const sub = [];
  if (state.bowlingTo) sub.push(state.bowlingTo);
  sub.push(state.hand === 'r' ? 'Right-hand batter' : 'Left-hand batter');
  sub.push(stats.onField + ' fielders');
  if (state.flip) sub.push("from the batter's end");
  svg.appendChild(labelText(40, 74, sub.join('  ·  '), 17, '500', 'start', COLORS.muted));
  svg.appendChild(labelText(FIELD.W - 40, 46, 'Cricket Fielding Board', 17, '700', 'end', COLORS.muted));
}

function drawFooter(svg, state, stats) {
  const y = FIELD.H - 42;
  const items = [
    ['Fielder', COLORS.fielder],
    ['Keeper', COLORS.keeper],
    ['Bowler', COLORS.bowler],
  ];
  let x = 40;
  items.forEach(function (item) {
    svg.appendChild(svgEl('circle', { cx: x + 8, cy: y - 5, r: 8, fill: item[1], stroke: '#0b1a13', 'stroke-width': 1.5 }));
    svg.appendChild(labelText(x + 24, y, item[0], 16, '600', 'start', COLORS.muted));
    x += 34 + item[0].length * 9;
  });

  const summary = 'Inside circle ' + stats.inside + '  ·  Outside ' + stats.outside +
    '  ·  Leg side ' + stats.leg + '  ·  Off side ' + stats.off;
  svg.appendChild(labelText(FIELD.W - 40, y, summary, 16, '600', 'end', COLORS.muted));

  if (state.notes) {
    svg.appendChild(labelText(40, FIELD.H - 14, state.notes.slice(0, 110), 15, '500', 'start', 'rgba(255,255,255,0.45)'));
  }
}

function drawGuides(svg, state) {
  const g = svgEl('g', { 'data-noexport': '1' });
  positionsFor(state.hand).forEach(function (p) {
    const taken = state.fielders.some(function (f) {
      return Math.hypot(f.x - p.x, f.y - p.y) < 40;
    });
    if (taken) return;
    const at = viewPoint(state, p.x, p.y);
    const spot = svgEl('g', { class: 'guide', 'data-guide': p.id, 'data-x': p.x, 'data-y': p.y });
    spot.appendChild(svgEl('circle', {
      cx: at.x, cy: at.y, r: 16, fill: 'rgba(255,255,255,0.10)',
      stroke: 'rgba(255,255,255,0.5)', 'stroke-width': 1.4, 'stroke-dasharray': '4 4',
    }));
    const guideLabel = labelText(at.x, at.y + 30, p.name, 13, '600', 'middle', 'rgba(255,255,255,0.75)');
    guideLabel.setAttribute('pointer-events', 'none');
    spot.appendChild(guideLabel);
    g.appendChild(spot);
  });
  svg.appendChild(g);
}

function drawFielders(svg, state, selectedIndex) {
  const below = [];
  state.fielders.forEach(function (f, i) {
    const crowded = below.some(function (p) {
      return Math.hypot(p.x - f.x, p.y - f.y) < 88;
    });
    const labelBelow = !crowded;
    if (labelBelow) below.push(f);
    const player = state.squad.find(function (p) { return p.id === f.pid; });
    const name = player ? player.name : 'Fielder';
    const fill = f.role === 'k' ? COLORS.keeper : f.role === 'b' ? COLORS.bowler : COLORS.fielder;
    const at = viewPoint(state, f.x, f.y);
    const g = svgEl('g', {
      class: 'chip' + (i === selectedIndex ? ' selected' : ''),
      'data-index': i,
      transform: 'translate(' + at.x + ',' + at.y + ')',
    });

    if (i === selectedIndex) {
      const halo = svgEl('circle', { r: 28, fill: 'none', stroke: '#38bdf8', 'stroke-width': 3 });
      halo.setAttribute('data-noexport', '1');
      halo.setAttribute('pointer-events', 'none');
      g.appendChild(halo);
    }

    g.appendChild(svgEl('circle', {
      r: 20, fill: fill, stroke: '#0b1a13', 'stroke-width': 2.5,
    }));
    g.appendChild(labelText(0, 6, player && player.num ? String(player.num) : initials(name),
      16, '800', 'middle', COLORS.chipText));

    const nameLabel = haloLabel(0, labelBelow ? 36 : -40, name, 16, '700');
    nameLabel.setAttribute('pointer-events', 'none');
    g.appendChild(nameLabel);
    const posLabel = haloLabel(0, labelBelow ? 52 : -25,
      nearestPositionName(f.x, f.y, state.hand), 12.5, '500');
    posLabel.setAttribute('opacity', '0.85');
    posLabel.setAttribute('data-poslabel', '1');
    posLabel.setAttribute('pointer-events', 'none');
    g.appendChild(posLabel);

    if (f.role !== 'f') {
      const roleLabel = labelText(0, labelBelow ? -27 : 40, f.role === 'k' ? 'WK' : 'BOWL',
        12.5, '800', 'middle', '#fde68a');
      roleLabel.setAttribute('pointer-events', 'none');
      g.appendChild(roleLabel);
    }
    svg.appendChild(g);
  });
}

function computeStats(state) {
  let inside = 0, outside = 0, leg = 0, off = 0;
  state.fielders.forEach(function (f) {
    if (isInsideCircle(f.x, f.y)) inside++; else outside++;
    if (sideOf(f.x, state.hand) === 'leg') leg++; else off++;
  });
  return {
    onField: state.fielders.length,
    inside: inside,
    outside: outside,
    leg: leg,
    off: off,
  };
}

/* Build the SVG and wire up interaction.
   opts: { canEdit, showGuides, selectedIndex, onMove, onSelect, onPlace } */
function renderField(container, state, opts) {
  const o = opts || {};
  const stats = computeStats(state);
  const svg = svgEl('svg', {
    viewBox: '0 0 ' + FIELD.W + ' ' + FIELD.H,
    xmlns: SVG_NS,
    id: 'fieldSvg',
    role: 'img',
    'aria-label': 'Cricket fielding positions',
  });

  drawGround(svg, state);
  if (o.showGuides && o.canEdit) drawGuides(svg, state);
  drawFielders(svg, state, o.selectedIndex);
  drawHeader(svg, state, stats);
  drawFooter(svg, state, stats);

  container.innerHTML = '';
  container.appendChild(svg);

  const toSvgPoint = function (evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Pointer positions arrive in drawing space; store them the canonical way.
  const toStored = function (evt) {
    const p = toSvgPoint(evt);
    const canonical = viewPoint(state, p.x, p.y);
    return clampToField(canonical.x, canonical.y);
  };

  if (!o.canEdit) return svg;

  svg.classList.add('editable');

  let drag = null;
  svg.addEventListener('pointerdown', function (evt) {
    const chip = evt.target.closest('g.chip');
    if (chip) {
      const index = Number(chip.dataset.index);
      drag = { index: index, node: chip, moved: false };
      chip.setPointerCapture(evt.pointerId);
      if (o.onSelect) o.onSelect(index);
      evt.preventDefault();
    }
  });

  svg.addEventListener('pointermove', function (evt) {
    if (!drag) return;
    const c = toStored(evt);
    const at = viewPoint(state, c.x, c.y);
    drag.moved = true;
    drag.node.setAttribute('transform', 'translate(' + at.x + ',' + at.y + ')');
    const posLabel = drag.node.querySelector('[data-poslabel]');
    if (posLabel) posLabel.textContent = nearestPositionName(c.x, c.y, state.hand);
    drag.last = c;
    if (o.onDrag) o.onDrag(drag.index, c.x, c.y);
    evt.preventDefault();
  });

  const endDrag = function (evt) {
    if (!drag) return;
    const finished = drag;
    drag = null;
    if (finished.moved && finished.last && o.onMove) {
      o.onMove(finished.index, finished.last.x, finished.last.y);
    }
    if (evt) evt.preventDefault();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  svg.addEventListener('click', function (evt) {
    if (evt.target.closest('g.chip')) return;
    const guide = evt.target.closest('g.guide');
    const c = guide
      ? clampToField(Number(guide.dataset.x), Number(guide.dataset.y))
      : toStored(evt);
    if (o.onPlace) o.onPlace(c.x, c.y);
  });

  return svg;
}
