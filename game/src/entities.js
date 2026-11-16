// Entity factories. Entities are plain objects held in arrays on the game
// state; this file only builds them with their starting numbers, so the
// simulation in game.js stays readable and the balance in config.js stays
// the single source of truth.

import { BOSS, ENEMIES, PLAYER, WORLD } from './config.js';
import { randomRange } from './random.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    level: 1,
    xp: 0,
    xpNext: PLAYER.xpBase,
    angle: -Math.PI / 2,
    // Combat stats; boons multiply these, never the base constants.
    damageMul: 1,
    fireRateMul: 1,
    speedMul: 1,
    magnetMul: 1,
    projectiles: 1,
    pierce: 0,
    dashCooldownMul: 1,
    regenPerSecond: 0,
    novaSeconds: 0,
    novaDamage: 0,
    novaRadius: 0,
    boons: {},
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    hurtTimer: 0,
    novaTimer: 0,
    moving: false,
    walkPhase: 0,
  };
}

export function createEnemy(kind, x, y, wave, random) {
  const base = ENEMIES[kind];
  const growth = 1 + base.hpScale * (wave - 1);
  return {
    kind,
    x,
    y,
    radius: base.radius,
    hp: Math.round(base.hp * growth),
    maxHp: Math.round(base.hp * growth),
    speed: base.speed * (1 + base.speedScale * (wave - 1)),
    damage: base.damage,
    score: base.score,
    xp: base.xp,
    // Wisps weave; the phase comes from the shared stream, so a seeded run
    // replays exactly.
    weavePhase: random() * Math.PI * 2,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    isBoss: false,
  };
}

export function createBoss(x, y) {
  return {
    kind: 'herald',
    x,
    y,
    radius: BOSS.radius,
    hp: BOSS.hp,
    maxHp: BOSS.hp,
    speed: BOSS.speed,
    damage: BOSS.damage,
    score: BOSS.score,
    xp: BOSS.xp,
    weavePhase: 0,
    hitFlash: 0,
    knockX: 0,
    knockY: 0,
    isBoss: true,
    burstTimer: 2.0,
    summoned: 0,
    enraged: false,
  };
}

export function createBolt(x, y, angle, damage, pierce) {
  return {
    x,
    y,
    vx: Math.cos(angle) * PLAYER.boltSpeed,
    vy: Math.sin(angle) * PLAYER.boltSpeed,
    radius: PLAYER.boltRadius,
    damage,
    pierceLeft: pierce,
    life: PLAYER.boltLifeSeconds,
    hitIds: new Set(),
  };
}

export function createOrb(x, y, angle) {
  return {
    x,
    y,
    vx: Math.cos(angle) * BOSS.orbSpeed,
    vy: Math.sin(angle) * BOSS.orbSpeed,
    radius: BOSS.orbRadius,
    damage: BOSS.orbDamage,
    life: BOSS.orbLifeSeconds,
  };
}

export function createShard(x, y, value, random) {
  const angle = random() * Math.PI * 2;
  const speed = randomRange(random, 40, 130);
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 7,
    value,
    age: 0,
    // Shards rest quickly, then wait to be gathered.
    settled: false,
  };
}

export function createParticle(x, y, options) {
  return {
    x,
    y,
    vx: options.vx,
    vy: options.vy,
    life: options.life,
    maxLife: options.life,
    size: options.size,
    color: options.color,
    drag: options.drag ?? 2.5,
    gravity: options.gravity ?? 0,
  };
}

export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 0.8, maxLife: 0.8 };
}

export function clampToWorld(entity) {
  const m = WORLD.margin + entity.radius;
  entity.x = Math.max(m, Math.min(WORLD.width - m, entity.x));
  entity.y = Math.max(m, Math.min(WORLD.height - m, entity.y));
}

export function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
