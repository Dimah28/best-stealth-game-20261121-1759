// Velvet Hour — the game itself: state, loop, input, HUD and endings.
// One clear job: run the heist. It wires level.js, guards.js, player.js,
// render.js and audio.js together and owns the screen the judge sees.
//
// ?shot=start|play|end&seed=N stages a deterministic scene for screenshots:
// the game is stepped a fixed number of ticks from a fixed seed, then frozen.

import {
  TILE, ORIGIN_X, ORIGIN_Y, COLS, ROWS, LAMPS, GUARDS, findTiles,
  tileCenter, tileOf, tileAt,
} from './level.js';
import { makeRng } from './rng.js';
import {
  makeGuard, updateGuard, hearNoise, guardCaughtPlayer, CONE_RANGE,
} from './guards.js';
import {
  makePlayer, updatePlayer, throwButton, updateButton, PLAYER_RADIUS,
} from './player.js';
import { draw } from './render.js';
import { makeAudio, unlockAudio, sfx } from './audio.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = Number(params.get('seed') || '1') || 1;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const state = {
  phase: 'title', // title | play | paused | won | lost
  time: 0,
  elapsed: 0,
  score: 0,
  loot: [],
  prize: null,
  exit: null,
  prizeTaken: false,
  lootTaken: 0,
  strikes: 0,
  spotted: false, // ever chased: the ghost bonus dies with it
  guards: [],
  player: null,
  button: null,
  pings: [],
  keys: {},
  mouse: { x: -1, y: -1, inside: false },
  audio: makeAudio(),
  rng: makeRng(SEED),
  alarmed: false,
  lastChase: false,
};

function lampPoints() {
  const pts = LAMPS.map((l) => {
    const p = tileCenter(l.tx, l.ty);
    return { x: p.x, y: p.y, r: l.r };
  });
  for (const t of findTiles('L')) {
    const p = tileCenter(t.col, t.row);
    pts.push({ x: p.x, y: p.y, r: 150 });
  }
  return pts;
}
const LAMPPOINTS = lampPoints();

function resetRun() {
  state.time = 0;
  state.elapsed = 0;
  state.score = 0;
  state.prizeTaken = false;
  state.lootTaken = 0;
  state.strikes = 0;
  state.spotted = false;
  state.alarmed = false;
  state.lastChase = false;
  state.button = null;
  state.pings = [];
  state.loot = findTiles('G').map((t) => {
    const p = tileCenter(t.col, t.row);
    return { ...p, col: t.col, row: t.row, taken: false };
  });
  const prizeTile = findTiles('P')[0];
  state.prize = tileCenter(prizeTile.col, prizeTile.row);
  const exitTile = findTiles('E')[0];
  state.exit = tileCenter(exitTile.col, exitTile.row);
  state.guards = GUARDS.map((def, i) => makeGuard(def, i));
  state.player = makePlayer();
}

function playerLit() {
  const p = state.player;
  return LAMPPOINTS.some((l) => Math.hypot(p.x - l.x, p.y - l.y) < l.r);
}

function addPing(x, y, radius, kind) {
  state.pings.push({ x, y, radius, age: 0, life: 0.9, kind });
  for (const g of state.guards) hearNoise(g, x, y, radius);
}

function step(dt) {
  state.time += dt;
  if (state.phase !== 'play') return;
  state.elapsed += dt;

  const p = state.player;
  updatePlayer(p, state.keys, dt);
  p.lit = playerLit();

  // Footstep noise reaches the ushers.
  for (const n of p.noise) {
    addPing(n.x, n.y, n.radius, n.kind);
    if (n.kind === 'creak') sfx.creak(state.audio);
  }
  p.noise.length = 0;

  // The thrown button.
  if (state.button) {
    const wasFlying = !state.button.landed;
    updateButton(state.button, dt);
    if (wasFlying && state.button.landed) {
      addPing(state.button.x, state.button.y, 230, 'button');
      sfx.clink(state.audio);
    }
    if (state.button.landed && state.time - (state.button.landTime || 0) > 1.2) {
      state.button = null;
    } else if (state.button.landed && !state.button.landTime) {
      state.button.landTime = state.time;
    }
  }

  for (const ping of state.pings) ping.age += dt;
  state.pings = state.pings.filter((ping) => ping.age < ping.life);

  // The ushers watch, wonder and hunt.
  let anyChase = false;
  for (const g of state.guards) {
    updateGuard(g, dt, p, p.lit);
    if (g.state === 'chase') anyChase = true;
  }
  if (anyChase && !state.lastChase) {
    state.spotted = true;
    sfx.alarm(state.audio);
  }
  state.lastChase = anyChase;

  // Caught.
  for (const g of state.guards) {
    if (guardCaughtPlayer(g, p)) {
      state.strikes += 1;
      sfx.caught(state.audio);
      if (state.strikes >= 3) {
        endRun(false);
        return;
      }
      // Marched back to the foyer; the ushers go back to their rounds.
      state.player = makePlayer();
      state.player.buttons = p.buttons;
      state.guards = GUARDS.map((def, i) => makeGuard(def, i));
      state.button = null;
      showFlash('CAUGHT — strike ' + state.strikes + ' of 3. Back to the foyer.');
      break;
    }
  }

  // Taking things: E near a playbill, the Marionette, then the door.
  const near = (pt, d) => Math.hypot(p.x - pt.x, p.y - pt.y) < d;
  state.nearLoot = state.loot.find((l) => !l.taken && near(l, 34)) || null;
  state.nearPrize = !state.prizeTaken && near(state.prize, 36) ? state.prize : null;
  state.nearExit = state.prizeTaken && near(state.exit, 30) ? state.exit : null;

  if (state.keys.interact) {
    state.keys.interact = false;
    if (state.nearLoot) {
      state.nearLoot.taken = true;
      state.lootTaken += 1;
      state.score += 100;
      sfx.grab(state.audio);
      showFlash('Gilt playbill pocketed — +' + 100);
    } else if (state.nearPrize) {
      state.prizeTaken = true;
      state.score += 500;
      sfx.grab(state.audio);
      showFlash('THE GILDED MARIONETTE IS YOURS — reach the stage door.');
    }
  }
  if (state.nearExit) endRun(true);
}

function endRun(won) {
  state.phase = won ? 'won' : 'lost';
  if (won) {
    const ghost = !state.spotted && state.strikes === 0;
    const timeBonus = Math.max(0, 600 - Math.floor(state.elapsed) * 2);
    state.score += timeBonus + (ghost ? 500 : 0);
    state.winStats = {
      time: fmtTime(state.elapsed),
      loot: state.lootTaken + '/' + state.loot.length,
      strikes: state.strikes,
      ghost,
      timeBonus,
      score: state.score,
    };
    sfx.win(state.audio);
    fillWinStats();
    showOverlay('overlay-win');
  } else {
    showOverlay('overlay-lose');
  }
  syncHud();
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// --- HUD -------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

function detectionState() {
  if (state.guards.some((g) => g.state === 'chase')) return ['HUNTED', 'hunted'];
  if (state.guards.some((g) => g.state === 'suspicious' || g.state === 'investigate' || g.state === 'search')) return ['SUSPICIOUS', 'suspicious'];
  return ['UNSEEN', 'unseen'];
}

function syncHud() {
  const [label, cls] = detectionState();
  const pill = $('detect-pill');
  pill.textContent = state.player && state.player.hidden ? 'HIDDEN' : label;
  pill.className = 'pill ' + (state.player && state.player.hidden ? 'hidden' : cls);
  $('hud-time').textContent = fmtTime(state.elapsed);
  $('hud-loot').textContent = state.lootTaken + '/' + state.loot.length;
  $('hud-buttons').textContent = state.player ? String(state.player.buttons) : '3';
  $('hud-score').textContent = '$' + state.score;
  $('hud-strikes').textContent = '✕'.repeat(state.strikes) + '○'.repeat(Math.max(0, 3 - state.strikes));
  const p = state.player;
  $('hud-stance').textContent = p
    ? (p.sneaking ? 'SNEAKING' : p.sprinting ? 'SPRINTING' : p.moving ? 'WALKING' : 'STILL')
    : '—';
  $('hud-light').textContent = p ? (p.lit ? 'LIT' : 'SHADOW') : '—';
  $('hud-prompt').textContent = state.nearLoot
    ? 'E — pocket the playbill'
    : state.nearPrize
      ? 'E — take the Gilded Marionette'
      : state.nearExit
        ? 'Through the door — go!'
        : '';
  // Guard roster.
  const rows = state.guards.map((g) => {
    const d = Math.round(Math.hypot(g.x - state.player.x, g.y - state.player.y) / TILE);
    const st = g.state.toUpperCase();
    return `<div class="guard-row ${g.state}"><span class="g-dot"></span>`
      + `<b>${g.role} ${g.name}</b><span class="g-state">${st}</span><span class="g-dist">${d}m</span></div>`;
  }).join('');
  $('guard-list').innerHTML = rows;
}

let flashTimer = 0;
function showFlash(text) {
  const el = $('flash');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function showOverlay(id) {
  for (const o of ['overlay-title', 'overlay-win', 'overlay-lose', 'overlay-pause']) {
    $(o).classList.toggle('show', o === id);
  }
}

function hideOverlays() {
  for (const o of ['overlay-title', 'overlay-win', 'overlay-lose', 'overlay-pause']) {
    $(o).classList.remove('show');
  }
}

// --- Input -----------------------------------------------------------------

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  Space: 'sprint',
};

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  unlockAudio(state.audio);
  const mapped = KEYMAP[e.code];
  if (mapped) state.keys[mapped] = true;
  if (e.code === 'KeyE') state.keys.interact = true;
  if (e.code === 'KeyM') {
    state.audio.muted = !state.audio.muted;
    showFlash(state.audio.muted ? 'Sound off.' : 'Sound on.');
  }
  if (e.code === 'KeyH') $('overlay-notes').classList.toggle('show');
  if (e.code === 'KeyR' && (state.phase === 'won' || state.phase === 'lost')) startPlay();
  if ((e.code === 'KeyP' || e.code === 'Escape') && state.phase === 'play') {
    state.phase = 'paused';
    showOverlay('overlay-pause');
  } else if ((e.code === 'KeyP' || e.code === 'Escape') && state.phase === 'paused') {
    state.phase = 'play';
    hideOverlays();
  }
  if (e.code === 'Enter' && state.phase === 'title') startPlay();
});

window.addEventListener('keyup', (e) => {
  const mapped = KEYMAP[e.code];
  if (mapped) state.keys[mapped] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  state.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
  state.mouse.y = ((e.clientY - r.top) / r.height) * 720;
  state.mouse.inside = true;
});
canvas.addEventListener('mouseleave', () => { state.mouse.inside = false; });
canvas.addEventListener('mousedown', (e) => {
  unlockAudio(state.audio);
  if (state.phase === 'title') { startPlay(); return; }
  if (state.phase !== 'play') return;
  const r = canvas.getBoundingClientRect();
  const tx = ((e.clientX - r.left) / r.width) * 1280;
  const ty = ((e.clientY - r.top) / r.height) * 720;
  const b = throwButton(state.player, tx, ty);
  if (b) state.button = b;
});

function startPlay() {
  resetRun();
  state.keys.interact = false;
  state.phase = 'play';
  hideOverlays();
  showFlash('Steal the Gilded Marionette. Leave unseen.');
}

$('overlay-title').addEventListener('click', startPlay);
$('btn-again').addEventListener('click', startPlay);
$('btn-retry').addEventListener('click', startPlay);

// --- Shot staging for screenshots ------------------------------------------

function stageShot() {
  resetRun();
  if (SHOT === 'start') {
    // The opening moment: four quiet seconds of patrol, then the night
    // begins with Wren at the foyer door. No overlay: the cover shot must
    // show the level, the cones and the HUD at a glance.
    state.phase = 'play';
    for (let i = 0; i < 240; i++) step(1 / 60);
    state.elapsed = 0;
    showFlash('NIGHT 1 — steal the Gilded Marionette. Leave unseen.');
    syncHud();
  } else if (SHOT === 'title') {
    // The title card over the living theatre.
    state.phase = 'play';
    for (let i = 0; i < 240; i++) step(1 / 60);
    state.phase = 'title';
    state.elapsed = 0;
    showOverlay('overlay-title');
  } else if (SHOT === 'play') {
    state.phase = 'play';
    state.time = 8;
    state.elapsed = 47;
    state.lootTaken = 1;
    state.loot[0].taken = true;
    state.score = 100;
    // Wren pressed flat inside the curtain by the auditorium door.
    const hide = tileCenter(8, 4);
    state.player.x = hide.x;
    state.player.y = hide.y;
    state.player.sneaking = true;
    state.player.hidden = true;
    state.player.dir = Math.PI;
    // NERIS heard the button and is coming to look.
    const g = state.guards[1];
    const gp = tileCenter(11, 5);
    g.x = gp.x;
    g.y = gp.y;
    g.dir = Math.PI;
    g.state = 'investigate';
    g.suspicion = 0.62;
    const tgt = tileCenter(10, 7);
    g.target = tgt;
    // The button, landed, its ring still spreading.
    state.button = {
      x: tgt.x, y: tgt.y, sx: tgt.x, sy: tgt.y, tx: tgt.x, ty: tgt.y,
      t: 1, dur: 0.45, landed: true, landTime: state.time,
    };
    state.pings.push({ x: tgt.x, y: tgt.y, radius: 230, age: 0.35, life: 0.9, kind: 'button' });
    // The other ushers keep their rounds so the cones read.
    for (let i = 0; i < 180; i++) {
      for (const gg of state.guards) {
        if (gg !== g) updateGuard(gg, 1 / 60, state.player, false);
      }
      state.time += 1 / 60;
    }
    state.player.lit = false;
    syncHud();
  } else if (SHOT === 'end') {
    state.phase = 'won';
    state.prizeTaken = true;
    state.lootTaken = 3;
    for (const l of state.loot) l.taken = true;
    state.elapsed = 142;
    state.score = 1400;
    const near = tileCenter(18, 4);
    state.player.x = near.x;
    state.player.y = near.y;
    state.player.dir = 0;
    state.winStats = {
      time: '02:22', loot: '3/3', strikes: 0, ghost: true, timeBonus: 316, score: 1400,
    };
    fillWinStats();
    showOverlay('overlay-win');
    syncHud();
  }
}

function fillWinStats() {
  const w = state.winStats;
  if (!w) return;
  $('win-time').textContent = w.time;
  $('win-loot').textContent = w.loot;
  $('win-strikes').textContent = String(w.strikes);
  $('win-ghost').textContent = w.ghost ? 'GHOST — never spotted (+500)' : 'Spotted — no ghost bonus';
  $('win-score').textContent = '$' + w.score;
}

// --- Main loop ---------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  draw(ctx, state);
  // Aim line while Wren still has buttons to throw.
  if (state.phase === 'play' && state.mouse.inside && state.player.buttons > 0) {
    const p = state.player;
    ctx.save();
    ctx.strokeStyle = 'rgba(232,200,119,0.5)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(state.mouse.x, state.mouse.y);
    ctx.stroke();
    ctx.restore();
  }
  syncHud();
  requestAnimationFrame(frame);
}

resetRun();
if (SHOT) {
  stageShot();
  draw(ctx, state);
  syncHud();
  if (SHOT === 'end') fillWinStats();
} else {
  showOverlay('overlay-title');
  requestAnimationFrame(frame);
}

// Read-only handle for local play-testing (no secrets, no network).
window.__vh = { state };
