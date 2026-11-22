[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/Dimah28/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/Dimah28/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

# Velvet Hour

A top-down stealth game for the [make.fun best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759).

You are Wren, a cat burglar with three brass buttons and a quiet pair of
shoes. The Gilded Marionette hangs above the stage of the Marlow Theatre,
and four ushers walk the dark with lanterns. Lift it. Leave unseen.

## How it plays

- **WASD / arrows** move, **Shift** sneaks (slow, quiet, hard to spot),
  **Space** sprints (fast, loud).
- **Mouse aim + click** throws a brass button. It clinks where it lands and
  every usher in earshot goes to look.
- **E** pockets a gilt playbill, takes the Marionette, and slips out the
  stage door once the prize is yours.
- **Vision cones** are what an usher sees. **Footlights** stretch how far
  they see; **shadow** shrinks it. **Velvet curtains** hide you outright;
  **seat rows** hide you only while you sneak; **stage boards creak**
  unless you sneak across them.
- **Three strikes** and the house wins. Finish never spotted and the night
  pays a $500 ghost bonus. **H** opens Wren's field notes, **M** mutes,
  **P** pauses, **R** retries.

## Run it

Serve `game/` with any static server and open `index.html` in desktop
Chrome. No build step, no network, no assets beyond the files in `game/`.

```sh
node --run serve 2>/dev/null || (cd game && python3 -m http.server 8080)
```

Screenshots are staged with `?shot=start|play|end&seed=1` — real renders of
the game's own code, frozen at a fixed tick.

## Layout

- `game/index.html` — page shell and the HUD
- `game/css/style.css` — the theatre's look
- `game/src/level.js` — the Marlow Theatre: rooms, cover, lamps, patrols
- `game/src/guards.js` — usher AI: patrol, suspicion, investigation, chase
- `game/src/player.js` — Wren: movement, stance, noise, the brass button
- `game/src/render.js` — everything the eye sees, cones and callouts
- `game/src/audio.js` — sound, synthesized live with WebAudio
- `game/src/game.js` — state, loop, input, HUD and endings
- `game/src/rng.js` — seeded random numbers
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
