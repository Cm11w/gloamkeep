// All sound is synthesised with WebAudio: no audio files, no network. Short
// oscillator blips carry the feedback (shots, hits, pickups) and a slow pad
// progression carries the night mood. Everything starts on the player's first
// gesture, as browsers require, and M or the mute button silences it all.

import { AUDIO } from './config.js';

const CHORDS = [
  [110.0, 164.81, 220.0], // A minor
  [87.31, 130.81, 196.0], // F major
  [98.0, 146.83, 220.0], // G colour
  [110.0, 164.81, 261.63], // A minor, lifted
];

export function createAudio() {
  let context = null;
  let master = null;
  let musicBus = null;
  let muted = false;
  let musicTimer = null;
  let chordIndex = 0;
  let started = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      context = new AudioContextClass();
    } catch {
      return false;
    }
    master = context.createGain();
    master.gain.value = muted ? 0 : AUDIO.masterGain;
    master.connect(context.destination);
    musicBus = context.createGain();
    musicBus.gain.value = AUDIO.musicGain;
    musicBus.connect(master);
    return true;
  }

  function tone({ frequency, endFrequency, type = 'sine', seconds = 0.12, gain = 0.5, delay = 0, bus = null }) {
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + seconds);
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(envelope);
    envelope.connect(bus ?? master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function noise({ seconds = 0.15, gain = 0.3, delay = 0, lowpass = 1200 }) {
    if (!context) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
  }

  function playChord() {
    if (!context) return;
    const chord = CHORDS[chordIndex % CHORDS.length];
    chordIndex += 1;
    for (const frequency of chord) {
      tone({ frequency, type: 'triangle', seconds: 4.6, gain: 0.5, bus: musicBus });
      tone({ frequency: frequency * 2, type: 'sine', seconds: 4.6, gain: 0.16, bus: musicBus });
    }
  }

  return {
    // Call from a click or key press. Safe to call repeatedly.
    unlock() {
      if (!ensure()) return;
      if (started) return;
      started = true;
      playChord();
      musicTimer = window.setInterval(playChord, 4200);
    },
    setMuted(next) {
      muted = next;
      if (master && context) master.gain.value = muted ? 0 : AUDIO.masterGain;
    },
    isMuted() {
      return muted;
    },
    stopMusic() {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
      started = false;
    },
    click() {
      tone({ frequency: 660, endFrequency: 520, type: 'triangle', seconds: 0.07, gain: 0.25 });
    },
    shoot() {
      tone({ frequency: 880, endFrequency: 340, type: 'square', seconds: 0.07, gain: 0.10 });
    },
    enemyHit() {
      tone({ frequency: 240, endFrequency: 140, type: 'sawtooth', seconds: 0.06, gain: 0.12 });
    },
    enemyDie() {
      tone({ frequency: 320, endFrequency: 60, type: 'sawtooth', seconds: 0.22, gain: 0.22 });
      noise({ seconds: 0.16, gain: 0.16, lowpass: 900 });
    },
    pickup(combo = 0) {
      const base = 523.25 * Math.pow(2, Math.min(combo, 8) / 12);
      tone({ frequency: base, type: 'sine', seconds: 0.14, gain: 0.3 });
      tone({ frequency: base * 1.5, type: 'sine', seconds: 0.18, gain: 0.22, delay: 0.05 });
    },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', seconds: 0.3, gain: 0.3, delay: i * 0.08 });
      });
    },
    dash() {
      noise({ seconds: 0.18, gain: 0.2, lowpass: 2600 });
    },
    hurt() {
      tone({ frequency: 160, endFrequency: 55, type: 'sawtooth', seconds: 0.25, gain: 0.35 });
      noise({ seconds: 0.12, gain: 0.2, lowpass: 700 });
    },
    bossBurst() {
      tone({ frequency: 98, endFrequency: 49, type: 'sawtooth', seconds: 0.5, gain: 0.3 });
    },
    nova() {
      tone({ frequency: 220, endFrequency: 880, type: 'sine', seconds: 0.35, gain: 0.3 });
      tone({ frequency: 440, endFrequency: 1320, type: 'triangle', seconds: 0.3, gain: 0.18, delay: 0.05 });
    },
    waveClear() {
      [392.0, 523.25, 659.25].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', seconds: 0.25, gain: 0.25, delay: i * 0.09 });
      });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', seconds: 0.5, gain: 0.3, delay: i * 0.13 });
      });
    },
    defeat() {
      [392.0, 329.63, 261.63, 196.0].forEach((frequency, i) => {
        tone({ frequency, type: 'triangle', seconds: 0.55, gain: 0.28, delay: i * 0.18 });
      });
    },
  };
}
