# GLOAMKEEP — Hold the Last Light

An original single-player arena survival game that plays fully offline in a
desktop browser. You are the Keeper of the last lantern in a night glade.
Shadows rise from the treeline in eight waves; gather the embers they drop,
choose a boon at every level-up, and stand against the Gloam Herald when the
night is at its darkest. Hold all eight waves and dawn breaks — you win.

No libraries, no build step, no network requests: plain HTML, CSS and ES
modules, with all art drawn on canvas and all sound synthesised with WebAudio.

## How to play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome (any static file server
works — serve the `game/` folder).

| Control | Action |
|---|---|
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left click / Space | Fire light bolts |
| Shift | Dash (briefly untouchable) |
| P / Esc | Pause / resume |
| M | Sound on / off |
| 1 / 2 / 3 | Pick a boon on level-up |
| R / Enter | Restart from the victory or defeat screen |

## The loop

- **Waves 1–8.** Each wave trickles shadows in from the edges; the wave ends
  when the last one falls. Motes are fast and frail, Wisps weave as they close
  in, Bulwarks are slow walls of shadow. Wave 8 brings the **Gloam Herald**,
  who fires rings of shadow orbs, summons motes as it weakens, and rages below
  a quarter of its health.
- **Embers.** Fallen shadows burst into embers. Gather them to level up.
- **Boons.** Every level-up pauses the night and offers three boons — damage,
  fire rate, speed, health, extra bolts, piercing, magnet range, a periodic
  Dawn Nova, regeneration. Choices stack and shape the run.
- **Dawn meter.** Every cleared wave brings the dawn visibly closer in the
  sky and on the HUD. Clearing wave 8 wins the run; falling to the shadows
  ends it. Score, kills, level, waves held and time are shown on both end
  screens, and the best score is kept on the title screen.

## Determinism and screenshots

- `?seed=N` fixes a run's waves, boon offers and starfield.
- `?shot=title|play|boon|victory|defeat` stages a screenshot scene by playing
  the real simulation forward from a fixed seed, then freezes the frame and
  sets `window.__shotReady`. The shots in `screenshots/` were taken this way,
  unedited, from the game's own code.

## Layout

```text
game/
  index.html        Page, HUD, menus
  style.css         Palette, HUD bars, screens, boon cards
  src/
    main.js         Boot, fixed-step loop, out-of-game keys
    config.js       All tuning numbers
    game.js         State machine + simulation (title/playing/boon/paused/victory/defeat)
    entities.js     Entity factories
    waves.js        Wave director + Herald behaviour
    boons.js        Boon pool and offers
    render.js       All canvas drawing
    ui.js           DOM HUD and screens
    input.js        Keyboard + mouse
    audio.js        Synthesised WebAudio sound and music
    random.js       Seeded RNG
    shots.js        Screenshot staging through the real simulation
main.ts             Entry program: copies game/ + screenshots/, writes dossier.json
serve.ts            Tiny static server for local play
shots.json          The four screenshot scenes
vendor/             The kit's makefun-game.ts, unchanged
```

## License

MIT — see `LICENSE`.
