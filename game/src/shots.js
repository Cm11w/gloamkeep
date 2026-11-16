// The screenshot scenes behind `?shot=title|play|boon|victory`. Each one runs
// the real simulation forward from a fixed seed — a small director plays the
// game through the same update step a human's input would — then freezes the
// frame for the screenshot. Nothing here draws anything the game itself does
// not draw; the shots are real renders of the game's own code.

import { WORLD } from './config.js';

const STEP = 1 / 60;

// The staged director normally fires; the play shot holds fire while the
// field fills, then fires a last burst so bolts are in the frame.
let stagedFiring = true;

function directorMove(game) {
  const player = game.player;
  // Aim at the nearest shadow; with nothing near, face the glade's heart.
  let nearest = null;
  let nearestDist = Infinity;
  for (const enemy of game.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
  }
  const aim = nearest
    ? { x: nearest.x, y: nearest.y }
    : { x: WORLD.width / 2, y: WORLD.height / 2 };
  // Kite: back away when a shadow closes in, drift toward embers otherwise.
  // Each urge is a unit direction, so they combine fairly: the centre pull
  // below must be able to outweigh a kite urge near the walls.
  let dx = 0;
  let dy = 0;
  if (nearest && nearestDist < 150) {
    dx = (player.x - nearest.x) / nearestDist;
    dy = (player.y - nearest.y) / nearestDist;
  } else if (game.shards.length > 0) {
    let shard = null;
    let shardDist = Infinity;
    for (const candidate of game.shards) {
      const dist = Math.hypot(candidate.x - player.x, candidate.y - player.y);
      if (dist < shardDist) {
        shardDist = dist;
        shard = candidate;
      }
    }
    if (shard && shardDist > 1) {
      dx = ((shard.x - player.x) / shardDist) * 0.8;
      dy = ((shard.y - player.y) / shardDist) * 0.8;
    }
  } else {
    // A slow orbit keeps the staged Keeper away from the walls.
    const angle = game.ambientTime * 0.35;
    const tx = WORLD.width / 2 + Math.cos(angle) * 170 - player.x;
    const ty = WORLD.height / 2 + Math.sin(angle) * 110 - player.y;
    const orbitDist = Math.hypot(tx, ty);
    if (orbitDist > 1) {
      dx = (tx / orbitDist) * 0.7;
      dy = (ty / orbitDist) * 0.7;
    }
  }
  // Keep the staged action near the heart of the glade: the further the
  // Keeper drifts from the centre, the stronger the pull back, so the frame
  // never ends up with the fight bunched in a corner or behind the HUD. Past
  // the outer ring the director heads straight back: staging runs with god
  // mode on, so kiting for survival is never needed there.
  const centreX = WORLD.width / 2 - player.x;
  const centreY = WORLD.height / 2 - player.y;
  const centreDist = Math.hypot(centreX, centreY);
  if (centreDist > 210) {
    return { x: centreX / centreDist, y: centreY / centreDist, aim, firing: stagedFiring };
  }
  if (centreDist > 170) {
    const pull = Math.min(1.6, (centreDist - 170) / 120);
    dx += (centreX / centreDist) * pull;
    dy += (centreY / centreDist) * pull;
  }
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length, aim, firing: stagedFiring };
}

function stagedInput(game) {
  const move = directorMove(game);
  return {
    pointer: { x: move.aim.x, y: move.aim.y, down: move.firing, justDown: false },
    moveDirection: () => ({ x: move.x, y: move.y }),
    isHeld: () => false,
    wasPressed: () => false,
    wasAnyPressed: () => false,
    endStep: () => {},
  };
}

function stepGame(game, seconds, onStep) {
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.update(STEP, stagedInput(game));
    if (onStep) onStep();
    if (game.state !== 'playing' && game.state !== 'boon') return;
    if (game.state === 'boon' && game.pendingBoons.length > 0) game.chooseBoon(0);
  }
}

function stepAmbient(game, seconds) {
  const idle = {
    pointer: { x: 480, y: 300, down: false, justDown: false },
    moveDirection: () => ({ x: 0, y: 0 }),
    isHeld: () => false,
    wasPressed: () => false,
    wasAnyPressed: () => false,
    endStep: () => {},
  };
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.update(STEP, idle);
}

export function stageShot(shot, game) {
  const seed = 7;
  stagedFiring = true;
  if (shot === 'title') {
    game.seed = seed;
    stepAmbient(game, 2.5);
    return;
  }
  game.godMode = true;
  game.startRun(seed);
  if (shot === 'play') {
    // A few seconds of real fighting drops embers; then the director holds
    // fire while the second wave fills the field, and fires one last burst
    // so the frame shows the swarm, the bolts and the embers all at once.
    stepGame(game, 3);
    stagedFiring = false;
    let elapsed = 0;
    while (elapsed < 25 && game.state === 'playing' && game.enemies.length < 7) {
      stepGame(game, 0.5);
      elapsed += 0.5;
    }
    stagedFiring = true;
    stepGame(game, 0.1);
    return;
  }
  if (shot === 'boon') {
    stepGame(game, 6);
    // Top the Keeper's embers up through the real experience path, then let
    // one step open the choice.
    game.gainXp(game.player.xpNext);
    game.update(STEP, stagedInput(game));
    return;
  }
  if (shot === 'victory') {
    // A strong Keeper clears the night quickly; the director still plays
    // every wave, including the Herald, through the real rules.
    game.player.damageMul = 40;
    game.player.fireRateMul = 2.5;
    game.player.speedMul = 1.4;
    game.player.maxHp = 400;
    game.player.hp = 400;
    // A wide magnet gathers the falling embers through the real collection
    // path, so the staged run levels up and chooses boons like a real one.
    game.player.magnetMul = 6;
    let elapsed = 0;
    while (game.state !== 'victory' && elapsed < 300) {
      stepGame(game, 1);
      elapsed += 1;
    }
    if (game.state !== 'victory') {
      // A safety net for the staged shot only: the real path is the loop above.
      game.wavesCleared = 8;
      game.endRun(true);
    }
    // Let the victory banner fade before the frame freezes.
    stepAmbient(game, 3.2);
    return;
  }
  if (shot === 'defeat') {
    game.godMode = false;
    const idle = {
      pointer: { x: 480, y: 200, down: false, justDown: false },
      moveDirection: () => ({ x: 0, y: 0 }),
      isHeld: () => false,
      wasPressed: () => false,
      wasAnyPressed: () => false,
      endStep: () => {},
    };
    let elapsed = 0;
    while (game.state !== 'defeat' && elapsed < 150) {
      game.update(STEP, idle);
      elapsed += STEP;
    }
    if (game.state !== 'defeat') game.damagePlayer(99999, game.player.x, game.player.y - 1);
    stepAmbient(game, 1);
  }
}
