// Velvet Hour — the ushers: patrol, suspicion, investigation and chase.
// One clear job: decide what each guard does and whether it can see Wren.
// Vision is a cone with a line of sight; walls, crates and curtains block it.

import {
  TILE, tileAt, blocksSight, tileCenter, tileOf,
} from './level.js';

export const CONE_RANGE = 250;
export const CONE_HALF_ANGLE = 0.61; // ~35 degrees each side
export const LIGHT_RANGE_BONUS = 1.32;
export const SHADOW_SNEAK_RANGE = 0.68;
export const CATCH_DISTANCE = 26;

// Grid raycast: true when no sight-blocking tile stands between two points.
export function hasLineOfSight(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 3)));
  for (let i = 1; i < steps; i++) {
    const t = tileOf(x0 + (dx * i) / steps, y0 + (dy * i) / steps);
    if (blocksSight(t.col, t.row)) return false;
  }
  return true;
}

export function makeGuard(def, index) {
  const start = tileCenter(def.waypoints[0][0], def.waypoints[0][1]);
  return {
    index,
    name: def.name,
    role: def.role,
    waypoints: def.waypoints.map(([c, r]) => tileCenter(c, r)),
    speed: def.speed,
    x: start.x,
    y: start.y,
    dir: 0, // facing angle, radians
    wp: 1, // next waypoint
    state: 'patrol', // patrol | suspicious | investigate | chase | search
    suspicion: 0, // 0..1, fills while Wren is seen
    target: null, // {x, y} being investigated
    stateTime: 0,
    chaseTime: 0,
    lastSeen: null,
    pauseTime: 0,
  };
}

// How visible Wren is to this guard right now: 0 (unseen) to 1 (plain as day).
export function visibilityOf(guard, player, lit) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  let range = CONE_RANGE;
  if (lit) range *= LIGHT_RANGE_BONUS;
  if (player.sneaking && !lit) range *= SHADOW_SNEAK_RANGE;
  if (dist > range) return 0;
  let angle = Math.atan2(dy, dx) - guard.dir;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  if (Math.abs(angle) > CONE_HALF_ANGLE) return 0;
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
  if (player.hidden) return 0; // inside a curtain, or crouched in the seats
  const closeness = 1 - dist / range;
  const stance = player.sneaking ? 0.55 : 1;
  const light = lit ? 1.25 : 0.8;
  return Math.min(1, closeness * stance * light + 0.15);
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.dir = Math.atan2(dy, dx);
  return dist - step < 2;
}

export function hearNoise(guard, x, y, radius) {
  if (guard.state === 'chase') return;
  const d = Math.hypot(x - guard.x, y - guard.y);
  if (d > radius) return;
  guard.state = 'investigate';
  guard.target = { x, y };
  guard.stateTime = 0;
  guard.suspicion = Math.max(guard.suspicion, 0.55);
}

export function updateGuard(guard, dt, player, lit) {
  guard.stateTime += dt;
  const seen = visibilityOf(guard, player, lit);

  if (seen > 0) {
    guard.lastSeen = { x: player.x, y: player.y };
    // Closer and brighter fills suspicion faster; a glimpse alone is slow.
    guard.suspicion += dt * (0.25 + seen * 1.15);
    if (guard.suspicion >= 1) {
      guard.suspicion = 1;
      if (guard.state !== 'chase') {
        guard.state = 'chase';
        guard.chaseTime = 0;
        guard.stateTime = 0;
      }
    } else if (guard.state === 'patrol') {
      guard.state = 'suspicious';
      guard.stateTime = 0;
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - dt * 0.3);
    if (guard.state === 'suspicious' && guard.suspicion <= 0.05) {
      guard.state = 'patrol';
      guard.stateTime = 0;
    }
  }

  switch (guard.state) {
    case 'patrol': {
      const wp = guard.waypoints[guard.wp];
      if (moveToward(guard, wp.x, wp.y, guard.speed, dt)) {
        guard.wp = (guard.wp + 1) % guard.waypoints.length;
        guard.pauseTime = 0.7; // a beat at each corner, looking around
      }
      if (guard.pauseTime > 0) {
        guard.pauseTime -= dt;
        guard.dir += Math.sin(guard.stateTime * 2.2) * dt * 0.9;
      }
      break;
    }
    case 'suspicious': {
      // Freeze and stare at the last glimpse for a heartbeat.
      if (guard.lastSeen) {
        guard.dir = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      }
      if (guard.stateTime > 1.4 && guard.suspicion < 1) {
        guard.state = guard.lastSeen ? 'investigate' : 'patrol';
        guard.target = guard.lastSeen;
        guard.stateTime = 0;
      }
      break;
    }
    case 'investigate': {
      if (!guard.target) {
        guard.state = 'patrol';
        break;
      }
      if (moveToward(guard, guard.target.x, guard.target.y, guard.speed * 1.35, dt)) {
        guard.state = 'search';
        guard.stateTime = 0;
      }
      break;
    }
    case 'search': {
      // Look around the spot, then give up and walk back to the loop.
      guard.dir += dt * 1.6;
      if (guard.stateTime > 2.6) {
        guard.state = 'patrol';
        guard.target = null;
        guard.stateTime = 0;
      }
      break;
    }
    case 'chase': {
      guard.chaseTime += dt;
      const dest = guard.lastSeen || { x: player.x, y: player.y };
      moveToward(guard, dest.x, dest.y, guard.speed * 1.9, dt);
      // Lost her: hunt the last seen spot, then fall back to searching.
      if (seen <= 0 && guard.chaseTime > 2.5) {
        guard.state = 'investigate';
        guard.target = guard.lastSeen;
        guard.stateTime = 0;
      }
      if (guard.chaseTime > 7) {
        guard.state = 'search';
        guard.suspicion = 0.4;
        guard.stateTime = 0;
      }
      break;
    }
    default:
      break;
  }
  return seen;
}

export function guardCaughtPlayer(guard, player) {
  return guard.state === 'chase'
    && Math.hypot(guard.x - player.x, guard.y - player.y) < CATCH_DISTANCE;
}
