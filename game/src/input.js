// Keyboard and mouse input. The simulation reads a snapshot each fixed step:
// held movement keys give a direction, the pointer gives an aim point, and
// one-shot presses (dash, pause, confirm, boon choices) are consumed once.

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const pointer = { x: 480, y: 300, down: false, justDown: false };

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onKeyDown(event) {
    // Ignore repeats: a held key must not re-trigger one-shot actions.
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    // Keep the page still while playing: arrows and space must not scroll.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerMove(event) {
    const point = canvasPoint(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    const point = canvasPoint(event.clientX, event.clientY);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.down = true;
    pointer.justDown = true;
  }

  function onPointerUp(event) {
    if (event.button !== 0) return;
    pointer.down = false;
  }

  function onBlur() {
    held.clear();
    pointer.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  // Touch fallback: a touch on the canvas aims and fires, like a mouse press.
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    if (touch) onPointerMove(touch);
    event.preventDefault();
  }, { passive: false });

  return {
    pointer,
    // Normalised movement direction from the held keys: {x, y} in [-1, 1].
    moveDirection() {
      let x = 0;
      let y = 0;
      if (KEYS.left.some((code) => held.has(code))) x -= 1;
      if (KEYS.right.some((code) => held.has(code))) x += 1;
      if (KEYS.up.some((code) => held.has(code))) y -= 1;
      if (KEYS.down.some((code) => held.has(code))) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    isHeld(code) {
      return held.has(code);
    },
    // True once for each physical press; the game consumes presses per step.
    wasPressed(code) {
      return pressed.has(code);
    },
    wasAnyPressed(codes) {
      return codes.some((code) => pressed.has(code));
    },
    endStep() {
      pressed.clear();
      pointer.justDown = false;
    },
    // The shot-staging director drives the game through this same interface.
    drive(direction, aim, firing) {
      pointer.x = aim.x;
      pointer.y = aim.y;
      pointer.down = firing;
      return direction;
    },
  };
}
