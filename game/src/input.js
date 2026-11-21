// Keyboard and pointer input. Held keys give a steering direction and
// whether the thief sneaks; dragging on the canvas steers toward the
// drag, for players who prefer the mouse; one-shot presses (start,
// restart, pause) are queued as bit flags and taken once by the loop, so
// a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

/** Key codes grouped by what they do, so the sets below stay readable. */
const MOVE_KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
};
const SNEAK_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyC'];
const CONFIRM_KEYS = ['Space', 'Enter'];
const PAUSE_KEYS = ['KeyP', 'Escape'];
const RESTART_KEYS = ['KeyR'];
const MUTE_KEYS = ['KeyM'];

function keyIn(list, code) {
  return list.indexOf(code) !== -1;
}

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  // A drag steers like a virtual joystick: the vector from where the
  // press started to where the pointer is now, with a small dead zone.
  const drag = { active: false, startX: 0, startY: 0, x: 0, y: 0 };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (keyIn(MOVE_KEYS.up, event.code)) held.up = true;
    else if (keyIn(MOVE_KEYS.down, event.code)) held.down = true;
    else if (keyIn(MOVE_KEYS.left, event.code)) held.left = true;
    else if (keyIn(MOVE_KEYS.right, event.code)) held.right = true;
    else if (keyIn(SNEAK_KEYS, event.code)) held.sneak = true;
    else if (keyIn(CONFIRM_KEYS, event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (keyIn(PAUSE_KEYS, event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (keyIn(RESTART_KEYS, event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (keyIn(MUTE_KEYS, event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (keyIn(MOVE_KEYS.up, event.code)) held.up = false;
    else if (keyIn(MOVE_KEYS.down, event.code)) held.down = false;
    else if (keyIn(MOVE_KEYS.left, event.code)) held.left = false;
    else if (keyIn(MOVE_KEYS.right, event.code)) held.right = false;
    else if (keyIn(SNEAK_KEYS, event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sneak = false;
    drag.active = false;
  });
  // Pointer: a press confirms (start / play again), a drag steers.
  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    drag.active = true;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  target.addEventListener('pointermove', (event) => {
    if (!drag.active) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function endDrag() {
    drag.active = false;
  }
  target.addEventListener('pointerup', endDrag);
  target.addEventListener('pointercancel', endDrag);
  target.addEventListener('pointerleave', endDrag);

  return {
    /**
     * Normalised {x, y} steering vector, and whether the thief sneaks.
     * A live drag wins over the keys; otherwise the held keys steer.
     */
    steering() {
      if (drag.active) {
        const dx = drag.x - drag.startX;
        const dy = drag.y - drag.startY;
        const length = Math.hypot(dx, dy);
        if (length > 12) return { x: dx / length, y: dy / length, sneaking: held.sneak };
        return { x: 0, y: 0, sneaking: held.sneak };
      }
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      const length = Math.hypot(x, y);
      if (length === 0) return { x: 0, y: 0, sneaking: held.sneak };
      return { x: x / length, y: y / length, sneaking: held.sneak };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
