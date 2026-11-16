// The DOM layer: HUD bars, banners, menus and buttons. The canvas paints the
// world; this file is everything the player reads — health, embers, wave,
// dawn, the boss, and every screen between runs. It polls the game once per
// frame and only touches the DOM when a value actually changed.

import { PLAYER } from './config.js';

export function createUi(callbacks) {
  const $ = (id) => document.getElementById(id);
  const elements = {
    hud: $('hud'),
    hpFill: $('hp-fill'),
    hpText: $('hp-text'),
    xpFill: $('xp-fill'),
    levelText: $('level-text'),
    scoreText: $('score-text'),
    waveText: $('wave-text'),
    dawnFill: $('dawn-fill'),
    dashFill: $('dash-fill'),
    dashText: $('dash-text'),
    bossBar: $('boss-bar'),
    bossFill: $('boss-fill'),
    bossName: $('boss-name'),
    banner: $('banner'),
    hint: $('hint'),
    titleScreen: $('screen-title'),
    boonScreen: $('screen-boon'),
    boonCards: $('boon-cards'),
    pauseScreen: $('screen-pause'),
    victoryScreen: $('screen-victory'),
    defeatScreen: $('screen-defeat'),
    bestScoreText: $('best-score-text'),
    victoryStats: $('victory-stats'),
    defeatStats: $('defeat-stats'),
    muteButton: $('mute-button'),
    pauseButton: $('pause-button'),
  };

  let lastOffer = null;
  let lastState = '';
  let lastStatsKey = '';

  function show(element, visible) {
    element.classList.toggle('hidden', !visible);
  }

  function setBar(fill, fraction) {
    const percent = `${Math.max(0, Math.min(100, fraction * 100)).toFixed(1)}%`;
    if (fill.style.width !== percent) fill.style.width = percent;
  }

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function statsLine(stats) {
    const minutes = Math.floor(stats.timeSeconds / 60);
    const seconds = String(stats.timeSeconds % 60).padStart(2, '0');
    return `Score ${stats.score} · Best ${stats.best} · ${stats.kills} shadows banished · Level ${stats.level} · ${stats.wavesCleared} waves held · ${minutes}:${seconds}`;
  }

  function buildBoonCards(game) {
    elements.boonCards.innerHTML = '';
    game.pendingBoons.forEach((boon, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'boon-card';
      card.innerHTML = '';
      const glyph = document.createElement('span');
      glyph.className = 'boon-glyph';
      glyph.textContent = boon.glyph;
      const name = document.createElement('span');
      name.className = 'boon-name';
      name.textContent = boon.name;
      const text = document.createElement('span');
      text.className = 'boon-text';
      text.textContent = boon.text;
      const key = document.createElement('span');
      key.className = 'boon-key';
      key.textContent = `Press ${index + 1}`;
      card.append(glyph, name, text, key);
      card.addEventListener('click', () => callbacks.onChooseBoon(index));
      elements.boonCards.append(card);
    });
  }

  function bindButton(id, handler) {
    const button = $(id);
    if (button) button.addEventListener('click', handler);
  }

  bindButton('start-button', callbacks.onStart);
  bindButton('resume-button', callbacks.onResume);
  bindButton('restart-button-pause', callbacks.onRestart);
  bindButton('restart-button-victory', callbacks.onRestart);
  bindButton('restart-button-defeat', callbacks.onRestart);
  bindButton('quit-button-pause', callbacks.onQuitToTitle);
  elements.muteButton.addEventListener('click', callbacks.onToggleMute);
  elements.pauseButton.addEventListener('click', callbacks.onTogglePause);

  return {
    setMuted(muted) {
      elements.muteButton.textContent = muted ? '♪ Off' : '♪ On';
      elements.muteButton.setAttribute('aria-pressed', String(muted));
    },

    sync(game) {
      const player = game.player;
      const inRun = game.state === 'playing' || game.state === 'boon' || game.state === 'paused';
      show(elements.hud, inRun);
      show(elements.hint, game.state === 'playing');
      show(elements.titleScreen, game.state === 'title');
      show(elements.pauseScreen, game.state === 'paused');
      show(elements.victoryScreen, game.state === 'victory');
      show(elements.defeatScreen, game.state === 'defeat');
      show(elements.boonScreen, game.state === 'boon');

      if (game.state === 'boon' && game.pendingBoons !== lastOffer) {
        lastOffer = game.pendingBoons;
        buildBoonCards(game);
      }
      if (game.state !== 'boon') lastOffer = null;

      if (inRun) {
        setBar(elements.hpFill, player.hp / player.maxHp);
        setText(elements.hpText, `${Math.ceil(player.hp)} / ${player.maxHp}`);
        setBar(elements.xpFill, player.xp / player.xpNext);
        setText(elements.levelText, `Lv ${player.level}`);
        setText(elements.scoreText, `Score ${game.score}`);
        const wave = game.director ? Math.max(1, game.director.wave) : 1;
        setText(elements.waveText, `Wave ${wave} / 8`);
        setBar(elements.dawnFill, game.dawnFraction);
        const dashReady = player.dashCooldown <= 0;
        const dashMax = PLAYER.dashCooldownSeconds * player.dashCooldownMul;
        setBar(elements.dashFill, dashReady ? 1 : 1 - player.dashCooldown / dashMax);
        setText(elements.dashText, dashReady ? 'Dash ready' : 'Dashing…');
        const bossVisible = game.bossAlive;
        show(elements.bossBar, bossVisible);
        if (bossVisible) {
          setBar(elements.bossFill, game.boss.hp / game.boss.maxHp);
          setText(elements.bossName, 'Gloam Herald');
        }
      }

      if (game.bannerTimer > 0) {
        setText(elements.banner, game.bannerText);
        elements.banner.classList.remove('hidden');
        elements.banner.style.opacity = String(Math.min(1, game.bannerTimer));
      } else {
        elements.banner.classList.add('hidden');
      }

      if (game.state === 'title') {
        setText(
          elements.bestScoreText,
          game.bestScore > 0 ? `Best score: ${game.bestScore}` : 'No dawn has broken yet. Good luck, Keeper.',
        );
      }
      if ((game.state === 'victory' || game.state === 'defeat') && lastState !== game.state) {
        const stats = game.runStats;
        const key = `${game.state}-${stats.score}-${stats.timeSeconds}`;
        if (key !== lastStatsKey) {
          lastStatsKey = key;
          const line = statsLine(stats);
          if (game.state === 'victory') setText(elements.victoryStats, line);
          else setText(elements.defeatStats, line);
        }
      }
      lastState = game.state;
    },
  };
}
