# Traffic Simulator 3000 — Game Design Document
*Prototype spec for Claude Code. Target: single-page ThreeJS web build, mobile + desktop.*

## 1. High Concept

You are stuck in gridlock on a boring American freeway. First-person view from the driver's seat. The joke IS the game: traffic barely moves, occasionally surges forward a few feet, then everyone slams their brakes. You never get anywhere. The only way the game ends is if you hit somebody. Your stereo is broken — the only thing it plays is the buttrock cassette that's stuck in it.

**Tone:** Deadpan mundane. No power-ups, no goals, no escape. The tension comes entirely from stop-and-go traffic and the temptation to ride bumpers.

## 2. Tech Stack & Constraints

- **Engine:** Three.js (latest stable), vanilla JS, single HTML file preferred (or minimal file split: `index.html`, `main.js`, `/assets`).
- **No build step required.** CDN import of Three.js is fine.
- **Targets:** Mobile touch (portrait AND landscape should work; landscape preferred) + desktop keyboard/mouse.
- **Performance budget:** 60fps on a mid-range phone. Keep draw calls low — billboarded sprites for cars are the default approach (see §6). No shadows, no postprocessing in v1.
- **Audio:** One looping music track (user-supplied, `/assets/buttrock.mp3`), plus SFX (see §9). Audio must only start after first user interaction (browser autoplay rules).

## 3. Camera & Scene

- **Camera:** Fixed first-person, driver's seat position (~1.2m above road, slightly left of car center for US left-hand drive). Slight FOV ~70°. Camera does NOT rotate with steering — small camera sway (±1–2°) on hard braking/acceleration for feel.
- **Interior:** A cockpit layer rendered in front of the 3D scene — dashboard, windshield frame (A-pillars), rearview mirror, steering wheel, and the stereo/cassette deck. This can be a large transparent PNG plane fixed to the camera, with the steering wheel as a separate rotatable sprite.
- **World:** Straight 3-lane freeway (player in center lane). Road plane with scrolling asphalt texture, dashed lane lines, concrete barrier / sound wall on the right, guardrail + distant hills on the left. Overhead sign gantry that approaches absurdly slowly ("Exit 12 — 1 MILE" that you never reach — recycle/loop it). Flat gradient sky, harsh midday light.
- **Movement illusion:** The player's car stays near the world origin; the road texture scrolls and traffic/scenery move relative to player speed. This avoids floating-point drift and simplifies everything.

## 4. Controls

| Action | Desktop | Mobile |
|---|---|---|
| Steer | A/D or ←/→ keys, OR click-drag the on-screen steering wheel | Touch-drag the steering wheel sprite (rotate around center) |
| Gas | W or ↑, OR hold on-screen GAS pedal | Hold GAS pedal button (bottom right) |
| Brake | S is taken — use Space or ↓, OR hold on-screen BRAKE pedal | Hold BRAKE pedal button (bottom right, left of gas) |
| Stereo toggle | **S key** | **Tap the stereo/cassette deck on the dashboard** |

- Steering is heavily speed-limited: at crawl speeds you can drift within/between lanes slowly. This is lane-keeping micro-steering, not racing.
- Wheel visually rotates up to ±120°; input maps to gentle lateral velocity.
- Auto-center: wheel slowly returns to center when released.
- Gas/brake are analog-feeling but binary input is fine (ramp force over ~0.3s while held).

## 5. Core Simulation — Gridlock Logic

The heart of the game. Traffic is a 1D stop-and-go wave simulation per lane.

**Player car physics (arcade, not realistic):**
- Max speed in a "surge": ~15 mph equivalent. Crawl speed: 0–3 mph. Acceleration is sluggish; braking is strong.
- Creep: with no input, car very slowly rolls forward (~0.5 mph) like an automatic transmission. This forces micro-braking and creates the authentic gridlock fidget.

**NPC traffic behavior (per car):**
- Each NPC follows the car ahead using a simple gap-target model: desired gap ~1.5 car lengths; accelerate gently when gap opens, brake hard when gap closes.
- **Traffic waves:** A global "wave controller" periodically (random 8–25s intervals) releases a surge from the front of a lane: lead cars accelerate briskly for 2–4 seconds (moving maybe 10–30 feet), then the lead car SLAMS brakes with zero warning. The stop propagates backward as a brake-light wave. Most of the time (~85%), all lanes crawl at 0–2 mph with tiny lurches.
- Brake lights: every NPC shows brake lights when decelerating or stopped (swap sprite/texture variant). The wall of red lights ahead is the primary visual language of the game.
- NPCs never crash into each other and never hit the player — the PLAYER is the only source of collisions. NPCs adjacent to the player will honk (SFX) if the player drifts near their lane but they do not dodge.
- Lane distribution: ~6–8 visible cars ahead per lane, 2–3 behind, recycled as they pass out of view. Include one semi truck per session minimum — it blocks the view forward, which is both funny and strategic.

**Fail state — collision:**
- Player front bumper vs. NPC rear bumper (and side collisions when drifting lanes).
- **Tiny bump tolerance:** impact at relative speed below ~1.5 mph = forgiven "love tap": a *thunk* SFX, the NPC's horn, brief screen shake, and a counter ("Bumps: 1"). Allow up to 2 tiny bumps? No — per spec, more than a tiny bump ends it, and a tiny bump is allowed each time. Rule: any single impact above the tolerance threshold = GAME OVER. Impacts below threshold are unlimited but each triggers escalating angry honks.
- **Game over screen:** freeze frame, slight camera tilt, insurance-form aesthetic. Stats shown (see §8). "IGNITION" button to restart.

## 6. Rendering the Cars (fake-3D approach)

Default to **billboarded 2D sprites** ("fake 3D") for v1 — cheaper, funnier, and matches the asset plan:

- Cars ahead: **rear-view sprites** on camera-facing planes, scaled by distance. Brake-light variant swapped via texture offset (sprite sheet) — no material swap.
- Cars in adjacent lanes near the player: **rear-3/4-view sprites** (angled), because a pure rear sprite looks wrong when it's beside you. Use rear-3/4 left for the right lane and rear-3/4 right for the left lane (you see the inner flank).
- Cars behind (in rearview mirror): render the mirror as a small secondary viewport OR fake it with a static-ish sprite of a front-view car that creeps closer/farther. Fake is fine for v1.
- The player's own hood: bottom sliver of the windshield view, part of the cockpit PNG.
- If sprites look too janky in adjacent lanes, fallback: simple box-geometry cars with the sprite textures projected on flat faces. Decide during build; don't gold-plate.

## 7. Audio & the Stereo

- Stereo starts **OFF**. Toggling on plays `/assets/buttrock.mp3` looping, mid-quality, slightly EQ'd (low-pass a touch) so it sounds like blown factory speakers.
- Toggling off pauses (do not reset — the cassette resumes where it left off, because it's stuck in there).
- Dashboard stereo sprite has ON/OFF visual state (little green LED / cassette spindles "animate" via 2-frame flip when playing — stretch goal).
- Ambient loop always on (after first interaction): idle engine drone + distant traffic rumble.
- SFX: brake squeak (player hard brake), horn honks (3–4 variants, pitched randomly), the love-tap *thunk*, big crash sound (game over), turn-signal ticking is a stretch goal.

## 8. UI / HUD

Minimal, diegetic where possible:
- **Odometer / trip meter on the dash:** distance traveled in FEET (the joke stat — after 10 minutes you've gone 300 ft).
- **Session clock:** "Time in traffic: 14:32".
- Game over stats: time survived, feet traveled, average speed (e.g., "0.4 mph"), tiny bumps, and a deadpan title like "COMMUTE TERMINATED."
- Mobile: pedal buttons bottom-right, steering wheel bottom-center-left, all large touch targets (min 64px). Desktop: same visuals, mouse-operable, plus keyboard.
- Start screen: title "TRAFFIC SIMULATOR 3000", "TAP/CLICK TO START YOUR COMMUTE" (this satisfies the audio-unlock interaction).

## 9. Build Order (suggested milestones)

1. Scene: road, scrolling asphalt, sky, barriers, cockpit overlay, camera.
2. Player physics: creep, gas, brake, speed-limited steering + wheel rotation.
3. NPC lane simulation: gap-following, wave controller, brake lights, recycling.
4. Collision + tolerance threshold + game over flow.
5. Touch controls + responsive layout.
6. Audio: stereo toggle (S key + dash tap), ambient, SFX.
7. HUD, start screen, game over stats.
8. Polish pass: camera sway, honk logic, semi truck, sign gantry, heat shimmer (stretch).

## 10. Tuning Constants (put these in one config object)

```
CREEP_SPEED, MAX_SPEED, ACCEL, BRAKE_FORCE,
STEER_RATE, STEER_SPEED_FALLOFF,
WAVE_INTERVAL_MIN/MAX, SURGE_DURATION, SURGE_SPEED,
GAP_TARGET, NPC_BRAKE_HARSHNESS,
BUMP_TOLERANCE_MPH,
CAR_COUNT_PER_LANE, LANE_WIDTH
```
Everything about the feel lives here. Expect to iterate on WAVE_* and BUMP_TOLERANCE the most.

## 11. Explicit Non-Goals (v1)

No exits, no lane count changes, no weather, no day/night, no other maps, no scoring beyond the stat screen, no NPC dodging AI, no damage model, no multiplayer, no saving.
