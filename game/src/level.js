// The level's geometry: walls and crates as rectangles, and the two
// line-of-sight questions the stealth rules depend on. A guard's vision cone
// is a fan of rays; each ray stops at the first wall or crate it hits, so
// cover really does hide the player. All of it is pure geometry — no drawing
// and no browser in here — so the world and the renderer share it.

import { CRATES, WALLS } from './config.js';

/** Every solid rectangle in the level: walls first, then crates. */
export const SOLIDS = [...WALLS, ...CRATES];

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** True when the point is inside any solid (a wall or a crate). */
export function pointBlocked(x, y) {
  for (const rect of SOLIDS) if (pointInRect(x, y, rect)) return true;
  return false;
}

/**
 * Distance along a ray from (x, y) in direction (dx, dy) to the first solid
 * it hits, or Infinity when it hits nothing within maxDistance. Slab test
 * per rectangle; the nearest hit wins.
 */
export function rayDistance(x, y, dx, dy, maxDistance) {
  let best = Infinity;
  for (const rect of SOLIDS) {
    const t = rayRect(x, y, dx, dy, rect);
    if (t !== null && t < best && t <= maxDistance) best = t;
  }
  return best;
}

function rayRect(x, y, dx, dy, rect) {
  let tMin = 0;
  let tMax = Infinity;
  const mins = [rect.x, rect.y];
  const maxs = [rect.x + rect.w, rect.y + rect.h];
  const origins = [x, y];
  const dirs = [dx, dy];
  for (let axis = 0; axis < 2; axis += 1) {
    const dir = dirs[axis];
    const origin = origins[axis];
    if (Math.abs(dir) < 1e-9) {
      if (origin < mins[axis] || origin > maxs[axis]) return null;
    } else {
      let t1 = (mins[axis] - origin) / dir;
      let t2 = (maxs[axis] - origin) / dir;
      if (t1 > t2) {
        const swap = t1;
        t1 = t2;
        t2 = swap;
      }
      if (t1 > tMin) tMin = t1;
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return null;
    }
  }
  if (tMax < 0) return null;
  return tMin >= 0 ? tMin : 0;
}

/**
 * True when the straight segment from (x1, y1) to (x2, y2) is clear of every
 * solid — the guard can actually see the player, not just face their way.
 */
export function hasLineOfSight(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return true;
  const hit = rayDistance(x1, y1, dx / distance, dy / distance, distance);
  return hit === Infinity;
}

/**
 * The vision cone as a polygon: the guard's eye plus one point per sampled
 * ray, each ray cut short by the first wall or crate it meets. The renderer
 * fills this polygon; the guards module tests the player against it.
 */
export function conePolygon(eyeX, eyeY, angle, range, halfAngle) {
  const points = [{ x: eyeX, y: eyeY }];
  const steps = 18;
  for (let step = 0; step <= steps; step += 1) {
    const rayAngle = angle - halfAngle + (2 * halfAngle * step) / steps;
    const dx = Math.cos(rayAngle);
    const dy = Math.sin(rayAngle);
    const hit = rayDistance(eyeX, eyeY, dx, dy, range);
    const length = hit === Infinity ? range : hit;
    points.push({ x: eyeX + dx * length, y: eyeY + dy * length });
  }
  return points;
}

/**
 * Move a circle (centre x, y, radius r) by (dx, dy), sliding along solids
 * instead of passing through them. Returns the new centre.
 */
export function moveCircle(x, y, r, dx, dy) {
  let nextX = x + dx;
  let nextY = y + dy;
  for (const rect of SOLIDS) {
    const closestX = Math.max(rect.x, Math.min(nextX, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(nextY, rect.y + rect.h));
    const ox = nextX - closestX;
    const oy = nextY - closestY;
    const distSq = ox * ox + oy * oy;
    if (distSq < r * r) {
      if (distSq > 1e-9) {
        const dist = Math.sqrt(distSq);
        nextX = closestX + (ox / dist) * r;
        nextY = closestY + (oy / dist) * r;
      } else {
        // Centre inside the rectangle: push out along the smallest overlap.
        const left = nextX - rect.x;
        const right = rect.x + rect.w - nextX;
        const top = nextY - rect.y;
        const bottom = rect.y + rect.h - nextY;
        const min = Math.min(left, right, top, bottom);
        if (min === left) nextX = rect.x - r;
        else if (min === right) nextX = rect.x + rect.w + r;
        else if (min === top) nextY = rect.y - r;
        else nextY = rect.y + rect.h + r;
      }
    }
  }
  return { x: nextX, y: nextY };
}
