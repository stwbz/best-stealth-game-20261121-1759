// The guards: patrol loops, vision cones, the detection meter and the
// chase. A guard walks its waypoints, pauses at each one and looks around.
// When the player is inside the cone, in line of sight and close enough,
// the shared detection meter rises — faster up close, slower when the player
// sneaks. At full meter the guard gives chase; lose the guard's sight for a
// while and it goes back to patrol, still suspicious. Catching the player
// costs an attempt. No drawing here; render.js draws the cones and guards.

import { DETECTION, GUARD } from './config.js';
import { conePolygon, hasLineOfSight, moveCircle } from './level.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_CHASE = 'chase';
export const GUARD_RETURN = 'return';

export const EVENT_SPOTTED = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_ESCAPED = 4;

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDifference(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function createGuards(definitions) {
  const guards = definitions.map((definition, index) => ({
    name: definition.name,
    waypoints: definition.waypoints,
    waypointIndex: index % definition.waypoints.length,
    x: definition.waypoints[index % definition.waypoints.length].x,
    y: definition.waypoints[index % definition.waypoints.length].y,
    angle: 0,
    mode: GUARD_PATROL,
    pauseTimer: 0,
    lostTimer: 0,
    stride: 0,
    stepped: false,
  }));
  // Face along the patrol loop at the start.
  for (const guard of guards) {
    const next = guard.waypoints[(guard.waypointIndex + 1) % guard.waypoints.length];
    guard.angle = angleTo(guard.x, guard.y, next.x, next.y);
  }

  const state = { guards, detection: 0, spotted: false };

  function reset() {
    state.detection = 0;
    state.spotted = false;
    guards.forEach((guard, index) => {
      const definition = definitions[index];
      guard.waypointIndex = index % definition.waypoints.length;
      guard.x = definition.waypoints[guard.waypointIndex].x;
      guard.y = definition.waypoints[guard.waypointIndex].y;
      const next = definition.waypoints[(guard.waypointIndex + 1) % definition.waypoints.length];
      guard.angle = angleTo(guard.x, guard.y, next.x, next.y);
      guard.mode = GUARD_PATROL;
      guard.pauseTimer = 0;
      guard.lostTimer = 0;
      guard.stride = 0;
      guard.stepped = false;
    });
  }

  /** Can this guard see the player right now: in the cone and in sight. */
  function canSee(guard, playerX, playerY) {
    const dx = playerX - guard.x;
    const dy = playerY - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > GUARD.visionRange) return false;
    if (Math.abs(angleDifference(angleTo(guard.x, guard.y, playerX, playerY), guard.angle)) > GUARD.visionHalfAngle) return false;
    return hasLineOfSight(guard.x, guard.y, playerX, playerY);
  }

  function moveToward(guard, targetX, targetY, speed, dt) {
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6) return 0;
    const step = Math.min(distance, speed * dt);
    const moved = moveCircle(guard.x, guard.y, GUARD.radius, (dx / distance) * step, (dy / distance) * step);
    guard.x = moved.x;
    guard.y = moved.y;
    guard.angle = angleTo(guard.x, guard.y, targetX, targetY);
    // A stride is a footstep the player can hear when the guard is near.
    guard.stride += step;
    if (guard.stride >= 34) {
      guard.stride = 0;
      guard.stepped = true;
    }
    return step;
  }

  /**
   * One fixed step. `player` carries x, y and whether it is sneaking and
   * moving; `heard` is set when the player runs loud nearby. Returns events.
   */
  function step(dt, player, heard) {
    let events = 0;
    let anySees = false;
    let nearestSeenDistance = Infinity;

    for (const guard of guards) {
      if (guard.mode === GUARD_PATROL) {
        const target = guard.waypoints[guard.waypointIndex];
        const distance = Math.hypot(target.x - guard.x, target.y - guard.y);
        if (guard.pauseTimer > 0) {
          guard.pauseTimer -= dt;
          // Look around while waiting: slow scan left and right.
          guard.angle += Math.sin(guard.pauseTimer * 2.2) * 0.35 * dt;
        } else if (distance < 6) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
          guard.pauseTimer = GUARD.pauseAtWaypoint;
        } else {
          moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt);
        }
      } else if (guard.mode === GUARD_CHASE) {
        const moved = moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt);
        if (moved === 0) guard.angle = angleTo(guard.x, guard.y, player.x, player.y);
        if (Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.radius + 13) {
          events |= EVENT_CAUGHT;
        }
      } else {
        // Return to the nearest waypoint, then resume the patrol.
        const target = guard.waypoints[guard.waypointIndex];
        const distance = Math.hypot(target.x - guard.x, target.y - guard.y);
        if (distance < 8) {
          guard.mode = GUARD_PATROL;
          guard.pauseTimer = 0.4;
        } else {
          moveToward(guard, target.x, target.y, GUARD.returnSpeed, dt);
        }
      }

      // Footsteps are raised by moveToward (guard.stepped); main.js turns
      // them into sound when the guard is close enough to hear.
      if (canSee(guard, player.x, player.y)) {
        anySees = true;
        const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
        if (distance < nearestSeenDistance) nearestSeenDistance = distance;
        if (guard.mode === GUARD_RETURN) guard.mode = GUARD_PATROL;
        guard.lostTimer = 0;
      } else if (guard.mode === GUARD_CHASE) {
        guard.lostTimer += dt;
        if (guard.lostTimer >= GUARD.chaseGiveUpSeconds) {
          guard.mode = GUARD_RETURN;
          guard.lostTimer = 0;
          events |= EVENT_ESCAPED;
        }
      }
    }

    // The detection meter: rises while any guard sees the player, falls
    // when nobody does. Sneaking buys time; being close costs it fast.
    if (anySees) {
      const near = nearestSeenDistance < DETECTION.nearDistance;
      const rate = player.sneaking
        ? (near ? DETECTION.sneakNear : DETECTION.sneakFar)
        : (near ? DETECTION.walkNear : DETECTION.walkFar);
      state.detection = Math.min(1, state.detection + rate * dt);
    } else {
      state.detection = Math.max(0, state.detection - DETECTION.decayPerSecond * dt);
    }
    if (heard && !anySees) {
      state.detection = Math.min(1, state.detection + DETECTION.heardPerSecond * dt);
    }

    if (state.detection >= 1 && !state.spotted) {
      state.spotted = true;
      for (const guard of guards) {
        if (canSee(guard, player.x, player.y)) guard.mode = GUARD_CHASE;
      }
      // If the spotting guard lost sight in the same step, the nearest
      // guard still gives chase — a spotted player is never ignored.
      if (!guards.some((guard) => guard.mode === GUARD_CHASE)) {
        let nearest = guards[0];
        for (const guard of guards) {
          if (Math.hypot(player.x - guard.x, player.y - guard.y) < Math.hypot(player.x - nearest.x, player.y - nearest.y)) nearest = guard;
        }
        nearest.mode = GUARD_CHASE;
      }
      events |= EVENT_SPOTTED;
    }
    if (state.detection <= 0) state.spotted = false;
    return events;
  }

  /** The cone polygon for one guard, for the renderer. */
  function coneFor(guard) {
    const range = guard.mode === GUARD_CHASE ? GUARD.visionRange * 0.8 : GUARD.visionRange;
    return conePolygon(guard.x, guard.y, guard.angle, range, GUARD.visionHalfAngle);
  }

  function nearestGuardDistance(playerX, playerY) {
    let best = Infinity;
    for (const guard of guards) {
      best = Math.min(best, Math.hypot(playerX - guard.x, playerY - guard.y));
    }
    return best;
  }

  reset();
  return { state, reset, step, canSee, coneFor, nearestGuardDistance };
}
