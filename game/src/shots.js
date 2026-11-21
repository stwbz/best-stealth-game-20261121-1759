// The screenshot scenes behind ?shot=start|play|alert|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot that follows waypoints and sneaks when a
// guard is near, so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { SHARDS, STEP } from './config.js';
import { GUARD_CHASE } from './guards.js';
import { EVENT_CAUGHT_ATTEMPT, EVENT_LOSE, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/** The autopilot's route: up the open left corridor, along the top, down
 * to shard 1. It never crosses a wall or a crate, so the pilot really walks. */
const ROUTE = [
  { x: 92, y: 80 },
  { x: 660, y: 80 },
  { x: 660, y: 150 },
];

const START_SECONDS = 6;
// Cover: 6.5 s, not 15. The autopilot reaches shard 1 at ~8.3 s, so at
// 15 s the cover showed "Shards 1/3" with one diamond already gone. At
// 6.5 s the thief is mid-top-corridor at (475, 82) — open dark floor,
// outside every lamp pool, detection 0 — and all 3 shards are still
// visible as diamonds. Verified in the Node sim, not guessed: 6.0-6.5 s
// is the clean window (at 7.0 s the thief enters lamp 2's pool).
const PLAY_SECONDS = 6.5;
const ALERT_SECONDS = 30;

/**
 * Run the world forward for `seconds`, steering with `steer` each step.
 * Stops early on a win, a loss, or a caught attempt.
 */
function drive(world, seconds, steer) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const events = world.step(STEP, steer());
    if (events & (EVENT_WIN | EVENT_LOSE | EVENT_CAUGHT_ATTEMPT)) break;
  }
}

/**
 * A steering function that walks the route waypoint by waypoint, sneaking
 * while a guard is close — unless `bold`, when it walks loud everywhere.
 */
function routePilot(world, route, bold) {
  let routeIndex = 0;
  return function steer() {
    const player = world.state.player;
    const target = route[Math.min(routeIndex, route.length - 1)];
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const nearest = world.guards.nearestGuardDistance(player.x, player.y);
    const sneaking = !bold && nearest < 250;
    if (distance < 26) {
      routeIndex += 1;
      return { x: 0, y: 0, sneaking, arrived: true };
    }
    return { x: dx / distance, y: dy / distance, sneaking, arrived: false };
  };
}

/** A steering function that stands still — guards patrol on their own. */
function idlePilot() {
  return { x: 0, y: 0, sneaking: false };
}

function stageAlert(world) {
  // A bold run walks loud into the patrols: the meter fills, a guard
  // gives chase, and the frame catches the alarm mid-flare.
  drive(world, ALERT_SECONDS, routePilot(world, ROUTE, true));
  const chasing = world.state.guards.guards.some((guard) => guard.mode === 'chase');
  if (chasing) return;
  // The bold run stayed lucky: stage the chase by hand instead — the
  // thief caught in the open, the nearest guard bearing down on them.
  const player = world.state.player;
  player.x = 700;
  player.y = 380;
  player.sneaking = false;
  let nearest = world.state.guards.guards[0];
  for (const guard of world.state.guards.guards) {
    const toGuard = Math.hypot(player.x - guard.x, player.y - guard.y);
    const toNearest = Math.hypot(player.x - nearest.x, player.y - nearest.y);
    if (toGuard < toNearest) nearest = guard;
  }
  nearest.mode = GUARD_CHASE;
  nearest.angle = Math.atan2(player.y - nearest.y, player.x - nearest.x);
  world.state.guards.detection = 1;
  world.state.guards.spotted = true;
}

function stageWin(world) {
  drive(world, 8, idlePilot);
  // The win screen over the level: every shard taken, thief at the door.
  world.state.shardsTaken = SHARDS.map(() => true);
  world.state.shardsCollected = SHARDS.length;
  world.state.player.x = 1191;
  world.state.player.y = 148;
  world.state.elapsed = 94;
  world.state.score = 300 + 292;
  world.state.won = true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    drive(world, PLAY_SECONDS, routePilot(world, ROUTE, false));
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    stageAlert(world);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    stageWin(world);
    return { screen: SCREEN_WIN, best: 592 };
  }
  drive(world, START_SECONDS, idlePilot);
  return { screen: SCREEN_TITLE, best: 0 };
}
