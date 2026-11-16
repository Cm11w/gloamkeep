// GLOAMKEEP — boot, the fixed-step loop, and the keys that work outside the
// simulation (start, restart, pause, mute, boon choices). The simulation runs
// at 60 fixed steps a second, apart from rendering, so the game plays the
// same on any display. `?seed=N` fixes a run; `?shot=title|play|boon|victory`
// stages a screenshot scene instead of running the loop.

import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { createUi } from './ui.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

const params = new URLSearchParams(window.location.search);
const canvas = document.getElementById('game-canvas');
const audio = createAudio();
const game = createGame(audio);
const input = createInput(canvas);
const renderer = createRenderer(canvas);

function pickSeed() {
  const fixed = params.get('seed');
  if (fixed !== null) {
    const parsed = Number.parseInt(fixed, 10);
    if (Number.isFinite(parsed)) return parsed >>> 0;
  }
  return (Math.random() * 0x7fffffff) >>> 0;
}

function startRun() {
  audio.unlock();
  game.godMode = false;
  game.startRun(pickSeed());
}

const ui = createUi({
  onStart: startRun,
  onRestart: startRun,
  onResume: () => {
    audio.unlock();
    if (game.state === 'paused') game.togglePause();
  },
  onQuitToTitle: () => {
    game.state = 'title';
  },
  onChooseBoon: (index) => game.chooseBoon(index),
  onToggleMute: () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    ui.setMuted(audio.isMuted());
  },
  onTogglePause: () => {
    if (game.state === 'playing' || game.state === 'paused') game.togglePause();
  },
});

ui.setMuted(audio.isMuted());

// The first gesture anywhere unlocks sound, as browsers require.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// A handle for play-testing and debugging from the console.
window.__gloamkeep = { game, input, audio };

const shot = params.get('shot');
if (shot) {
  stageShot(shot, game);
  renderer.draw(game, input.pointer);
  ui.sync(game);
  window.__shotReady = true;
} else {
  let lastTime = performance.now();
  let accumulator = 0;

  function handleGlobalKeys() {
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.isMuted());
      ui.setMuted(audio.isMuted());
    }
    if (game.state === 'title' && input.wasAnyPressed(['Enter', 'Space'])) {
      startRun();
    } else if (game.state === 'boon') {
      if (input.wasPressed('Digit1')) game.chooseBoon(0);
      else if (input.wasPressed('Digit2')) game.chooseBoon(1);
      else if (input.wasPressed('Digit3')) game.chooseBoon(2);
    } else if (game.state === 'paused' && input.wasAnyPressed(['Escape', 'KeyP', 'Enter'])) {
      game.togglePause();
      // The press that resumed the game must not reach the simulation's own
      // pause check in the same frame, or it would pause straight back.
      input.endStep();
    } else if ((game.state === 'victory' || game.state === 'defeat') && input.wasAnyPressed(['KeyR', 'Enter'])) {
      startRun();
    }
  }

  function frame(now) {
    const elapsed = Math.min(0.25, (now - lastTime) / 1000);
    lastTime = now;
    handleGlobalKeys();
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS_PER_FRAME) {
      game.update(STEP, input);
      accumulator -= STEP;
      steps += 1;
      // One-shot presses belong to the first step of the frame only, so a
      // single Escape never pauses and unpauses in the same frame.
      if (steps === 1) input.endStep();
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    if (steps === 0) input.endStep();
    renderer.draw(game, input.pointer);
    ui.sync(game);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
