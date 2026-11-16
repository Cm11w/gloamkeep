// GLOAMKEEP — tuning constants. Every number that shapes the feel of the game
// lives here, so balance can be adjusted without touching the simulation.

export const WORLD = {
  width: 960,
  height: 600,
  // The glade is bounded by a ring of standing stones; the player and the
  // enemies stay inside this margin.
  margin: 26,
};

export const PLAYER = {
  radius: 14,
  speed: 235,
  maxHp: 100,
  // Brief invulnerability after taking a hit, so one mistake never costs
  // several hits at once.
  hurtGraceSeconds: 0.7,
  dashSpeed: 720,
  dashSeconds: 0.16,
  dashCooldownSeconds: 2.4,
  // Bolts per second before boons.
  fireRate: 4.2,
  boltSpeed: 560,
  boltDamage: 12,
  boltRadius: 5,
  boltLifeSeconds: 1.1,
  pickupRadius: 26,
  magnetRadius: 90,
  // Experience needed for level 2; each further level costs 35% more.
  xpBase: 14,
  xpGrowth: 1.35,
};

// One entry per enemy kind. `weight` decides the mix inside a wave, `hpScale`
// and `speedScale` grow slowly with the wave number (see waves.js).
export const ENEMIES = {
  mote: {
    name: 'Mote',
    radius: 11,
    hp: 18,
    speed: 118,
    damage: 8,
    score: 10,
    xp: 2,
    weight: 10,
    hpScale: 0.10,
    speedScale: 0.015,
  },
  wisp: {
    name: 'Wisp',
    radius: 13,
    hp: 34,
    speed: 88,
    damage: 12,
    score: 20,
    xp: 4,
    weight: 6,
    hpScale: 0.12,
    speedScale: 0.012,
  },
  bulwark: {
    name: 'Bulwark',
    radius: 21,
    hp: 120,
    speed: 46,
    damage: 20,
    score: 45,
    xp: 9,
    weight: 3,
    hpScale: 0.14,
    speedScale: 0.008,
  },
};

export const BOSS = {
  name: 'Gloam Herald',
  radius: 34,
  hp: 1450,
  speed: 52,
  damage: 24,
  score: 500,
  xp: 60,
  // Seconds between radial bursts of shadow orbs.
  burstEverySeconds: 3.4,
  burstOrbs: 10,
  orbSpeed: 150,
  orbRadius: 8,
  orbDamage: 12,
  orbLifeSeconds: 4.5,
  // The Herald calls motes when its health first drops below each threshold.
  summonFractions: [0.66, 0.33],
  summonCount: 4,
};

export const WAVES = {
  // Survive all of these, defeat the Herald, and dawn breaks: the player wins.
  total: 8,
  // Enemies in wave 1; each later wave adds this many more.
  baseCount: 7,
  perWaveExtra: 4,
  // Seconds of calm between waves, so the player can breathe and collect.
  calmSeconds: 3.2,
  // Spawn pacing: a steady trickle early, a faster stream later.
  spawnIntervalStart: 1.05,
  spawnIntervalEnd: 0.42,
  // Wisps join from wave 2, bulwarks from wave 4.
  wispFromWave: 2,
  bulwarkFromWave: 4,
  // Bonus score for clearing a wave, scaled by the wave number.
  clearBonus: 50,
};

export const DAWN = {
  // The sky lightens a little with every cleared wave; at full dawn the
  // victory screen takes over.
  skySteps: WAVES.total,
};

export const AUDIO = {
  masterGain: 0.5,
  musicGain: 0.055,
  sfxGain: 0.5,
};
