// All canvas drawing: the night glade, its stars and fireflies, the Keeper,
// the shadows, and every spark in between. The HUD and the menus are DOM
// (see ui.js); this file paints only the world, in one place, with one
// palette: deep indigo night against warm lantern gold.

import { WORLD } from './config.js';
import { createRandom, randomRange } from './random.js';

const NIGHT_TOP = [11, 16, 38];
const NIGHT_BOTTOM = [30, 22, 64];
const DAWN_TOP = [64, 84, 150];
const DAWN_BOTTOM = [232, 164, 110];

function mixColor(a, b, t) {
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function buildAmbient(seed) {
  const random = createRandom(seed ^ 0x5f3759df);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      x: random() * WORLD.width,
      y: random() * WORLD.height * 0.55,
      radius: randomRange(random, 0.6, 1.8),
      phase: random() * Math.PI * 2,
      speed: randomRange(random, 0.6, 1.8),
    });
  }
  const fireflies = [];
  for (let i = 0; i < 16; i += 1) {
    fireflies.push({
      x: random() * WORLD.width,
      y: random() * WORLD.height,
      phase: random() * Math.PI * 2,
      speed: randomRange(random, 0.2, 0.5),
      radius: randomRange(random, 14, 42),
    });
  }
  const tufts = [];
  for (let i = 0; i < 70; i += 1) {
    tufts.push({
      x: randomRange(random, 30, WORLD.width - 30),
      y: randomRange(random, 30, WORLD.height - 30),
      lean: randomRange(random, -0.3, 0.3),
      size: randomRange(random, 4, 9),
    });
  }
  const stones = [];
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    stones.push({
      x: WORLD.width / 2 + Math.cos(angle) * (WORLD.width / 2 - 8),
      y: WORLD.height / 2 + Math.sin(angle) * (WORLD.height / 2 - 8),
      height: randomRange(random, 16, 26),
      tilt: randomRange(random, -0.14, 0.14),
    });
  }
  return { stars, fireflies, tufts, stones };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let ambient = buildAmbient(1);
  let ambientSeed = 1;

  function prepareAmbient(seed) {
    if (seed === ambientSeed) return;
    ambientSeed = seed;
    ambient = buildAmbient(seed);
  }

  function drawBackground(game) {
    const dawn = game.state === 'victory' ? 1 : game.dawnFraction * 0.7;
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
    gradient.addColorStop(0, mixColor(NIGHT_TOP, DAWN_TOP, dawn));
    gradient.addColorStop(1, mixColor(NIGHT_BOTTOM, DAWN_BOTTOM, dawn));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // Stars fade as dawn approaches.
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - dawn * 1.4);
    for (const star of ambient.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(game.ambientTime * star.speed + star.phase);
      ctx.globalAlpha = Math.max(0, (1 - dawn * 1.4)) * twinkle;
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // A soft glow where the glade sleeps, and the grass it sleeps on.
    const glow = ctx.createRadialGradient(
      WORLD.width / 2, WORLD.height / 2, 40,
      WORLD.width / 2, WORLD.height / 2, 420,
    );
    glow.addColorStop(0, 'rgba(255, 217, 138, 0.10)');
    glow.addColorStop(1, 'rgba(255, 217, 138, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    ctx.strokeStyle = 'rgba(74, 96, 64, 0.55)';
    ctx.lineWidth = 1.5;
    for (const tuft of ambient.tufts) {
      ctx.beginPath();
      ctx.moveTo(tuft.x, tuft.y);
      ctx.lineTo(tuft.x + tuft.lean * tuft.size, tuft.y - tuft.size);
      ctx.moveTo(tuft.x + 3, tuft.y);
      ctx.lineTo(tuft.x + 3 - tuft.lean * tuft.size, tuft.y - tuft.size * 0.8);
      ctx.stroke();
    }
  }

  function drawStones() {
    for (const stone of ambient.stones) {
      ctx.save();
      ctx.translate(stone.x, stone.y);
      ctx.rotate(stone.tilt);
      ctx.fillStyle = '#3a3a5e';
      ctx.strokeStyle = '#565684';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 8);
      ctx.lineTo(-6, -stone.height * 0.6);
      ctx.quadraticCurveTo(0, -stone.height, 6, -stone.height * 0.6);
      ctx.lineTo(8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFireflies(game) {
    for (const fly of ambient.fireflies) {
      const x = fly.x + Math.cos(game.ambientTime * fly.speed + fly.phase) * fly.radius;
      const y = fly.y + Math.sin(game.ambientTime * fly.speed * 0.8 + fly.phase) * fly.radius * 0.6;
      const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(game.ambientTime * 1.4 + fly.phase * 2));
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.shadowColor = '#ffe9a8';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShards(game) {
    for (const shard of game.shards) {
      const bob = Math.sin(game.ambientTime * 3 + shard.x) * 2;
      ctx.save();
      ctx.translate(shard.x, shard.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = '#ffd98a';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(-2.5, -2.5, 5, 5);
      ctx.restore();
    }
  }

  function drawEnemy(game, enemy) {
    const flash = enemy.hitFlash > 0;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === 'mote') {
      const squash = 1 + Math.sin(game.ambientTime * 6 + enemy.weavePhase) * 0.08;
      ctx.scale(1, squash);
      ctx.shadowColor = '#8f7bd8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = flash ? '#e8e2ff' : '#5d4ba6';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#9d8ce8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(-4, -3, 2.2, 0, Math.PI * 2);
      ctx.arc(4, -3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'wisp') {
      const sway = Math.sin(game.ambientTime * 4 + enemy.weavePhase) * 3;
      ctx.shadowColor = '#a78bff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = flash ? '#efeaff' : 'rgba(122, 102, 204, 0.92)';
      ctx.beginPath();
      ctx.moveTo(-enemy.radius, enemy.radius * 0.7);
      ctx.quadraticCurveTo(-enemy.radius, -enemy.radius, 0, -enemy.radius);
      ctx.quadraticCurveTo(enemy.radius, -enemy.radius, enemy.radius, enemy.radius * 0.7);
      ctx.quadraticCurveTo(enemy.radius * 0.5, enemy.radius * 0.3 + sway, 0, enemy.radius * 0.8);
      ctx.quadraticCurveTo(-enemy.radius * 0.5, enemy.radius * 0.3 - sway, -enemy.radius, enemy.radius * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(205, 185, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1b1436';
      ctx.beginPath();
      ctx.arc(-4.5, -4, 2.6, 0, Math.PI * 2);
      ctx.arc(4.5, -4, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'bulwark') {
      ctx.shadowColor = '#6f5bb0';
      ctx.shadowBlur = 12;
      ctx.fillStyle = flash ? '#d8d2f2' : '#574a8f';
      ctx.strokeStyle = '#8f7bd8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(angle) * enemy.radius;
        const py = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The Gloam Herald: a crowned shadow with a burning core.
      const breathe = 1 + Math.sin(game.ambientTime * 2.2) * 0.04;
      ctx.scale(breathe, breathe);
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 26;
      ctx.fillStyle = flash ? '#efeaff' : '#2e2358';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd98a';
      for (let i = 0; i < 5; i += 1) {
        const angle = -Math.PI / 2 + (i - 2) * 0.42;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * enemy.radius * 0.8, Math.sin(angle) * enemy.radius * 0.8);
        ctx.lineTo(Math.cos(angle) * (enemy.radius + 12), Math.sin(angle) * (enemy.radius + 12));
        ctx.lineTo(
          Math.cos(angle + 0.18) * enemy.radius * 0.8,
          Math.sin(angle + 0.18) * enemy.radius * 0.8,
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = enemy.enraged ? '#ff7d6b' : '#ff9d6b';
      ctx.beginPath();
      ctx.arc(0, 2, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.arc(0, 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // A thin health bar over anything that has been hurt.
    if (enemy.hp < enemy.maxHp && !enemy.isBoss) {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(10, 10, 25, 0.7)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width, 4);
      ctx.fillStyle = '#a78bff';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 10, width * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawPlayer(game) {
    const player = game.player;
    if (game.state === 'defeat') return;
    const blink = player.hurtTimer > 0 && Math.floor(game.ambientTime * 14) % 2 === 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (blink) ctx.globalAlpha = 0.45;
    const bob = player.moving ? Math.sin(player.walkPhase) * 1.6 : Math.sin(game.ambientTime * 2) * 1;
    ctx.translate(0, bob);
    // The lantern's halo, painted under the Keeper.
    const halo = ctx.createRadialGradient(0, 0, 6, 0, 0, 90);
    halo.addColorStop(0, 'rgba(255, 217, 138, 0.35)');
    halo.addColorStop(1, 'rgba(255, 217, 138, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    // Cloak.
    ctx.fillStyle = '#7a5a2e';
    ctx.strokeStyle = '#a8824a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 12);
    ctx.quadraticCurveTo(-14, -6, 0, -12);
    ctx.quadraticCurveTo(14, -6, 12, 12);
    ctx.quadraticCurveTo(0, 8, -12, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hood and face.
    ctx.fillStyle = '#f2d7b0';
    ctx.beginPath();
    ctx.arc(0, -8, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a2e';
    ctx.beginPath();
    ctx.arc(0, -10, 7, Math.PI, Math.PI * 2);
    ctx.fill();
    // The lantern, held toward the aim.
    const lanternX = Math.cos(player.angle) * 16;
    const lanternY = Math.sin(player.angle) * 16;
    ctx.shadowColor = '#ffd98a';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Nova ring preview while the boon is armed.
    if (player.novaSeconds > 0) {
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(game.ambientTime * 3);
      ctx.strokeStyle = '#ffd98a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.novaRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBolts(game) {
    for (const bolt of game.bolts) {
      const angle = Math.atan2(bolt.vy, bolt.vx);
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(angle);
      ctx.shadowColor = '#ffe9a8';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawOrbs(game) {
    for (const orb of game.orbs) {
      ctx.save();
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e9d5ff';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles(game) {
    for (const particle of game.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFloaters(game) {
    ctx.save();
    ctx.font = 'bold 14px "Trebuchet MS", Verdana, sans-serif';
    ctx.textAlign = 'center';
    for (const floater of game.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  function drawVignette(game) {
    const vignette = ctx.createRadialGradient(
      WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.36,
      WORLD.width / 2, WORLD.height / 2, WORLD.height * 0.75,
    );
    vignette.addColorStop(0, 'rgba(5, 6, 18, 0)');
    vignette.addColorStop(1, 'rgba(5, 6, 18, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // A red pulse at the edges while the Keeper is freshly hurt.
    if (game.player.hurtTimer > 0.35 && game.state === 'playing') {
      ctx.fillStyle = `rgba(255, 60, 40, ${(game.player.hurtTimer - 0.35) * 0.35})`;
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }
  }

  function drawAim(game, pointer) {
    if (game.state !== 'playing' && game.state !== 'boon') return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 233, 168, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pointer.x - 13, pointer.y);
    ctx.lineTo(pointer.x - 5, pointer.y);
    ctx.moveTo(pointer.x + 5, pointer.y);
    ctx.lineTo(pointer.x + 13, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 13);
    ctx.lineTo(pointer.x, pointer.y - 5);
    ctx.moveTo(pointer.x, pointer.y + 5);
    ctx.lineTo(pointer.x, pointer.y + 13);
    ctx.stroke();
    ctx.restore();
  }

  return {
    prepareAmbient,
    draw(game, pointer) {
      prepareAmbient(game.seed);
      ctx.save();
      // Screen shake: a decaying offset, strongest right after a hit.
      if (game.shake > 0) {
        const power = game.shake * game.shake * 12;
        ctx.translate((Math.random() * 2 - 1) * power, (Math.random() * 2 - 1) * power);
      }
      drawBackground(game);
      drawStones();
      drawFireflies(game);
      drawShards(game);
      for (const enemy of game.enemies) drawEnemy(game, enemy);
      drawPlayer(game);
      drawBolts(game);
      drawOrbs(game);
      drawParticles(game);
      drawFloaters(game);
      ctx.restore();
      drawVignette(game);
      drawAim(game, pointer);
    },
  };
}
