// The level's geometry: walls and crates as rectangles, and the two
// line-of-sight questions the stealth rules depend on. A guard's vision
// cone is a fan of rays; each ray stops at the first wall or crate it
// hits, so cover really does hide the thief. All of it is pure geometry —
// no drawing and no browser in here — so the world and the renderer share
// it, and the Node sims can run the same rules the browser plays.

import { CRATES, WALLS } from './config.js';

/** Every solid rectangle in the level: walls first, then crates. */
export const SOLIDS = [...WALLS, ...CRATES];

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** True when the point is inside any solid (a wall or a crate). */
export function pointBlocked(x, y) {
  for (const rect of SOLIDS) {
    if (pointInRect(x, y, rect)) return true;
  }
  return false;
}

/**
 * One axis of a slab test: the interval of ray parameters where the ray
 * is inside [min, max] on this axis, or null when it never is. A ray
 * parallel to the axis either rides inside the slab forever or misses it.
 */
function slabInterval(origin, direction, min, max) {
  if (Math.abs(direction) < 1e-9) {
    if (origin < min || origin > max) return null;
    return [-Infinity, Infinity];
  }
  const enter = (min - origin) / direction;
  const leave = (max - origin) / direction;
  return enter <= leave ? [enter, leave] : [leave, enter];
}

/**
 * Ray parameter where the ray from (x, y) along (dx, dy) first enters
 * the rectangle, or null when it never does. The ray enters the box where
 * both axes' intervals overlap; it leaves at the earliest exit.
 */
function rayEntersRect(x, y, dx, dy, rect) {
  const xSlab = slabInterval(x, dx, rect.x, rect.x + rect.w);
  if (xSlab === null) return null;
  const ySlab = slabInterval(y, dy, rect.y, rect.y + rect.h);
  if (ySlab === null) return null;
  const enter = Math.max(xSlab[0], ySlab[0], 0);
  const leave = Math.min(xSlab[1], ySlab[1]);
  if (enter > leave) return null;
  if (leave < 0) return null;
  return enter;
}

/**
 * Distance along a ray from (x, y) in direction (dx, dy) to the first solid
 * it hits, or Infinity when it hits nothing within maxDistance. The
 * nearest hit wins.
 */
export function rayDistance(x, y, dx, dy, maxDistance) {
  let best = Infinity;
  for (const rect of SOLIDS) {
    const hit = rayEntersRect(x, y, dx, dy, rect);
    if (hit !== null && hit < best && hit <= maxDistance) best = hit;
  }
  return best;
}

/**
 * True when the straight segment from (x1, y1) to (x2, y2) is clear of every
 * solid — the guard can actually see the thief, not just face their way.
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
 * fills this polygon; the guards module tests the thief against it.
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
 * Push a circle centre out of one rectangle, along the shortest way out:
 * straight back from the nearest point on the rectangle, or, when the
 * centre is inside it, out through the nearest face.
 */
function pushOutOfRect(x, y, r, rect) {
  const closestX = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const ox = x - closestX;
  const oy = y - closestY;
  const distSq = ox * ox + oy * oy;
  if (distSq >= r * r) return { x, y };
  if (distSq > 1e-9) {
    const dist = Math.sqrt(distSq);
    return { x: closestX + (ox / dist) * r, y: closestY + (oy / dist) * r };
  }
  // Centre inside the rectangle: leave through the nearest face.
  const toLeft = x - rect.x;
  const toRight = rect.x + rect.w - x;
  const toTop = y - rect.y;
  const toBottom = rect.y + rect.h - y;
  const smallest = Math.min(toLeft, toRight, toTop, toBottom);
  if (smallest === toLeft) return { x: rect.x - r, y };
  if (smallest === toRight) return { x: rect.x + rect.w + r, y };
  if (smallest === toTop) return { x, y: rect.y - r };
  return { x, y: rect.y + rect.h + r };
}

/**
 * Move a circle (centre x, y, radius r) by (dx, dy), sliding along solids
 * instead of passing through them. Returns the new centre.
 */
export function moveCircle(x, y, r, dx, dy) {
  let centre = { x: x + dx, y: y + dy };
  for (const rect of SOLIDS) {
    centre = pushOutOfRect(centre.x, centre.y, r, rect);
  }
  return centre;
}
