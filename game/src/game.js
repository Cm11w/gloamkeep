// The game itself: one state machine, one fixed-step simulation. The states
// are title, playing, boon (level-up choice), paused, victory and defeat;
// every transition runs through here, so there is no path that strands the
// player without a way forward or a restart.

import { BOSS, PLAYER, WAVES, WORLD } from './config.js';
import { applyBoon, rollBoonOffer } from './boons.js';
import {
  clampToWorld,
  createBolt,
  createFloater,
  createParticle,
  createPlayer,
  createShard,
  distanceBetween,
} from './entities.js';
import { createRandom, randomRange } from './random.js';
import { createWaveDirector } from './waves.js';

const BEST_KEY = 'gloamkeep-best-score';
const MAX_PARTICLES = 500;

export function createGame(audio) {
  const game = {
    state: 'title',
    rng: createRandom(1),
    seed: 1,
    player: createPlayer(WORLD.width / 2, WORLD.height / 2),
    enemies: [],
    bolts: [],
    orbs: [],
    shards: [],
    particles: [],
    floaters: [],
    director: null,
    score: 0,
    kills: 0,
    runTime: 0,
    ambientTime: 0,
    shake: 0,
    bannerText: '',
    bannerTimer: 0,
    pendingBoons: [],
    pendingLevels: 0,
    pickupCombo: 0,
    pickupComboTimer: 0,
    wavesCleared: 0,
    bestScore: 0,
    // Only the screenshot director sets this: it stages scenes through the
    // real simulation without the staged run ending early.
    godMode: false,

    get dawnFraction() {
      return this.wavesCleared / WAVES.total;
    },
    get boss() {
      return this.director?.boss ?? null;
    },
    get bossAlive() {
      return this.boss !== null && this.boss.hp > 0 && this.enemies.includes(this.boss);
    },

    loadBest() {
      try {
        this.bestScore = Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
      } catch {
        this.bestScore = 0;
      }
    },

    saveBest() {
      if (this.score <= this.bestScore) return;
      this.bestScore = this.score;
      try {
        window.localStorage.setItem(BEST_KEY, String(this.bestScore));
      } catch {
        // Private browsing or a blocked store: the run still counts.
      }
    },

    startRun(seed) {
      this.seed = seed;
      this.rng = createRandom(seed);
      this.player = createPlayer(WORLD.width / 2, WORLD.height / 2);
      this.enemies = [];
      this.bolts = [];
      this.orbs = [];
      this.shards = [];
      this.particles = [];
      this.floaters = [];
      this.director = createWaveDirector(this.rng);
      this.director.reset();
      this.score = 0;
      this.kills = 0;
      this.runTime = 0;
      this.shake = 0;
      this.pendingBoons = [];
      this.pendingLevels = 0;
      this.pickupCombo = 0;
      this.wavesCleared = 0;
      this.state = 'playing';
      this.banner('Night falls. Hold the light until dawn.', 3.0);
    },

    banner(text, seconds) {
      this.bannerText = text;
      this.bannerTimer = seconds;
    },

    addShake(amount) {
      this.shake = Math.min(1, this.shake + amount);
    },

    burst(x, y, color, count, speed, life, size) {
      for (let i = 0; i < count; i += 1) {
        if (this.particles.length >= MAX_PARTICLES) return;
        const angle = this.rng() * Math.PI * 2;
        const power = speed * (0.3 + this.rng() * 0.7);
        this.particles.push(createParticle(x, y, {
          vx: Math.cos(angle) * power,
          vy: Math.sin(angle) * power,
          life: life * (0.6 + this.rng() * 0.7),
          size: size * (0.6 + this.rng() * 0.8),
          color,
        }));
      }
    },

    ringBurst(x, y, color, count, radius, life, size) {
      for (let i = 0; i < count; i += 1) {
        if (this.particles.length >= MAX_PARTICLES) return;
        const angle = (i / count) * Math.PI * 2;
        this.particles.push(createParticle(x, y, {
          vx: Math.cos(angle) * radius,
          vy: Math.sin(angle) * radius,
          life,
          size,
          color,
          drag: 1.2,
        }));
      }
    },

    chooseBoon(index) {
      const boon = this.pendingBoons[index];
      if (!boon || this.state !== 'boon') return;
      applyBoon(this.player, boon);
      audio.click();
      this.pendingLevels -= 1;
      if (this.pendingLevels > 0) {
        this.pendingBoons = rollBoonOffer(this.player, this.rng);
        return;
      }
      this.pendingBoons = [];
      this.state = 'playing';
    },

    togglePause() {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    },

    update(dt, input) {
      this.ambientTime += dt;
      if (this.bannerTimer > 0) this.bannerTimer -= dt;
      this.shake = Math.max(0, this.shake - dt * 1.7);
      if (this.state === 'playing') this.updatePlaying(dt, input);
      else if (this.state === 'title' || this.state === 'victory' || this.state === 'defeat') {
        this.updateAmbient(dt);
      }
      // In boon and paused states the world holds still by design.
    },

    updateAmbient(dt) {
      this.updateParticles(dt);
      this.updateFloaters(dt);
    },

    updatePlaying(dt, input) {
      const player = this.player;
      this.runTime += dt;
      if (input.wasAnyPressed(['Escape', 'KeyP'])) {
        this.togglePause();
        return;
      }
      if (this.pickupComboTimer > 0) {
        this.pickupComboTimer -= dt;
        if (this.pickupComboTimer <= 0) this.pickupCombo = 0;
      }

      this.updatePlayer(dt, input);
      this.updateBolts(dt);
      this.updateEnemies(dt);
      this.updateOrbs(dt);
      this.updateShards(dt);
      this.updateParticles(dt);
      this.updateFloaters(dt);

      const events = this.director.update(dt, this);
      if (events.spawnedBoss) {
        audio.bossBurst();
        this.addShake(0.5);
        this.banner('The Gloam Herald has come', 2.6);
      }
      if (events.burst) audio.bossBurst();

      if (player.regenPerSecond > 0) {
        player.hp = Math.min(player.maxHp, player.hp + player.regenPerSecond * dt);
      }
      if (player.novaSeconds > 0) {
        player.novaTimer -= dt;
        if (player.novaTimer <= 0) {
          player.novaTimer = player.novaSeconds;
          this.fireNova();
        }
      }

      if (this.director.isCleared(this)) this.clearWave();
      if (this.pendingLevels > 0 && this.state === 'playing') {
        this.pendingBoons = rollBoonOffer(player, this.rng);
        this.state = 'boon';
        audio.levelUp();
      }
    },

    updatePlayer(dt, input) {
      const player = this.player;
      player.hurtTimer = Math.max(0, player.hurtTimer - dt);
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
      player.fireTimer = Math.max(0, player.fireTimer - dt);

      // Aim follows the pointer; the lantern faces the dark it must burn.
      player.angle = Math.atan2(input.pointer.y - player.y, input.pointer.x - player.x);

      const direction = input.moveDirection();
      player.moving = direction.x !== 0 || direction.y !== 0;
      if (player.moving) player.walkPhase += dt * 10;

      const wantsDash = input.wasAnyPressed(['ShiftLeft', 'ShiftRight']);
      if (wantsDash && player.dashCooldown <= 0 && player.dashTimer <= 0) {
        const dx = player.moving ? direction.x : Math.cos(player.angle);
        const dy = player.moving ? direction.y : Math.sin(player.angle);
        player.dashX = dx;
        player.dashY = dy;
        player.dashTimer = PLAYER.dashSeconds;
        player.dashCooldown = PLAYER.dashCooldownSeconds * player.dashCooldownMul;
        audio.dash();
        this.burst(player.x, player.y, '#ffd98a', 8, 120, 0.3, 3);
      }

      if (player.dashTimer > 0) {
        player.dashTimer -= dt;
        player.x += player.dashX * PLAYER.dashSpeed * dt;
        player.y += player.dashY * PLAYER.dashSpeed * dt;
      } else {
        player.x += direction.x * PLAYER.speed * player.speedMul * dt;
        player.y += direction.y * PLAYER.speed * player.speedMul * dt;
      }
      clampToWorld(player);

      const firing = input.pointer.down || input.isHeld('Space');
      if (firing && player.fireTimer <= 0) {
        player.fireTimer = 1 / (PLAYER.fireRate * player.fireRateMul);
        this.fireBolts();
      }
    },

    fireBolts() {
      const player = this.player;
      const count = player.projectiles;
      const spread = 0.1;
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * spread;
        const angle = player.angle + offset;
        const muzzleX = player.x + Math.cos(angle) * (player.radius + 6);
        const muzzleY = player.y + Math.sin(angle) * (player.radius + 6);
        this.bolts.push(createBolt(
          muzzleX,
          muzzleY,
          angle,
          Math.round(PLAYER.boltDamage * player.damageMul),
          player.pierce,
        ));
      }
      audio.shoot();
      this.burst(
        player.x + Math.cos(player.angle) * (player.radius + 4),
        player.y + Math.sin(player.angle) * (player.radius + 4),
        '#ffe9a8', 2, 60, 0.15, 2.5,
      );
    },

    fireNova() {
      const player = this.player;
      this.ringBurst(player.x, player.y, '#ffd98a', 26, player.novaRadius * 2.2, 0.45, 4);
      audio.nova();
      for (const enemy of [...this.enemies]) {
        if (distanceBetween(player, enemy) <= player.novaRadius + enemy.radius) {
          this.damageEnemy(enemy, player.novaDamage, player.x, player.y, 160);
        }
      }
    },

    updateBolts(dt) {
      for (const bolt of [...this.bolts]) {
        bolt.x += bolt.vx * dt;
        bolt.y += bolt.vy * dt;
        bolt.life -= dt;
        if (bolt.life <= 0 || bolt.x < 0 || bolt.x > WORLD.width || bolt.y < 0 || bolt.y > WORLD.height) {
          this.bolts.splice(this.bolts.indexOf(bolt), 1);
          continue;
        }
        for (const enemy of [...this.enemies]) {
          if (bolt.hitIds.has(enemy)) continue;
          const hitAt = bolt.radius + enemy.radius;
          if (Math.hypot(bolt.x - enemy.x, bolt.y - enemy.y) > hitAt) continue;
          bolt.hitIds.add(enemy);
          this.damageEnemy(enemy, bolt.damage, bolt.x, bolt.y, 90);
          if (bolt.pierceLeft > 0) {
            bolt.pierceLeft -= 1;
          } else {
            this.bolts.splice(this.bolts.indexOf(bolt), 1);
          }
          break;
        }
      }
    },

    damageEnemy(enemy, damage, fromX, fromY, knockback) {
      enemy.hp -= damage;
      enemy.hitFlash = 0.12;
      const angle = Math.atan2(enemy.y - fromY, enemy.x - fromX);
      enemy.knockX += Math.cos(angle) * knockback;
      enemy.knockY += Math.sin(angle) * knockback;
      this.floaters.push(createFloater(
        enemy.x + randomRange(this.rng, -8, 8),
        enemy.y - enemy.radius - 4,
        String(damage),
        '#ffe9a8',
      ));
      this.burst(enemy.x, enemy.y, '#b9a7ff', 3, 110, 0.25, 2.5);
      audio.enemyHit();
      if (enemy.hp <= 0) this.killEnemy(enemy);
    },

    killEnemy(enemy) {
      const index = this.enemies.indexOf(enemy);
      if (index === -1) return;
      this.enemies.splice(index, 1);
      this.kills += 1;
      this.score += enemy.score;
      audio.enemyDie();
      this.burst(enemy.x, enemy.y, enemy.isBoss ? '#ff9d6b' : '#8f7bd8', enemy.isBoss ? 46 : 14, enemy.isBoss ? 260 : 170, 0.55, 3.5);
      this.floaters.push(createFloater(enemy.x, enemy.y - enemy.radius - 16, `+${enemy.score}`, '#aef2c0'));
      // Shadows burst into embers: the experience the Keeper gathers.
      const shards = enemy.isBoss ? 8 : Math.max(1, Math.round(enemy.xp / 2));
      const value = Math.max(1, Math.round(enemy.xp / shards));
      for (let i = 0; i < shards; i += 1) {
        this.shards.push(createShard(enemy.x, enemy.y, value, this.rng));
      }
      if (enemy.isBoss) {
        this.addShake(0.8);
        this.banner('The Herald falls. Dawn is coming.', 3.0);
      }
    },

    updateEnemies(dt) {
      const player = this.player;
      for (const enemy of [...this.enemies]) {
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        // Seek the Keeper; wisps weave side to side as they close in.
        const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        let heading = angleToPlayer;
        if (enemy.kind === 'wisp') {
          enemy.weavePhase += dt * 3.2;
          heading += Math.sin(enemy.weavePhase) * 0.55;
        }
        enemy.x += Math.cos(heading) * enemy.speed * dt;
        enemy.y += Math.sin(heading) * enemy.speed * dt;
        // Knockback decays; separation keeps the swarm from stacking.
        enemy.x += enemy.knockX * dt;
        enemy.y += enemy.knockY * dt;
        enemy.knockX *= Math.max(0, 1 - dt * 6);
        enemy.knockY *= Math.max(0, 1 - dt * 6);
        clampToWorld(enemy);
        if (distanceBetween(enemy, player) < enemy.radius + player.radius - 2) {
          this.damagePlayer(enemy.damage, enemy.x, enemy.y);
          const push = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          enemy.x += Math.cos(push) * 14;
          enemy.y += Math.sin(push) * 14;
        }
      }
      this.separateEnemies();
    },

    separateEnemies() {
      const list = this.enemies;
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.radius + b.radius - 4;
          const distSq = dx * dx + dy * dy;
          if (distSq >= min * min || distSq === 0) continue;
          const dist = Math.sqrt(distSq);
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          if (!a.isBoss) {
            a.x -= nx * push;
            a.y -= ny * push;
          }
          if (!b.isBoss) {
            b.x += nx * push;
            b.y += ny * push;
          }
        }
      }
    },

    updateOrbs(dt) {
      const player = this.player;
      for (const orb of [...this.orbs]) {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
        orb.life -= dt;
        if (orb.life <= 0 || orb.x < -20 || orb.x > WORLD.width + 20 || orb.y < -20 || orb.y > WORLD.height + 20) {
          this.orbs.splice(this.orbs.indexOf(orb), 1);
          continue;
        }
        if (Math.hypot(orb.x - player.x, orb.y - player.y) < orb.radius + player.radius - 2) {
          this.orbs.splice(this.orbs.indexOf(orb), 1);
          this.damagePlayer(orb.damage, orb.x, orb.y);
        }
      }
    },

    damagePlayer(amount, fromX, fromY) {
      const player = this.player;
      if (this.godMode || player.hurtTimer > 0 || player.dashTimer > 0) return;
      player.hp -= amount;
      player.hurtTimer = PLAYER.hurtGraceSeconds;
      this.addShake(0.45);
      audio.hurt();
      this.burst(player.x, player.y, '#ff7d6b', 12, 180, 0.4, 3);
      this.floaters.push(createFloater(player.x, player.y - player.radius - 10, `-${amount}`, '#ff9d8a'));
      const push = Math.atan2(player.y - fromY, player.x - fromX);
      player.x += Math.cos(push) * 10;
      player.y += Math.sin(push) * 10;
      clampToWorld(player);
      if (player.hp <= 0) {
        player.hp = 0;
        this.endRun(false);
      }
    },

    updateShards(dt) {
      const player = this.player;
      const magnet = PLAYER.magnetRadius * player.magnetMul;
      for (const shard of [...this.shards]) {
        shard.age += dt;
        if (!shard.settled) {
          shard.x += shard.vx * dt;
          shard.y += shard.vy * dt;
          shard.vx *= Math.max(0, 1 - dt * 4);
          shard.vy *= Math.max(0, 1 - dt * 4);
          if (shard.age > 0.45) shard.settled = true;
        }
        const dx = player.x - shard.x;
        const dy = player.y - shard.y;
        const dist = Math.hypot(dx, dy);
        if (dist < magnet && dist > 0.01) {
          const pull = 520 * (1 - dist / (magnet + 1)) + 160;
          shard.x += (dx / dist) * pull * dt;
          shard.y += (dy / dist) * pull * dt;
        }
        if (dist < PLAYER.pickupRadius + shard.radius) {
          this.shards.splice(this.shards.indexOf(shard), 1);
          this.gainXp(shard.value);
          this.pickupCombo += 1;
          this.pickupComboTimer = 1.2;
          audio.pickup(this.pickupCombo);
          this.burst(shard.x, shard.y, '#ffd98a', 4, 90, 0.3, 2.5);
        }
      }
    },

    gainXp(amount) {
      const player = this.player;
      player.xp += amount;
      while (player.xp >= player.xpNext) {
        player.xp -= player.xpNext;
        player.level += 1;
        player.xpNext = Math.round(player.xpNext * PLAYER.xpGrowth);
        this.pendingLevels += 1;
      }
    },

    updateParticles(dt) {
      for (const particle of [...this.particles]) {
        particle.life -= dt;
        if (particle.life <= 0) {
          this.particles.splice(this.particles.indexOf(particle), 1);
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += particle.gravity * dt;
        const drag = Math.max(0, 1 - particle.drag * dt);
        particle.vx *= drag;
        particle.vy *= drag;
      }
    },

    updateFloaters(dt) {
      for (const floater of [...this.floaters]) {
        floater.life -= dt;
        floater.y -= 42 * dt;
        if (floater.life <= 0) this.floaters.splice(this.floaters.indexOf(floater), 1);
      }
    },

    clearWave() {
      const wave = this.director.wave;
      this.wavesCleared = wave;
      if (wave >= WAVES.total) {
        this.endRun(true);
        return;
      }
      const bonus = WAVES.clearBonus * wave;
      this.score += bonus;
      audio.waveClear();
      this.banner(`Wave ${wave} cleared! +${bonus} — dawn is ${Math.round((wave / WAVES.total) * 100)}% near`, 2.6);
      this.director.beginCalm(WAVES.calmSeconds);
    },

    endRun(won) {
      this.saveBest();
      this.state = won ? 'victory' : 'defeat';
      if (won) {
        const timeBonus = Math.max(0, Math.round(1200 - this.runTime * 2));
        this.score += timeBonus;
        this.saveBest();
        audio.victory();
        this.ringBurst(this.player.x, this.player.y, '#ffd98a', 40, 300, 0.8, 4);
      } else {
        audio.defeat();
        this.burst(this.player.x, this.player.y, '#ff7d6b', 30, 220, 0.7, 4);
      }
    },

    get runStats() {
      return {
        score: this.score,
        best: this.bestScore,
        kills: this.kills,
        level: this.player.level,
        wavesCleared: this.wavesCleared,
        timeSeconds: Math.floor(this.runTime),
      };
    },
  };
  game.director = createWaveDirector(game.rng);
  game.loadBest();
  return game;
}
