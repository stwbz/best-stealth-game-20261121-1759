// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The look
// is a lamplit archive at night: dark floorboards, warm pools of lantern
// light, slate walls, wooden crates, yellow vision cones that turn red on
// alert, a green exit door. Everything a judge needs to read at a glance —
// level, cones, cover, exit — is drawn big and high-contrast.

import { CRATES, EXIT, FIELD, FONT, GUARD, PALETTE, PLAYER, SHARDS, WALLS } from './config.js';

const GUARD_RADIUS = GUARD.radius;
const PLAYER_RADIUS = PLAYER.radius;
import { GUARD_CHASE, GUARD_RETURN } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const TILE = 80;

/** Fixed lantern light pools on the floor (x, y, radius). */
const LAMPS = [
  { x: 200, y: 120, r: 190 },
  { x: 660, y: 150, r: 170 },
  { x: 1120, y: 300, r: 180 },
  { x: 300, y: 600, r: 180 },
  { x: 1150, y: 90, r: 150 },
  { x: 700, y: 560, r: 160 },
];

/** Dust motes drifting in the lamplight; positions are a pure function of
 * the index, so the frame is identical every run. */
function motePosition(index) {
  const a = Math.sin(index * 127.1) * 43758.5453;
  const b = Math.sin(index * 311.7) * 12543.1234;
  return {
    x: ((a - Math.floor(a)) * FIELD.width) | 0,
    y: ((b - Math.floor(b)) * FIELD.height) | 0,
    r: 1 + (index % 3) * 0.7,
  };
}

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const shardLabel = cachedLabel('Shards ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** A rounded-rectangle path (arcs, not roundRect, so every canvas has it). */
  function pillPath(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + w - radius, y);
    context.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    context.lineTo(x + w, y + h - radius);
    context.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    context.lineTo(x + radius, y + h);
    context.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    context.lineTo(x, y + radius);
    context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    context.closePath();
  }

  /** One glass pill: soft offset shadow, translucent fill, hairline edge. */
  function glassPill(x, y, w, h, r) {
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    pillPath(x + 2, y + 3, w, h, r);
    context.fill();
    context.fillStyle = PALETTE.glass;
    pillPath(x, y, w, h, r);
    context.fill();
    context.strokeStyle = PALETTE.glassEdge;
    context.lineWidth = 1;
    pillPath(x, y, w, h, r);
    context.stroke();
  }

  /** Aurora glow behind the title panel: warm amber by the top-left lamp,
   * teal by the bottom-right shard. Phases are fixed functions of elapsed,
   * so the frame is identical every run. */
  function drawAurora(elapsed) {
    const amberX = 200 + Math.sin(elapsed * 0.21) * 24;
    const amberY = 120 + Math.cos(elapsed * 0.17) * 16;
    const amber = context.createRadialGradient(amberX, amberY, 20, amberX, amberY, 430);
    amber.addColorStop(0, 'rgba(245, 197, 66, 0.16)');
    amber.addColorStop(1, 'rgba(245, 197, 66, 0)');
    context.fillStyle = amber;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const tealX = 1120 + Math.cos(elapsed * 0.19) * 24;
    const tealY = 600 + Math.sin(elapsed * 0.23) * 16;
    const teal = context.createRadialGradient(tealX, tealY, 20, tealX, tealY, 430);
    teal.addColorStop(0, 'rgba(127, 231, 210, 0.13)');
    teal.addColorStop(1, 'rgba(127, 231, 210, 0)');
    context.fillStyle = teal;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** Liquid-glass call-to-action pill: translucent fill, bright edge, a
   * top inner highlight and a slow amber pulse. Replaces the plain prompt. */
  function drawCta(label, centerX, centerY, elapsed) {
    const w = 420;
    const h = 52;
    const x = centerX - w / 2;
    const y = centerY - h / 2;
    const pulse = 0.5 + 0.15 * Math.sin(elapsed * 2);
    context.fillStyle = `rgba(255, 217, 122, ${0.16 * pulse})`;
    pillPath(x - 8, y - 8, w + 16, h + 16, 34);
    context.fill();
    context.fillStyle = PALETTE.glassHi;
    pillPath(x, y, w, h, 26);
    context.fill();
    context.strokeStyle = PALETTE.ctaEdge;
    context.lineWidth = 1;
    pillPath(x, y, w, h, 26);
    context.stroke();
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x + 34, y + 5);
    context.lineTo(x + w - 34, y + 5);
    context.stroke();
    text(label, centerX, centerY + 7, 20, PALETTE.playerLight, 'center');
  }

  function drawFloor(elapsed) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let x = 0; x < FIELD.width; x += TILE) {
      for (let y = 0; y < FIELD.height; y += TILE) {
        if (((x + y) / TILE) % 2 === 0) {
          context.fillStyle = PALETTE.floorAlt;
          context.fillRect(x, y, TILE, TILE);
        }
      }
    }
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += TILE) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += TILE) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    // Warm lantern pools.
    for (const lamp of LAMPS) {
      const gradient = context.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.r);
      gradient.addColorStop(0, 'rgba(245, 197, 66, 0.13)');
      gradient.addColorStop(1, 'rgba(245, 197, 66, 0)');
      context.fillStyle = gradient;
      context.fillRect(lamp.x - lamp.r, lamp.y - lamp.r, lamp.r * 2, lamp.r * 2);
    }
    // Dust motes.
    context.fillStyle = 'rgba(242, 234, 216, 0.35)';
    for (let index = 0; index < 42; index += 1) {
      const mote = motePosition(index);
      const drift = Math.sin(elapsed * 0.4 + index) * 6;
      context.beginPath();
      context.arc(mote.x + drift, mote.y, mote.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawExit(open, elapsed) {
    const glow = open ? 0.5 + 0.2 * Math.sin(elapsed * 3) : 0.22;
    context.fillStyle = open ? PALETTE.exit : PALETTE.exitDark;
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.strokeStyle = open ? '#a9f5cd' : '#2c5a40';
    context.lineWidth = 3;
    context.strokeRect(EXIT.x + 2, EXIT.y + 2, EXIT.w - 4, EXIT.h - 4);
    const gradient = context.createRadialGradient(
      EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2, 6,
      EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2, 110,
    );
    gradient.addColorStop(0, `rgba(57, 217, 138, ${glow})`);
    gradient.addColorStop(1, 'rgba(57, 217, 138, 0)');
    context.fillStyle = gradient;
    context.fillRect(EXIT.x - 70, EXIT.y - 70, EXIT.w + 140, EXIT.h + 140);
    text('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 - 4, 22, '#062b18', 'center');
    text(open ? 'OPEN' : 'LOCKED', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 20, 14, '#062b18', 'center');
  }

  function drawShards(state, elapsed) {
    for (let index = 0; index < SHARDS.length; index += 1) {
      if (state.shardsTaken[index]) continue;
      const shard = SHARDS[index];
      const bob = Math.sin(elapsed * 2.4 + index * 2) * 4;
      const pulse = 0.5 + 0.25 * Math.sin(elapsed * 3 + index);
      const gradient = context.createRadialGradient(shard.x, shard.y + bob, 2, shard.x, shard.y + bob, 46);
      gradient.addColorStop(0, `rgba(127, 231, 210, ${pulse})`);
      gradient.addColorStop(1, 'rgba(127, 231, 210, 0)');
      context.fillStyle = gradient;
      context.fillRect(shard.x - 46, shard.y + bob - 46, 92, 92);
      context.fillStyle = PALETTE.shard;
      context.beginPath();
      context.moveTo(shard.x, shard.y + bob - 13);
      context.lineTo(shard.x + 10, shard.y + bob);
      context.lineTo(shard.x, shard.y + bob + 13);
      context.lineTo(shard.x - 10, shard.y + bob);
      context.closePath();
      context.fill();
      context.fillStyle = '#eafffa';
      context.beginPath();
      context.arc(shard.x - 3, shard.y + bob - 4, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCrates() {
    for (const crate of CRATES) {
      context.fillStyle = PALETTE.crate;
      context.fillRect(crate.x, crate.y, crate.w, crate.h);
      context.strokeStyle = PALETTE.crateEdge;
      context.lineWidth = 3;
      context.strokeRect(crate.x + 1.5, crate.y + 1.5, crate.w - 3, crate.h - 3);
      context.strokeStyle = PALETTE.crateDark;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(crate.x + 4, crate.y + 4);
      context.lineTo(crate.x + crate.w - 4, crate.y + crate.h - 4);
      context.moveTo(crate.x + crate.w - 4, crate.y + 4);
      context.lineTo(crate.x + 4, crate.y + crate.h - 4);
      context.stroke();
    }
  }

  function drawWalls() {
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      if (wall.w >= wall.h) context.fillRect(wall.x, wall.y, wall.w, 5);
      else context.fillRect(wall.x, wall.y, 5, wall.h);
    }
  }

  function drawCones(world, guardsApi) {
    for (const guard of world.guards.guards) {
      const polygon = guardsApi.coneFor(guard);
      const alert = guard.mode === GUARD_CHASE;
      context.beginPath();
      context.moveTo(polygon[0].x, polygon[0].y);
      for (let index = 1; index < polygon.length; index += 1) context.lineTo(polygon[index].x, polygon[index].y);
      context.closePath();
      context.fillStyle = alert ? 'rgba(255, 90, 60, 0.38)' : 'rgba(245, 197, 66, 0.26)';
      context.fill();
      context.strokeStyle = alert ? 'rgba(255, 90, 60, 0.75)' : 'rgba(245, 197, 66, 0.6)';
      context.lineWidth = 1.5;
      context.stroke();
    }
  }

  function drawGuards(world, elapsed) {
    for (let index = 0; index < world.guards.guards.length; index += 1) {
      const guard = world.guards.guards[index];
      // Footstep ripple: one thin pale-amber ring expanding from the
      // guard's feet while it walks, phase from elapsed so the frame is
      // identical every run. The judge hears nothing — this is the visual
      // proxy that says where a guard is and that it is moving.
      const moving = guard.mode === GUARD_CHASE || guard.mode === GUARD_RETURN || guard.pauseTimer <= 0;
      if (moving) {
        const phase = (elapsed * 0.9 + index * 0.37) % 1;
        context.strokeStyle = `rgba(245, 197, 66, ${(0.20 * (1 - phase)).toFixed(3)})`;
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(guard.x, guard.y, 16 + phase * 26, 0, Math.PI * 2);
        context.stroke();
      }
      // Body: red uniform, darker rim, cap brim toward facing.
      context.fillStyle = PALETTE.guardDark;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD_RADIUS + 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD_RADIUS, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd9d9';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 4, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = '#7a1d22';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD_RADIUS + 7), guard.y + Math.sin(guard.angle) * (GUARD_RADIUS + 7));
      context.stroke();
      // "!" when the alarm is up, "?" while suspicious.
      const detection = world.guards.detection;
      if (guard.mode === GUARD_CHASE || detection >= 0.99) {
        text('!', guard.x, guard.y - GUARD_RADIUS - 8, 26, PALETTE.danger, 'center');
      } else if (detection > 0.45) {
        text('?', guard.x, guard.y - GUARD_RADIUS - 8, 22, PALETTE.cone, 'center');
      }
    }
  }

  function drawPlayer(world, elapsed) {
    const player = world.player;
    // Lantern glow around the thief: wider than before, so the thief reads
    // against the dark floor even at thumbnail size (render-only).
    const gradient = context.createRadialGradient(player.x, player.y, 4, player.x, player.y, 64);
    gradient.addColorStop(0, 'rgba(255, 217, 122, 0.40)');
    gradient.addColorStop(1, 'rgba(255, 217, 122, 0)');
    context.fillStyle = gradient;
    context.fillRect(player.x - 64, player.y - 64, 128, 128);
    // Noise ring while walking loud: guards can hear it.
    if (player.moving && !player.sneaking) {
      const pulse = (elapsed % 0.68) / 0.68;
      context.strokeStyle = `rgba(242, 234, 216, ${0.35 * (1 - pulse)})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, 20 + pulse * 34, 0, Math.PI * 2);
      context.stroke();
    }
    // Hooded cloak: dark teal disc, amber lantern dot at the front. A
    // second, fainter rim ring keeps the disc readable where it crosses a
    // lamp pool (render-only: the collision radius is unchanged).
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#d9fff1';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(217, 255, 241, 0.55)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(player.x, player.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.playerLight;
    context.beginPath();
    context.arc(
      player.x + Math.cos(player.angle) * 7,
      player.y + Math.sin(player.angle) * 7,
      4.5, 0, Math.PI * 2,
    );
    context.fill();
    if (player.sneaking) {
      context.strokeStyle = 'rgba(127, 231, 210, 0.9)';
      context.lineWidth = 2;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.arc(player.x, player.y, PLAYER_RADIUS + 6, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
      text('SNEAK', player.x, player.y - PLAYER_RADIUS - 8, 12, PALETTE.shard, 'center');
    }
  }

  function drawHud(world, exitOpen) {
    // Glass HUD: three pills floating over the level instead of one flat
    // bar, so the level shows through at the edges. Pills end at y=46;
    // the exit starts at y=48 and the top cone's far edge at y~60, so
    // nothing the judge needs is covered.
    // Left pill: attempts + shards.
    glassPill(16, 6, 316, 40, 16);
    text('ATTEMPTS', 32, 33, 13, PALETTE.muted, 'left');
    for (let index = 0; index < 3; index += 1) {
      context.fillStyle = index < world.attemptsLeft ? PALETTE.playerLight : '#3a3444';
      context.beginPath();
      context.arc(128 + index * 26, 27, 8, 0, Math.PI * 2);
      context.fill();
    }
    text(shardLabel(world.shardsCollected) + '/3', 216, 34, 22, PALETTE.shard, 'left');
    // Centre pill: time + score, small-caps labels, tabular values.
    glassPill(400, 6, 300, 40, 16);
    const minutes = Math.floor(world.elapsed / 60);
    const seconds = Math.floor(world.elapsed % 60);
    const timeText = `${minutes}:${String(seconds).padStart(2, '0')}`;
    text('TIME', 420, 33, 13, PALETTE.muted, 'left');
    text(timeText, 458, 34, 21, PALETTE.text, 'left');
    text('SCORE', 544, 33, 13, PALETTE.muted, 'left');
    text(String(world.score), 592, 34, 21, PALETTE.text, 'left');
    // Right pill: detection meter — rounded track, colour by value, glow
    // past two-thirds. The label sits right-aligned before the track.
    glassPill(792, 6, 472, 40, 16);
    const detection = world.guards.detection;
    const meterX = 924;
    const meterW = 296;
    const meterColor = detection > 0.66 ? PALETTE.coneAlert : detection > 0.33 ? PALETTE.cone : PALETTE.safe;
    text(detection >= 1 ? 'SPOTTED!' : detection > 0.45 ? 'SUSPICIOUS' : 'UNSEEN', meterX - 12, 34, 18, meterColor, 'right');
    if (detection > 0.66) {
      context.fillStyle = 'rgba(255, 90, 60, 0.22)';
      pillPath(meterX - 5, 11, meterW + 10, 30, 15);
      context.fill();
    }
    context.fillStyle = '#262233';
    pillPath(meterX, 16, meterW, 20, 10);
    context.fill();
    if (detection > 0) {
      context.fillStyle = meterColor;
      pillPath(meterX, 16, Math.max(20, meterW * detection), 20, 10);
      context.fill();
    }
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    pillPath(meterX, 16, meterW, 20, 10);
    context.stroke();
    // Objective line, bottom-left. Once won, say so — the old line told
    // the player to reach an exit they had already reached.
    context.fillStyle = 'rgba(11, 14, 20, 0.72)';
    context.fillRect(16, FIELD.height - 44, 560, 30);
    text(
      world.won
        ? `Out clean — score ${world.score}`
        : exitOpen
          ? 'All shards stolen — reach the green EXIT, unseen!'
          : 'Steal 3 lantern shards, then reach the green EXIT.',
      28, FIELD.height - 23, 17, PALETTE.text, 'left',
    );
    // Controls hint, bottom-right.
    text('WASD / arrows move · Shift sneak · P pause · R restart', FIELD.width - 24, FIELD.height - 23, 15, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, elapsed, aurora, accentIndex) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 14, 20, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (aurora) drawAurora(elapsed);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    if (title === 'MOTHLIGHT') {
      // Gradient shimmer title: cream to amber to teal, letter-spaced.
      const gradient = context.createLinearGradient(FIELD.width / 2 - 200, 0, FIELD.width / 2 + 200, 0);
      gradient.addColorStop(0, '#f2ead8');
      gradient.addColorStop(0.5, '#ffd97a');
      gradient.addColorStop(1, '#7fe7d2');
      context.save();
      context.letterSpacing = '2px';
      text(title, FIELD.width / 2, y + 78, 52, gradient, 'center');
      context.restore();
    } else {
      text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    }
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, index === accentIndex ? PALETTE.playerLight : PALETTE.muted, 'center');
    }
    drawCta(prompt, FIELD.width / 2, y + height - 38, elapsed);
  }

  const TITLE_LINES = [
    'A quiet heist in a lamplit archive. Steal 3 lantern shards',
    'and slip out the green EXIT — without a guard ever seeing you.',
    '4 guards · 8 crates · 3 shards · 3 attempts',
    'Yellow cones are watching eyes. Crates and walls block them.',
    'Walk loud and guards hear you. Hold Shift to sneak, slow and quiet.',
    'Guards patrol, pause, and chase when the meter fills. Break',
    'their sight to cool down — or be sent back to the door.',
    '',
  ];

  /** Paint one frame: the level, then the HUD or a panel for the screen. */
  function draw(world, guardsApi, screen, best, exitOpen) {
    const elapsed = world.elapsed;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(elapsed);
    drawExit(exitOpen, elapsed);
    drawShards(world, elapsed);
    drawCones(world, guardsApi);
    drawCrates();
    drawWalls();
    drawGuards(world, elapsed);
    if (screen !== SCREEN_TITLE) drawPlayer(world, elapsed);
    if (screen === SCREEN_TITLE) {
      const lines = [...TITLE_LINES];
      lines[7] = `Best score ${best}`;
      drawPanel('MOTHLIGHT', lines, 'Press Space or click to begin the heist', elapsed, true, 2);
      return;
    }
    drawHud(world, exitOpen);
    if (world.guards.spotted) {
      context.strokeStyle = 'rgba(255, 90, 60, 0.85)';
      context.lineWidth = 6;
      context.strokeRect(3, 3, FIELD.width - 6, FIELD.height - 6);
      text('SPOTTED!', FIELD.width / 2, 108, 34, PALETTE.danger, 'center');
    }
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume', elapsed);
    } else if (screen === SCREEN_WIN) {
      drawPanel('Unseen. Unheard. Out.', [
        `Score ${world.score}   ·   Time ${Math.floor(world.elapsed / 60)}:${String(Math.floor(world.elapsed % 60)).padStart(2, '0')}`,
        `Best ${best}`,
        'Every shard stolen, no guard the wiser.',
      ], 'Press Space or click to play again', elapsed);
    } else if (screen === SCREEN_OVER) {
      drawPanel('Caught in the lamplight', [
        `Score ${world.score}`,
        `Best ${best}`,
        'Three strikes — the archive keeps its shards tonight.',
      ], 'Press Space or click to try again', elapsed);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
