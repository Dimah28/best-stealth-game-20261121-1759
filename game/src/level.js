// Velvet Hour — level data for the Marlow Theatre.
// One clear job: describe the stage the game is played on. Nothing here runs
// the game; game.js reads this and builds the world from it.
//
// Legend (one character per tile, 25 columns x 14 rows):
//   '#' wall (blocks sight and movement)
//   '.' bare floor
//   'C' velvet curtain — tall cover: blocks sight, hides you inside it
//   'X' prop crate — blocks sight and movement
//   's' seat row — low cover: hides you only while you sneak through it
//   'L' chandelier / lamp — its light pool makes you easier to spot
//   'S' where Wren slips in, 'P' the Gilded Marionette, 'E' the stage door
//   'G' a gilt playbill (optional loot)

export const TILE = 41;
export const COLS = 25;
export const ROWS = 14;

// Playfield origin inside the 1280x720 page (HUD bars live around it).
export const ORIGIN_X = 238;
export const ORIGIN_Y = 74;

export const MAP = [
  '#########################',
  '#....#.......#..........#',
  '#S...#...L...#....G.....#',
  '#C...#.......#..........#',
  '#.XX....C.....XX...E....#',
  '#....#.......#..........#',
  '#.ss.#..sss..#..ss......#',
  '#.ss.#..sss..#....P.....#',
  '#....#.......#..........#',
  '#.C....L....C......G....#',
  '#....#.......#..........#',
  '#.XX....C.....XX........#',
  '#....#.......#....G.....#',
  '#########################',
];

// Extra lamps beyond the 'L' tiles: stage footlights and the foyer sconce.
export const LAMPS = [
  { tx: 9, ty: 2, r: 150 }, // auditorium chandelier
  { tx: 7, ty: 9, r: 150 }, // corridor chandelier
  { tx: 20, ty: 6, r: 140 }, // stage footlights, right
  { tx: 16, ty: 11, r: 130 }, // prop-store sconce
];

// Creaky stage boards: walking here (not sneaking) pings the ushers.
export const CREAKY = [
  { x0: 15, y0: 6, x1: 22, y1: 8 },
];

// The ushers and the loops they walk. Waypoints are tile coordinates.
export const GUARDS = [
  {
    name: 'ALDO', role: 'G-1',
    waypoints: [[2, 1], [2, 12], [10, 12], [10, 1]],
    speed: 56,
  },
  {
    name: 'NERIS', role: 'G-2',
    waypoints: [[7, 3], [11, 3], [11, 10], [7, 10]],
    speed: 60,
  },
  {
    name: 'CAEL', role: 'G-3',
    waypoints: [[16, 2], [22, 2], [22, 12], [16, 12]],
    speed: 58,
  },
  {
    name: 'VESS', role: 'G-4',
    waypoints: [[18, 6], [21, 6], [21, 8], [18, 8]],
    speed: 52,
  },
];

// Room labels painted on the floor plan.
export const ROOMS = [
  { tx: 2, ty: 1, label: 'FOYER' },
  { tx: 8, ty: 1, label: 'THE AUDITORIUM' },
  { tx: 18, ty: 1, label: 'THE STAGE' },
  { tx: 18, ty: 12, label: 'PROP STORE' },
  { tx: 2, ty: 12, label: 'DRESSING ROOMS' },
];

export function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return '#';
  return MAP[row][col];
}

export function isWall(col, row) {
  return tileAt(col, row) === '#';
}

export function blocksSight(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'X' || t === 'C';
}

export function blocksMove(col, row) {
  const t = tileAt(col, row);
  return t === '#' || t === 'X';
}

export function isSeat(col, row) {
  return tileAt(col, row) === 's';
}

export function isCurtain(col, row) {
  return tileAt(col, row) === 'C';
}

export function tileCenter(col, row) {
  return { x: ORIGIN_X + col * TILE + TILE / 2, y: ORIGIN_Y + row * TILE + TILE / 2 };
}

export function findTiles(ch) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === ch) out.push({ col: c, row: r });
    }
  }
  return out;
}

// Pixel position -> tile coordinates.
export function tileOf(x, y) {
  return {
    col: Math.floor((x - ORIGIN_X) / TILE),
    row: Math.floor((y - ORIGIN_Y) / TILE),
  };
}

export function inCreaky(x, y) {
  const t = tileOf(x, y);
  return CREAKY.some((r) => t.col >= r.x0 && t.col <= r.x1 && t.row >= r.y0 && t.row <= r.y1);
}
