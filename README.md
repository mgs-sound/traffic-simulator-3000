# TRAFFIC SIMULATOR 3000

You are stuck in gridlock on a boring American freeway, first-person, from the
driver's seat. Traffic barely moves. Every so often the lane ahead surges
forward a few feet and then everyone slams their brakes for no reason you will
ever learn. There are no power-ups, no objectives and no exit — the odometer
counts in **feet**, and after ten minutes you will have travelled about three
hundred of them. The only way the game ends is if you hit somebody: taps under
1.5 mph are forgiven as "love taps" and earn you an angry horn, anything harder
ends your commute with an insurance form. Your stereo is broken and the only
thing it plays is the buttrock cassette stuck in the deck.

Built with Three.js, vanilla JS, no build step.

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Gas | `W` or `↑` | Hold the **GAS** pedal (bottom right) |
| Brake | `Space` or `↓` | Hold the **BRAKE** pedal (left of gas) |
| Steer | `A` / `D` or `←` / `→` | Drag the steering wheel to rotate it |
| Stereo on/off | `S` | Tap the cassette deck on the dash |
| Start / restart | Click or tap | Click or tap |

Steering is heavily speed-limited: at a dead stop the wheel turns but the car
does not. This is lane-keeping micro-steering, not racing.

## Running locally

The page uses ES modules, so it must be served over HTTP — opening
`index.html` from `file://` will not work.

```bash
npx serve
```

Then open the URL it prints. Any static server works, e.g.
`python3 -m http.server 8000`.

## Layout

```
index.html    shell, start screen, game-over form
main.js       engine: scene, physics, traffic sim, audio, cockpit overlay
config.js     every tuning constant and asset path
assets/       sprite atlases, cockpit, road and roadside art
```

All tuning lives in `config.js` — the traffic wave timings (`WAVE_*`) and
`BUMP_TOLERANCE_MPH` are the two you will want to play with first.

## Assets

The art in `/assets` is tracked and ships with the game. Every asset is loaded
through a single lookup in `config.js`; if a file is missing the game logs a
console warning and falls back to a procedurally generated placeholder rather
than crashing, so the project always runs.

**`assets/buttrock.mp3` is deliberately untracked.** Drop your own looping
track in at that path and the stereo will play it, EQ'd to sound like blown
factory speakers. Without it the stereo still works — it plays a synthesised
placeholder riff instead, and the dash reads `SIDE A`.

## Sprite atlases

Vehicle sheets are segmented from their **alpha content**, not sliced on a
uniform grid, because two of them are not uniform: the rear-3/4 sheet packs its
cars at three different scales with the navy pair touching, and the fronts
sheet has three vehicles on one row and two on the other. Each sprite's quad is
sized by matching its measured body box to a real-world vehicle width, which
also normalises those mixed scales. Brake lights are a UV offset swap on a
shared texture — never a material swap — and both frames of a pair share one
window anchored on the body box so toggling cannot shift the sprite.
