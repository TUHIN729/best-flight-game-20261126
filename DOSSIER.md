# Sky Courier — The Island Run: dossier

## What it is

A complete HTML5/JavaScript flight game that runs from static files with no
network request. Chase view over a procedural island chain: the twin-prop
courier plane SKY-7 is always in frame, the instruments are lit, a golden
target ring (or the home runway) is always ahead, and altitude, speed and
heading are on the HUD at all times.

## How it plays

- **Take off**: full throttle (W / ↑), pull up (I) past 60 knots.
- **Fly the route**: thread all six golden rings. Each ring is worth 100
  points and the next one is labelled with its distance.
- **Land**: come back to the home runway, gentle and slow, after the last
  ring. A clean landing scores 500 plus a fuel bonus.
- **Fuel and stall are the decisions**: fuel burns with throttle, so a
  heavy hand strands you over the sea; below 52 knots the plane sinks.
  A hard or off-runway touchdown is a crash.
- **Controls**: W/S or ↑/↓ throttle, A/D or ←/→ bank, I/K pitch, mouse
  steers too, SPACE brake, P pause, M sound, R fly again. Best score is
  kept in local storage.

## How it meets the bounty

- Cockpit/chase view over recognisable terrain: raycast-rendered islands,
  sea, beaches, hills and snowcaps, with clouds, sun and distance fog.
- Aircraft in frame with instruments lit: the SKY-7 in chase view, plus a
  lit instrument panel (airspeed, attitude ball, altimeter, fuel) and a
  HUD showing speed in knots, altitude in feet, and a compass tape with
  heading.
- Runway or target ring ahead: the home runway is visible from the start,
  and the next golden ring is always labelled ahead.
- Keyboard and mouse, desktop browser, static files only: no build step,
  no network request, every asset is a file under `game/` or synthesised
  in code (the engine hum, wind and chimes are WebAudio, no audio files).
- Original: own name, art, sounds and island route; no commercial game's
  names, characters, art, music or levels.

## Source layout

- `game/index.html` — the page; a 1280×720 canvas, nothing else.
- `game/src/config.js` — every tunable number: world, rings, flight
  model, scoring, palette.
- `game/src/random.js` — seeded RNG and smooth value noise for terrain.
- `game/src/terrain.js` — `heightAt(x, z)`, ground colours, the runway.
- `game/src/plane.js` — the flight model: throttle, bank, stall, fuel,
  rings, landing and crash.
- `game/src/render.js` — sky, raycast terrain, rings, the plane, HUD and
  the lit gauges.
- `game/src/audio.js` — synthesised engine, wind and chimes (WebAudio).
- `game/src/input.js` — keyboard and mouse, merged into one control frame.
- `game/src/shots.js` — deterministic `?shot=` setups for screenshots.
- `game/src/main.js` — the state machine (title / flying / paused /
  landed / crashed) and the game loop.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with `vendor/makefun-game.ts`.
- `vendor/makefun-game.ts` — the kit's library, unchanged.

## Screenshots

Four real renders of the game's own code, taken in headless Chromium at
1280×720:

1. `1-start.jpg` — title screen, SKY-7 on the runway, rings on the horizon.
2. `2-play.jpg` — mid-flight over the coast, ring 3 ahead, HUD live.
3. `3-ring.jpg` — just through ring 4, banked, next ring labelled.
4. `4-landed.jpg` — landed on the runway, score shown.

## Verification

Loaded in headless Chromium from a static server with zero console
errors and zero failed requests. Interactive check: Enter starts the
flight, W spools the throttle, I rotates at 60 knots, the plane climbs
and flies (verified airborne at 215 units, 185 knots). The `?shot=`
states were screenshot from the same running code.
