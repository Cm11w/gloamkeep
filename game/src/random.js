// A small seeded random generator (mulberry32). One stream drives the whole
// run, so `?seed=N` replays the same waves, the same boon offers and the same
// starfield — which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(random, min, max) {
  return min + random() * (max - min);
}

export function randomInt(random, min, max) {
  return Math.floor(randomRange(random, min, max + 1));
}

export function randomPick(random, items) {
  return items[Math.floor(random() * items.length)];
}

// Weighted pick: `entries` are [value, weight] pairs.
export function randomWeighted(random, entries) {
  let total = 0;
  for (const [, weight] of entries) total += weight;
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Fisher–Yates shuffle that consumes the shared stream.
export function shuffleInPlace(random, items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
