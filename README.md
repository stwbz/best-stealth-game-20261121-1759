# MOTHLIGHT — A Quiet Heist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/stwbz/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/stwbz/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down stealth game for the make.fun bounty **"Make the best stealth game"**
(`best-stealth-game-20261121-1759`, pot $50, deadline 2026-11-22 12:59 WIB).
Original idea, art, sounds and names — no commercial game copied.

You are a moth-thief in a lamplit archive at night. Steal **3 lantern shards**,
then slip out the green **EXIT** — without a guard ever seeing you.

## How to play

- **WASD / arrow keys** — move
- **Shift (hold)** — sneak: slower, quieter, guards spot you much more slowly
- **P / Esc** — pause · **R** — restart · **Space / click** — start / play again
- **3 attempts.** Get caught 3 times and the archive keeps its shards.

## The rules

- **Vision cones (yellow)** are watching eyes. A guard only sees you inside
  its cone *and* with a clear line of sight — walls and wooden crates block
  sight, so cover really hides you.
- **Detection meter** (top-right): rises while a guard sees you — faster up
  close, slower while sneaking — and falls when nobody sees you. At full it
  turns red: **SPOTTED!** and the guard gives chase.
- **Walking loud is heard**: moving at full speed near a guard raises the
  meter even unseen. Guard footsteps are audible when one is close.
- **Chase:** outrun the guard (you walk faster than they chase) and break
  line of sight for a few seconds — they give up and return to patrol, still
  suspicious. If one touches you, you lose an attempt and wake up back at
  the door.
- **Exit opens only after all 3 shards.** Score: 100 per shard + a time bonus
  for a fast, clean escape.

Guards patrol fixed loops and pause at each waypoint, scanning around — learn
the patrols, time your crossings, and let the cones sweep past.

## Files

```
main.ts            hands the entry in (copies game/ + screenshots/, writes dossier.json)
serve.ts           tiny local static server: node serve.ts -> http://localhost:8080
shots.json         the 4 screenshot scenes (?shot=play|start|alert|end &seed=1)
LICENSE            MIT
game/
  index.html       canvas page, no external references at all
  src/
    config.js      tuning numbers, palette, level layout (walls, crates, shards, exit, patrols)
    level.js       geometry: raycasts, line-of-sight, vision-cone polygons, collision
    guards.js      patrols, vision, detection meter, chase / return
    world.js       player, shards, exit, attempts, timer, score
    input.js       keyboard + pointer
    audio.js       WebAudio synth sounds (footsteps, pickup, alarm, caught, win) — no files
    render.js      all drawing: floor, lamps, cones, crates, guards, thief, HUD, panels
    shots.js       deterministic screenshot scenes (autopilot plays the real rules)
    random.js      seeded RNG (mulberry32)
    main.js        boot + fixed-step loop + screens (title/play/paused/win/over)
screenshots/
  1-play.jpg       cover: mid-heist, cones + crates + shards + exit in one frame
  2-start.jpg      title screen over the level
  3-alert.jpg      SPOTTED! — red chase cone closing on the thief
  4-end.jpg        win screen: "Unseen. Unheard. Out."
```

## Test locally

```sh
node serve.ts            # play at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the hand-in
```

## Verification (2026-11-22, post-open rebuild)

- `node --check` passes on all 10 game sources + `main.ts`.
- `main.ts` run twice → byte-identical `out/` (`diff -r` clean). Dossier
  471,469 bytes (< 1.5 MiB cap); total `out/` 837,891 bytes; `game/` 60 KiB.
- Screenshots are real renders of this game's own code in headless Chrome
  (Playwright `chrome-headless-shell`, 1280×720, `?shot=…&seed=1`), converted
  to JPEG q82: 60–87 KiB each (cap 256 KiB), 1280×720 (long side ≤ 1280,
  short side ≥ 480).
- No console errors on the plain page or any shot page; no network references
  anywhere in `game/` (no `http(s):`, no `fetch`, all imports relative).
- Playability, simulated in Node with the real rules (route: top corridor
  to shard 1, right side down to shard 2, bottom corridor to shard 3, then
  the exit): a patient bot (sneak near guards, back off when the meter
  passes half, flee at walk speed when chased) wins clean in 34.3 s,
  score 712, 0 catches; a reckless bot (always walk, never sneak, same
  route) is caught 3 times and loses in 39.6 s, score 100 — patience is
  rewarded, charging in is punished.
- Cover re-staged at 6.5 s (was 15 s): the autopilot reaches shard 1 at
  ~8.3 s, so the old cover showed "Shards 1/3" with one diamond gone. At
  6.5 s the thief stands mid-top-corridor on open dark floor, outside every
  lamp pool, and all 3 shards are visible. No clean mid-detection frame
  exists on either autopilot route (patient peaks at 0.08, bold jumps
  0.40 → 0.98 in half a second with a shard already taken), so the cover
  stays clean rather than faked — the detection system is shown by the
  alert shot's full red meter and chase cone.
- UI polish (21st.dev patterns, translated to Canvas 2D): glass HUD pills,
  aurora title glow, liquid-glass CTA pill, gradient shimmer title,
  upgraded detection meter, guard footstep ripples, stronger thief rim and
  lantern glow. No gameplay rule changed; all motion is a function of
  elapsed time, so screenshots stay reproducible at `?shot=…&seed=1`.
- One bug found and fixed during testing: guards and the player rendered as
  invisible (only their lantern/face dots showed) because `render.js` read
  `guard.radius` / `player.radius`, which do not exist — the radius lives in
  `config.js` (`GUARD.radius` / `PLAYER.radius`), and `arc()` silently
  ignores a NaN radius. Fixed to use the config values; both are clearly
  visible in the final screenshots.
- Chrome note: the VM's `/opt/meta-chromium/chrome` (Muse Browser) refuses
  to start headless here ("Hatch WebGL domain policy is required for browser
  startup"), so screenshots were taken with Playwright's
  `chrome-headless-shell` 159 instead — same Chromium engine, real renders.
  The game itself needs no special browser: plain Canvas 2D + WebAudio.

## Status — NOT submitted

Local entry only. Still needed before the deadline (2026-11-22 12:59 WIB):

1. Create a public GitHub repo (created after the competition opened) with
   these files + LICENSE, on the `stwbz` account.
2. Submit via make.fun (repo + commit + transcripts) and watch the dev grade.
3. Payout wallet: the agent wallet from the CSV entry, or the linked wallet
   on the make.fun profile — confirm before submitting.
