// The game's rules and state, with no drawing and no browser in it: the
// player, the lantern shards, the exit, attempts and the timer. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, screens) without the world knowing about them.
// Guards live in guards.js; this file owns everything else.

import { ATTEMPTS, EXIT, GUARD, GUARDS, PLAYER, SHARD_POINTS, SHARDS, TIME_BONUS_PER_SECOND } from './config.js';
import { createGuards, EVENT_CAUGHT, EVENT_ESCAPED, EVENT_SPOTTED } from './guards.js';
import { moveCircle, pointInRect } from './level.js';

export const EVENT_SHARD = 1;
export const EVENT_WIN = 2;
export const EVENT_LOSE = 4;
export const EVENT_CAUGHT_ATTEMPT = 8;
export const EVENT_SPOTTED_FLAG = 16;
export const EVENT_ESCAPED_FLAG = 32;
export const EVENT_FOOTSTEP = 64;

const SHARD_RADIUS = 30;
const WIN_TIME_PAR = 240;

export function createWorld() {
  const guards = createGuards(GUARDS);
  const player = {
    x: PLAYER.start.x,
    y: PLAYER.start.y,
    angle: -Math.PI / 2,
    sneaking: false,
    moving: false,
    stepTimer: 0,
  };
  const state = {
    player,
    guards: guards.state,
    shardsTaken: SHARDS.map(() => false),
    shardsCollected: 0,
    attemptsLeft: ATTEMPTS,
    elapsed: 0,
    score: 0,
    won: false,
    lost: false,
  };

  function reset() {
    player.x = PLAYER.start.x;
    player.y = PLAYER.start.y;
    player.angle = -Math.PI / 2;
    player.sneaking = false;
    player.moving = false;
    player.stepTimer = 0;
    state.shardsTaken = SHARDS.map(() => false);
    state.shardsCollected = 0;
    state.attemptsLeft = ATTEMPTS;
    state.elapsed = 0;
    state.score = 0;
    state.won = false;
    state.lost = false;
    guards.reset();
  }

  function respawnAfterCaught() {
    player.x = PLAYER.start.x;
    player.y = PLAYER.start.y;
    player.angle = -Math.PI / 2;
    player.sneaking = false;
    player.moving = false;
    guards.reset();
  }

  /** True once every shard is pocketed: the exit door swings open. */
  function exitOpen() {
    return state.shardsCollected >= SHARDS.length;
  }

  /**
   * One fixed step. `steering` is {x, y, sneaking} from input.js. Returns
   * EVENT_* flags for the caller (sounds and screen changes).
   */
  function step(dt, steering) {
    let events = 0;
    if (state.won || state.lost) return events;
    state.elapsed += dt;

    const speed = steering.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = steering.x !== 0 || steering.y !== 0;
    player.moving = moving;
    player.sneaking = steering.sneaking;
    if (moving) {
      const moved = moveCircle(player.x, player.y, PLAYER.radius, steering.x * speed * dt, steering.y * speed * dt);
      player.x = moved.x;
      player.y = moved.y;
      player.angle = Math.atan2(steering.y, steering.x);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = steering.sneaking ? 0.52 : 0.34;
        events |= EVENT_FOOTSTEP;
      }
    }

    // Walking loud near a guard is heard: the meter creeps up even unseen.
    const nearest = guards.nearestGuardDistance(player.x, player.y);
    const heard = moving && !steering.sneaking && nearest < GUARD.hearRadius;
    const guardEvents = guards.step(dt, player, heard);
    if (guardEvents & EVENT_SPOTTED) events |= EVENT_SPOTTED_FLAG;
    if (guardEvents & EVENT_ESCAPED) events |= EVENT_ESCAPED_FLAG;
    if (guardEvents & EVENT_CAUGHT) {
      state.attemptsLeft -= 1;
      if (state.attemptsLeft <= 0) {
        state.lost = true;
        events |= EVENT_LOSE;
      } else {
        events |= EVENT_CAUGHT_ATTEMPT;
        respawnAfterCaught();
      }
      return events;
    }

    for (let index = 0; index < SHARDS.length; index += 1) {
      if (state.shardsTaken[index]) continue;
      const shard = SHARDS[index];
      if (Math.hypot(shard.x - player.x, shard.y - player.y) < SHARD_RADIUS) {
        state.shardsTaken[index] = true;
        state.shardsCollected += 1;
        state.score += SHARD_POINTS;
        events |= EVENT_SHARD;
      }
    }

    if (exitOpen() && pointInRect(player.x, player.y, EXIT)) {
      state.won = true;
      state.score += Math.max(0, Math.round(WIN_TIME_PAR - state.elapsed)) * TIME_BONUS_PER_SECOND;
      events |= EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, guards, reset, step, exitOpen };
}
