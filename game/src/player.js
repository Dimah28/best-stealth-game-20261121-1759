// Velvet Hour — Wren: movement, stance, noise and the brass button.
// One clear job: turn keys and clicks into where Wren is and how loud she is.
// The game reads player.noise events; guards.js decides who hears them.

import {
  TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, blocksMove, tileOf, isSeat, isCurtain,
  inCreaky, findTiles,
} from './level.js';

export const WALK_SPEED = 122;
export const SNEAK_SPEED = 62;
export const SPRINT_SPEED = 186;
export const PLAYER_RADIUS = 13;

export function makePlayer() {
  const start = findTiles('S')[0];
  return {
    x: ORIGIN_X + start.col * TILE + TILE / 2,
    y: ORIGIN_Y + start.row * TILE + TILE / 2,
    dir: 0,
    sneaking: false,
    sprinting: false,
    moving: false,
    hidden: false, // inside a curtain, or crouched in the seats
    lit: false, // standing in a lamp pool
    buttons: 3, // brass buttons left to throw
    stepTime: 0,
    noise: [], // {x, y, radius, kind} events this tick, drained by game.js
  };
}

function blockedAt(x, y) {
  const r = PLAYER_RADIUS - 2;
  const corners = [
    [x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r],
  ];
  return corners.some(([cx, cy]) => {
    const t = tileOf(cx, cy);
    return blocksMove(t.col, t.row);
  });
}

export function updatePlayer(player, keys, dt) {
  let mx = 0;
  let my = 0;
  if (keys.left) mx -= 1;
  if (keys.right) mx += 1;
  if (keys.up) my -= 1;
  if (keys.down) my += 1;
  player.moving = mx !== 0 || my !== 0;
  player.sneaking = !!keys.sneak && !keys.sprint;
  player.sprinting = !!keys.sprint && player.moving && !player.sneaking;

  const speed = player.sneaking ? SNEAK_SPEED : player.sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (player.moving) {
    const len = Math.hypot(mx, my);
    const nx = player.x + (mx / len) * speed * dt;
    const ny = player.y + (my / len) * speed * dt;
    // Slide along walls: try each axis on its own.
    if (!blockedAt(nx, player.y)) player.x = nx;
    if (!blockedAt(player.x, ny)) player.y = ny;
    player.x = Math.max(ORIGIN_X + TILE + PLAYER_RADIUS, Math.min(ORIGIN_X + COLS * TILE - TILE - PLAYER_RADIUS, player.x));
    player.y = Math.max(ORIGIN_Y + TILE + PLAYER_RADIUS, Math.min(ORIGIN_Y + ROWS * TILE - TILE - PLAYER_RADIUS, player.y));
    player.dir = Math.atan2(my, mx);
  }

  // Cover: curtains hide you outright; seat rows hide you while you sneak.
  const t = tileOf(player.x, player.y);
  player.hidden = isCurtain(t.col, t.row) || (isSeat(t.col, t.row) && player.sneaking);

  // Footsteps: sprinting is loud, walking on the creaky boards is louder.
  if (player.moving) {
    player.stepTime -= dt;
    if (player.stepTime <= 0) {
      const loud = player.sprinting || (!player.sneaking && inCreaky(player.x, player.y));
      if (loud) {
        player.noise.push({
          x: player.x, y: player.y,
          radius: player.sprinting ? 175 : 135,
          kind: player.sprinting ? 'sprint' : 'creak',
        });
      }
      player.stepTime = player.sprinting ? 0.34 : 0.55;
    }
  }
  return player;
}

// Throw a brass button toward a point: it arcs there, clinks, and every
// usher in earshot comes to look. Returns the button flight or null.
export function throwButton(player, tx, ty) {
  if (player.buttons <= 0) return null;
  player.buttons -= 1;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.min(Math.hypot(dx, dy), 320);
  const ang = Math.atan2(dy, dx);
  return {
    x: player.x,
    y: player.y,
    sx: player.x,
    sy: player.y,
    tx: player.x + Math.cos(ang) * dist,
    ty: player.y + Math.sin(ang) * dist,
    t: 0,
    dur: 0.45,
    landed: false,
  };
}

export function updateButton(button, dt) {
  if (!button || button.landed) return button;
  button.t += dt / button.dur;
  if (button.t >= 1) {
    button.t = 1;
    button.landed = true;
    button.x = button.tx;
    button.y = button.ty;
    return button;
  }
  // A little arc: up and over the seats.
  button.x = button.sx + (button.tx - button.sx) * button.t;
  button.y = button.sy + (button.ty - button.sy) * button.t - Math.sin(button.t * Math.PI) * 26;
  return button;
}
