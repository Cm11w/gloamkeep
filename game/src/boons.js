// The boons offered when the Keeper levels up. Each boon names what it does
// in plain words, applies itself to the player object, and declares how many
// times it may stack. The offer is always three different boons drawn from
// the pool, so every level-up is a real choice.

export const BOONS = [
  {
    id: 'bright',
    glyph: '✦',
    name: 'Bright Bolts',
    text: '+30% bolt damage. Your light bites deeper.',
    maxStacks: 5,
    apply(player) {
      player.damageMul *= 1.3;
    },
  },
  {
    id: 'swift',
    glyph: '≫',
    name: 'Swift Wick',
    text: '+25% fire rate. The lantern sputters faster.',
    maxStacks: 5,
    apply(player) {
      player.fireRateMul *= 1.25;
    },
  },
  {
    id: 'stride',
    glyph: '➤',
    name: 'Long Stride',
    text: '+18% move speed. Outrun the dark.',
    maxStacks: 4,
    apply(player) {
      player.speedMul *= 1.18;
    },
  },
  {
    id: 'sturdy',
    glyph: '⬢',
    name: 'Sturdy Lantern',
    text: '+25 max health, and mend 25 health now.',
    maxStacks: 5,
    apply(player) {
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'twin',
    glyph: '✦✦',
    name: 'Twin Flame',
    text: '+1 bolt per shot, fanned outward.',
    maxStacks: 2,
    apply(player) {
      player.projectiles += 1;
    },
  },
  {
    id: 'pierce',
    glyph: '⟶',
    name: 'Piercing Light',
    text: 'Bolts pass through +1 shadow.',
    maxStacks: 2,
    apply(player) {
      player.pierce += 1;
    },
  },
  {
    id: 'magnet',
    glyph: '◎',
    name: 'Wide Glow',
    text: '+60% ember pull radius. Shards fly to you.',
    maxStacks: 3,
    apply(player) {
      player.magnetMul *= 1.6;
    },
  },
  {
    id: 'nova',
    glyph: '☀',
    name: 'Dawn Nova',
    text: 'Every 6s, a ring of light burns nearby shadows.',
    maxStacks: 3,
    apply(player) {
      if (player.novaSeconds === 0) {
        player.novaSeconds = 6;
        player.novaDamage = 26;
        player.novaRadius = 130;
      } else {
        player.novaSeconds = Math.max(3.5, player.novaSeconds - 1);
        player.novaDamage += 16;
        player.novaRadius += 25;
      }
      player.novaTimer = Math.min(player.novaTimer, 1.2);
    },
  },
  {
    id: 'mend',
    glyph: '❋',
    name: 'Mending Ember',
    text: 'Regenerate +1.2 health per second.',
    maxStacks: 3,
    apply(player) {
      player.regenPerSecond += 1.2;
    },
  },
];

// Draw three distinct boons the player may still take. When every boon is
// maxed out (a very long run), fall back to a healing ember instead.
export function rollBoonOffer(player, random) {
  const available = BOONS.filter((boon) => (player.boons[boon.id] ?? 0) < boon.maxStacks);
  const offer = [];
  const pool = [...available];
  while (offer.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    offer.push(pool.splice(index, 1)[0]);
  }
  while (offer.length < 3) {
    offer.push({
      id: `ember-${offer.length}`,
      glyph: '♥',
      name: 'Warm Ember',
      text: 'Mend 40 health right now.',
      maxStacks: 99,
      apply(target) {
        target.hp = Math.min(target.maxHp, target.hp + 40);
      },
    });
  }
  return offer;
}

export function applyBoon(player, boon) {
  player.boons[boon.id] = (player.boons[boon.id] ?? 0) + 1;
  boon.apply(player);
}
