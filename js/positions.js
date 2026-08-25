/* Cricket field geometry + standard fielding positions.
   Coordinate space: SVG user units, 1000 x 1140 viewBox.
   All angles are measured from the striker, 0 = straight down the ground
   (towards the bowler), positive = leg side. Coordinates below are for a
   right-handed batter, i.e. the off side is on the LEFT of the diagram. */

const FIELD = {
  W: 1000,
  H: 1140,
  CX: 500,
  CY: 590,
  R: 465,
  STRIKER_X: 500,
  STRIKER_Y: 670,
  BOWLER_X: 500,
  BOWLER_Y: 510,
  HEADER_H: 96,
};
FIELD.YARD = FIELD.R / 65;      // boundary assumed 65 yards from the middle
FIELD.R30 = 30 * FIELD.YARD;    // 30-yard circle
FIELD.MAX_R = FIELD.R - 20;     // fielders cannot stand outside the rope

/* Clamp a point so it always sits inside the boundary. */
function clampToField(x, y, margin) {
  const m = margin == null ? FIELD.MAX_R : margin;
  const dx = x - FIELD.CX;
  const dy = y - FIELD.CY;
  const d = Math.hypot(dx, dy);
  if (d <= m || d === 0) return { x: x, y: y };
  return { x: FIELD.CX + (dx / d) * m, y: FIELD.CY + (dy / d) * m };
}

/* Convert an angle/distance (from the striker) into field coordinates. */
function polar(angleDeg, yards) {
  const rad = (angleDeg * Math.PI) / 180;
  const x = FIELD.STRIKER_X + yards * FIELD.YARD * Math.sin(rad);
  const y = FIELD.STRIKER_Y - yards * FIELD.YARD * Math.cos(rad);
  return clampToField(x, y, FIELD.R - 26);
}

const POSITIONS = [
  // id, name, angle, yards, category
  ['keeper', 'Wicketkeeper', 180, 13, 'close'],
  ['slip1', '1st slip', -158, 15, 'close'],
  ['slip2', '2nd slip', -146, 16, 'close'],
  ['slip3', '3rd slip', -134, 17, 'close'],
  ['slip4', '4th slip', -122, 18, 'close'],
  ['flyslip', 'Fly slip', -150, 28, 'close'],
  ['legslip', 'Leg slip', 162, 15, 'close'],
  ['leggully', 'Leg gully', 148, 16.5, 'close'],
  ['gully', 'Gully', -110, 20, 'close'],
  ['sillypoint', 'Silly point', -100, 7, 'close'],
  ['shortleg', 'Short leg', 112, 7, 'close'],
  ['sillymidoff', 'Silly mid-off', -28, 8, 'close'],
  ['sillymidon', 'Silly mid-on', 28, 8, 'close'],

  ['shortthirdman', 'Short third man', -136, 26, 'ring'],
  ['backwardpoint', 'Backward point', -104, 23, 'ring'],
  ['point', 'Point', -92, 24, 'ring'],
  ['coverpoint', 'Cover point', -76, 25, 'ring'],
  ['shortcover', 'Short cover', -56, 18, 'ring'],
  ['cover', 'Cover', -62, 26, 'ring'],
  ['extracover', 'Extra cover', -48, 26, 'ring'],
  ['midoff', 'Mid-off', -26, 27, 'ring'],
  ['bowlerend', "Bowler", 0, 23, 'ring'],
  ['midon', 'Mid-on', 26, 27, 'ring'],
  ['shortmidwicket', 'Short midwicket', 50, 19, 'ring'],
  ['midwicket', 'Midwicket', 62, 26, 'ring'],
  ['squareleg', 'Square leg', 92, 24, 'ring'],
  ['backwardsquareleg', 'Backward square leg', 110, 22, 'ring'],
  ['shortfineleg', 'Short fine leg', 142, 24, 'ring'],

  ['thirdman', 'Third man', -134, 58, 'deep'],
  ['deepbackwardpoint', 'Deep backward point', -112, 58, 'deep'],
  ['deeppoint', 'Deep point', -92, 58, 'deep'],
  ['deepcover', 'Deep cover', -68, 58, 'deep'],
  ['deepextracover', 'Deep extra cover', -50, 58, 'deep'],
  ['longoff', 'Long off', -26, 60, 'deep'],
  ['straighthit', 'Straight hit', 0, 60, 'deep'],
  ['longon', 'Long on', 26, 60, 'deep'],
  ['cowcorner', 'Cow corner', 46, 60, 'deep'],
  ['deepmidwicket', 'Deep midwicket', 62, 58, 'deep'],
  ['deepsquareleg', 'Deep square leg', 92, 58, 'deep'],
  ['deepbackwardsquareleg', 'Deep backward square leg', 110, 58, 'deep'],
  ['fineleg', 'Fine leg', 134, 58, 'deep'],
  ['longleg', 'Long leg', 152, 56, 'deep'],
  ['deepfineleg', 'Deep fine leg', 162, 54, 'deep'],
].map(function (p) {
  return { id: p[0], name: p[1], angle: p[2], yards: p[3], cat: p[4] };
});

/* Position coordinates for a given batting hand ('r' or 'l').
   For a left-hander every named position is mirrored across the pitch. */
function positionsFor(hand) {
  return POSITIONS.map(function (p) {
    const pt = polar(hand === 'l' ? -p.angle : p.angle, p.yards);
    return { id: p.id, name: p.name, cat: p.cat, x: pt.x, y: pt.y };
  });
}

/* Name of the standard position closest to an arbitrary point. */
function nearestPositionName(x, y, hand) {
  const list = positionsFor(hand);
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    const d = Math.hypot(list[i].x - x, list[i].y - y);
    if (d < bestD) {
      bestD = d;
      best = list[i];
    }
  }
  return best ? best.name : '';
}

/* Which half of the ground a point sits in. */
function sideOf(x, hand) {
  const off = hand === 'l' ? x > FIELD.CX : x < FIELD.CX;
  return off ? 'off' : 'leg';
}

function isInsideCircle(x, y) {
  // The 30-yard circle is two semicircles centred on the stumps joined by lines.
  if (y >= FIELD.BOWLER_Y && y <= FIELD.STRIKER_Y) {
    return Math.abs(x - FIELD.CX) <= FIELD.R30;
  }
  const cy = y < FIELD.BOWLER_Y ? FIELD.BOWLER_Y : FIELD.STRIKER_Y;
  return Math.hypot(x - FIELD.CX, y - cy) <= FIELD.R30;
}

/* Ready-made fields. Each is a list of position ids; the first two are always
   the keeper and the bowler. */
const TEMPLATES = [
  {
    id: 'pp1',
    name: 'ODI powerplay (2 out)',
    note: 'Overs 1-10, two fielders outside the circle',
    positions: ['keeper', 'bowlerend', 'slip1', 'slip2', 'point', 'cover',
      'midoff', 'midon', 'midwicket', 'thirdman', 'fineleg'],
  },
  {
    id: 'middle',
    name: 'ODI middle overs (4 out)',
    note: 'Overs 11-40, four fielders outside the circle',
    positions: ['keeper', 'bowlerend', 'slip1', 'point', 'cover', 'midoff',
      'midon', 'midwicket', 'deepmidwicket', 'deepcover', 'fineleg'],
  },
  {
    id: 'death',
    name: 'Death overs (5 out)',
    note: 'Boundary riders out, single-savers in',
    positions: ['keeper', 'bowlerend', 'thirdman', 'deeppoint', 'longoff',
      'longon', 'deepmidwicket', 'fineleg', 'cover', 'midwicket', 'point'],
  },
  {
    id: 'test',
    name: 'Test attacking (3 slips)',
    note: 'New ball, catchers in',
    positions: ['keeper', 'bowlerend', 'slip1', 'slip2', 'slip3', 'gully',
      'point', 'cover', 'midoff', 'midon', 'fineleg'],
  },
  {
    id: 'spin',
    name: 'T20 spin field',
    note: 'Ring saving one, three boundary riders',
    positions: ['keeper', 'bowlerend', 'slip1', 'point', 'cover', 'midoff',
      'midon', 'shortmidwicket', 'deepmidwicket', 'longoff', 'deepsquareleg'],
  },
];
