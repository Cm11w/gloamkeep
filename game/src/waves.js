// The wave director: what spawns, when, and where. Each wave is a queue of
// enemy kinds drawn from a mix that shifts as the night deepens; the director
// trickles them in from the edges, away from the player, and the wave ends
// when the queue is empty and the last shadow falls. Wave 8 is the Herald.

import { BOSS, ENEMIES, WAVES, WORLD } from './config.js';
import { createBoss, createEnemy, createOrb } from './entities.js';
import { randomRange, randomWeighted, shuffleInPlace } from './random.js';

function waveMix(wave) {
  const entries = [['mote', ENEMIES.mote.weight]];
  if (wave >= WAVES.wispFromWave) entries.push(['wisp', ENEMIES.wisp.weight]);
  if (wave >= WAVES.bulwarkFromWave) entries.push(['bulwark', ENEMIES.bulwark.weight]);
  return entries;
}

function spawnPointAwayFrom(random, player) {
  // Pick an edge point, re-rolling while it lands too close to the player.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const edge = Math.floor(random() * 4);
    const m = WORLD.margin + 6;
    let x;
    let y;
    if (edge === 0) {
      x = randomRange(random, m, WORLD.width - m);
      y = m;
    } else if (edge === 1) {
      x = randomRange(random, m, WORLD.width - m);
      y = WORLD.height - m;
    } else if (edge === 2) {
      x = m;
      y = randomRange(random, m, WORLD.height - m);
    } else {
      x = WORLD.width - m;
      y = randomRange(random, m, WORLD.height - m);
    }
    if (Math.hypot(x - player.x, y - player.y) > 240) return { x, y };
  }
  return { x: WORLD.width / 2, y: WORLD.margin + 6 };
}

export function createWaveDirector(random) {
  const director = {
    wave: 0,
    phase: 'calm',
    calmTimer: 1.2,
    queue: [],
    spawnTimer: 0,
    spawnInterval: WAVES.spawnIntervalStart,
    boss: null,
    bossSpawned: false,

    get isBossWave() {
      return this.wave === WAVES.total;
    },

    beginWave(wave) {
      this.wave = wave;
      this.phase = 'spawning';
      const count = WAVES.baseCount + WAVES.perWaveExtra * (wave - 1);
      const mix = waveMix(wave);
      this.queue = [];
      for (let i = 0; i < count; i += 1) this.queue.push(randomWeighted(random, mix));
      shuffleInPlace(random, this.queue);
      const progress = (wave - 1) / Math.max(1, WAVES.total - 1);
      this.spawnInterval = WAVES.spawnIntervalStart
        + (WAVES.spawnIntervalEnd - WAVES.spawnIntervalStart) * progress;
      this.spawnTimer = 0.4;
      if (this.isBossWave) {
        this.queue = this.queue.slice(0, 6);
        this.bossSpawned = false;
      }
    },

    beginCalm(seconds) {
      this.phase = 'calm';
      this.calmTimer = seconds;
    },

    // Spawns due enemies and runs the Herald's attacks. Returns events the
    // game turns into sound and banners: { spawnedBoss, burst }.
    update(dt, game) {
      const events = { spawnedBoss: false, burst: false };
      if (this.phase === 'calm') {
        this.calmTimer -= dt;
        if (this.calmTimer <= 0) {
          this.beginWave(this.wave + 1);
          game.banner(`Wave ${this.wave}${this.isBossWave ? ' — the Herald wakes' : ''}`, 2.2);
        }
        return events;
      }
      if (this.phase !== 'spawning' && this.phase !== 'fighting') return events;
      if (this.queue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = this.spawnInterval * randomRange(random, 0.7, 1.3);
          const kind = this.queue.shift();
          const point = spawnPointAwayFrom(random, game.player);
          game.enemies.push(createEnemy(kind, point.x, point.y, this.wave, random));
          if (this.queue.length === 0) this.phase = 'fighting';
        }
      }
      if (this.isBossWave && !this.bossSpawned && game.enemies.length <= 2) {
        const point = spawnPointAwayFrom(random, game.player);
        this.boss = createBoss(point.x, point.y);
        game.enemies.push(this.boss);
        this.bossSpawned = true;
        events.spawnedBoss = true;
      }
      if (this.boss && this.boss.hp > 0) this.updateBoss(dt, game, events);
      return events;
    },

    updateBoss(dt, game, events) {
      const boss = this.boss;
      const fraction = boss.hp / boss.maxHp;
      if (!boss.enraged && fraction < 0.25) {
        boss.enraged = true;
        boss.speed *= 1.35;
        game.banner('The Herald rages!', 1.8);
      }
      // Summon help as its health falls through each threshold.
      while (
        boss.summoned < BOSS.summonFractions.length
        && fraction < BOSS.summonFractions[boss.summoned]
      ) {
        boss.summoned += 1;
        for (let i = 0; i < BOSS.summonCount; i += 1) {
          const angle = (i / BOSS.summonCount) * Math.PI * 2;
          game.enemies.push(createEnemy(
            'mote',
            boss.x + Math.cos(angle) * (boss.radius + 24),
            boss.y + Math.sin(angle) * (boss.radius + 24),
            this.wave,
            random,
          ));
        }
      }
      boss.burstTimer -= dt * (boss.enraged ? 1.5 : 1);
      if (boss.burstTimer <= 0) {
        boss.burstTimer = BOSS.burstEverySeconds;
        const offset = random() * Math.PI * 2;
        for (let i = 0; i < BOSS.burstOrbs; i += 1) {
          const angle = offset + (i / BOSS.burstOrbs) * Math.PI * 2;
          game.orbs.push(createOrb(boss.x, boss.y, angle));
        }
        events.burst = true;
      }
    },

    // True when nothing is left to spawn and nothing is left alive.
    isCleared(game) {
      return this.phase === 'fighting' && this.queue.length === 0 && game.enemies.length === 0;
    },

    reset() {
      this.wave = 0;
      this.phase = 'calm';
      this.calmTimer = 1.2;
      this.queue = [];
      this.boss = null;
      this.bossSpawned = false;
    },
  };
  return director;
}
