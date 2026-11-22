// Velvet Hour — everything the eye sees, drawn on one canvas.
// One clear job: paint the theatre, the light, the cones and the callouts.
// The callouts are drawn from real game state (a suspicious usher, a hidden
// Wren, the footlights) so a screenshot never claims what is not happening.

import {
  TILE, COLS, ROWS, ORIGIN_X, ORIGIN_Y, tileAt, tileCenter,
  LAMPS, ROOMS, findTiles,
} from './level.js';
import { CONE_RANGE, CONE_HALF_ANGLE } from './guards.js';

const FLOOR_A = '#232a3d';
const FLOOR_B = '#202636';
const WALL = '#3a4157';
const WALL_TOP = '#565e78';
const GOLD = '#d9a441';
const CREAM = '#f2e3c2';

function tileRect(col, row) {
  return { x: ORIGIN_X + col * TILE, y: ORIGIN_Y + row * TILE, w: TILE, h: TILE };
}

function drawFloor(ctx) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tileAt(c, r);
      const rc = tileRect(c, r);
      ctx.fillStyle = t === '#' ? '#171b28' : (c + r) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      if (t === '.') {
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(rc.x + 0.5, rc.y + 0.5, rc.w, rc.h);
      }
    }
  }
  // Room names, painted faintly on the floor.
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 13px Georgia, serif';
  ctx.fillStyle = 'rgba(242,227,194,0.28)';
  for (const room of ROOMS) {
    const p = tileCenter(room.tx, room.ty);
    ctx.fillText(room.label, p.x - 30, p.y + 4);
  }
}

function drawLampPools(ctx, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const lamp of LAMPS) {
    const p = tileCenter(lamp.tx, lamp.ty);
    const flicker = 1 + Math.sin(time * 2.1 + lamp.tx * 3) * 0.04;
    const r = lamp.r * flicker;
    const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, r);
    g.addColorStop(0, 'rgba(255,196,90,0.30)');
    g.addColorStop(0.55, 'rgba(255,170,60,0.12)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // The lamps themselves: brass rings with a warm heart.
  for (const lamp of LAMPS) {
    const p = tileCenter(lamp.tx, lamp.ty);
    ctx.fillStyle = '#8a6a2f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9ad';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCover(ctx) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = tileAt(c, r);
      const rc = tileRect(c, r);
      if (t === 'C') {
        // Velvet curtain: deep red with folds.
        ctx.fillStyle = '#5d1f2a';
        ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
        ctx.fillStyle = '#7a2836';
        for (let f = 0; f < 4; f++) {
          ctx.fillRect(rc.x + 4 + f * 9, rc.y, 4, rc.h);
        }
        ctx.fillStyle = '#3d1420';
        ctx.fillRect(rc.x, rc.y + rc.h - 5, rc.w, 5);
      } else if (t === 'X') {
        ctx.fillStyle = '#6b4a26';
        ctx.fillRect(rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6);
        ctx.strokeStyle = '#8a6238';
        ctx.lineWidth = 2;
        ctx.strokeRect(rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6);
        ctx.beginPath();
        ctx.moveTo(rc.x + 3, rc.y + 3);
        ctx.lineTo(rc.x + rc.w - 3, rc.y + rc.h - 3);
        ctx.moveTo(rc.x + rc.w - 3, rc.y + 3);
        ctx.lineTo(rc.x + 3, rc.y + rc.h - 3);
        ctx.stroke();
      } else if (t === 's') {
        ctx.fillStyle = '#31435f';
        ctx.fillRect(rc.x + 5, rc.y + 6, rc.w - 10, rc.h - 12);
        ctx.fillStyle = '#42587e';
        ctx.fillRect(rc.x + 5, rc.y + 6, rc.w - 10, 6);
      }
    }
  }
}

function drawWalls(ctx) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(c, r) !== '#') continue;
      const rc = tileRect(c, r);
      ctx.fillStyle = WALL;
      ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
      ctx.fillStyle = WALL_TOP;
      ctx.fillRect(rc.x, rc.y, rc.w, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(rc.x, rc.y + rc.h - 3, rc.w, 3);
    }
  }
}

function coneColor(guard) {
  if (guard.state === 'chase') return { fill: 'rgba(214,69,65,0.34)', edge: 'rgba(255,120,110,0.85)' };
  if (guard.state === 'suspicious' || guard.state === 'investigate') return { fill: 'rgba(232,178,74,0.30)', edge: 'rgba(255,214,130,0.85)' };
  return { fill: 'rgba(232,190,90,0.20)', edge: 'rgba(232,200,120,0.55)' };
}

function drawCones(ctx, guards) {
  for (const g of guards) {
    const col = coneColor(g);
    const range = CONE_RANGE * (g.state === 'chase' ? 1.08 : 1);
    ctx.fillStyle = col.fill;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, range, g.dir - CONE_HALF_ANGLE, g.dir + CONE_HALF_ANGLE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col.edge;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.dir - CONE_HALF_ANGLE) * range, g.y + Math.sin(g.dir - CONE_HALF_ANGLE) * range);
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.dir + CONE_HALF_ANGLE) * range, g.y + Math.sin(g.dir + CONE_HALF_ANGLE) * range);
    ctx.stroke();
    ctx.setLineDash([]);
    // Faint arc at the cone's far edge.
    ctx.beginPath();
    ctx.arc(g.x, g.y, range, g.dir - CONE_HALF_ANGLE, g.dir + CONE_HALF_ANGLE);
    ctx.stroke();
  }
}

function drawLootAndPrize(ctx, state) {
  for (const loot of state.loot) {
    if (loot.taken) continue;
    const bob = Math.sin(state.time * 2 + loot.col) * 2;
    ctx.save();
    ctx.translate(loot.x, loot.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeStyle = '#fff2c8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
  }
  if (!state.prizeTaken) {
    const p = state.prize;
    // Pedestal and the Gilded Marionette: gold figure on strings.
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(p.x - 14, p.y + 4, 28, 12);
    ctx.fillStyle = '#6b5326';
    ctx.fillRect(p.x - 14, p.y + 4, 28, 4);
    ctx.strokeStyle = 'rgba(242,227,194,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 26);
    ctx.lineTo(p.x - 6, p.y - 6);
    ctx.moveTo(p.x + 8, p.y - 26);
    ctx.lineTo(p.x + 6, p.y - 6);
    ctx.moveTo(p.x, p.y - 26);
    ctx.lineTo(p.x, p.y - 12);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(p.x - 6, p.y - 11, 12, 12);
    ctx.fillStyle = '#fff2c8';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 16, 2, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(p.x, p.y - 10, 4, p.x, p.y - 10, 46);
    glow.addColorStop(0, 'rgba(255,210,110,0.22)');
    glow.addColorStop(1, 'rgba(255,210,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10, 46, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, state) {
  const e = state.exit;
  const open = state.prizeTaken;
  ctx.fillStyle = open ? '#1d7a4c' : '#274a35';
  ctx.fillRect(e.x - 16, e.y - 18, 32, 36);
  ctx.strokeStyle = open ? '#7dffa8' : '#5d8a6d';
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x - 16, e.y - 18, 32, 36);
  ctx.fillStyle = open ? '#c9ffe0' : '#9fc3ab';
  ctx.font = '700 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x, e.y + 4);
  if (open) {
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(state.time * 3) * 0.2;
    ctx.strokeStyle = '#7dffa8';
    ctx.strokeRect(e.x - 20, e.y - 22, 40, 44);
    ctx.restore();
  }
}

function drawGuards(ctx, state) {
  for (const g of state.guards) {
    // Body: an usher in a dark coat, lantern ring around him.
    ctx.fillStyle = '#2b2f3a';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8862e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8862e';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.dir) * 8, g.y + Math.sin(g.dir) * 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion arc above the head.
    if (g.suspicion > 0.05) {
      ctx.strokeStyle = g.state === 'chase' ? '#ff5a4e' : '#ffc44d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.suspicion);
      ctx.stroke();
    }
    // ? while wondering, ! while hunting.
    if (g.state === 'suspicious' || g.state === 'investigate' || g.state === 'search') {
      ctx.fillStyle = '#ffd34d';
      ctx.font = '700 20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x + 16, g.y - 12);
    } else if (g.state === 'chase') {
      ctx.fillStyle = '#ff5a4e';
      ctx.font = '700 22px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x + 16, g.y - 12);
    }
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  ctx.save();
  ctx.globalAlpha = p.hidden ? 0.75 : 1;
  ctx.fillStyle = '#10131c';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.lit ? '#ffd34d' : '#8fd0ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = '#f2e3c2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.dir) * 8, p.y + Math.sin(p.dir) * 8);
  ctx.lineTo(p.x + Math.cos(p.dir) * 15, p.y + Math.sin(p.dir) * 15);
  ctx.stroke();
  ctx.restore();
  if (p.hidden) {
    ctx.fillStyle = '#8fd0ff';
    ctx.font = '700 10px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y - 20);
  }
}

const PLAYER_R = 13;

function drawButton(ctx, button) {
  if (!button) return;
  ctx.fillStyle = '#e8c877';
  ctx.beginPath();
  ctx.arc(button.x, button.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff2c8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(button.x, button.y, 4, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPings(ctx, state) {
  for (const ping of state.pings) {
    const age = ping.age / ping.life;
    ctx.strokeStyle = `rgba(255,211,77,${0.85 * (1 - age)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ping.x, ping.y, 12 + age * ping.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function callout(ctx, x, y, text, accent) {
  ctx.font = '600 12px Verdana, sans-serif';
  const w = ctx.measureText(text).width + 18;
  const bx = Math.max(232, Math.min(x - w / 2, 1280 - w - 8));
  const by = Math.max(62, y);
  ctx.fillStyle = 'rgba(12,14,22,0.92)';
  ctx.strokeStyle = accent || GOLD;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.rect(bx, by, w, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2e3c2';
  ctx.textAlign = 'left';
  ctx.fillText(text, bx + 9, by + 16);
  return { x: bx + w / 2, y: by + 24 };
}

function drawCallouts(ctx, state) {
  const p = state.player;
  // A suspicious usher explains itself.
  for (const g of state.guards) {
    if (g.state === 'investigate' || g.state === 'suspicious') {
      const anchor = callout(ctx, g.x, g.y - 52, '? HEARD THE BUTTON — off to look', '#ffd34d');
      ctx.strokeStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(g.x, g.y - 20);
      ctx.stroke();
      break;
    }
  }
  // Hidden where a cone dies at the crates.
  if (p.hidden) {
    const near = state.guards.some((g) => Math.hypot(g.x - p.x, g.y - p.y) < 260);
    if (near) {
      const anchor = callout(ctx, p.x, p.y - 46, 'YOU: hidden where the cone stops at the crates', '#8fd0ff');
      ctx.strokeStyle = '#8fd0ff';
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(p.x, p.y - 16);
      ctx.stroke();
    }
  }
  // Standing in the footlights.
  if (p.lit && !p.hidden) {
    callout(ctx, p.x, p.y - 46, 'FOOTLIGHTS: seen from across the room', '#ffb14d');
  }
  // The prize, named once.
  if (!state.prizeTaken && state.time < 30) {
    callout(ctx, state.prize.x, state.prize.y - 58, 'THE GILDED MARIONETTE', GOLD);
  }
  // The way out, once the prize is yours.
  if (state.prizeTaken && state.phase === 'play') {
    callout(ctx, state.exit.x, state.exit.y - 52, 'STAGE DOOR — go, unseen', '#7dffa8');
  }
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(640, 360, 320, 640, 360, 760);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
}

export function draw(ctx, state) {
  ctx.clearRect(0, 0, 1280, 720);
  ctx.fillStyle = '#10131c';
  ctx.fillRect(0, 0, 1280, 720);
  drawFloor(ctx);
  drawLampPools(ctx, state.time);
  drawCover(ctx);
  drawWalls(ctx);
  drawCones(ctx, state.guards);
  drawLootAndPrize(ctx, state);
  drawExit(ctx, state);
  drawButton(ctx, state.button);
  drawPings(ctx, state);
  drawGuards(ctx, state);
  drawPlayer(ctx, state);
  drawCallouts(ctx, state);
  drawVignette(ctx);
}

export { PLAYER_R };
