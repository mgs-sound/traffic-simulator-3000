# Traffic Simulator 3000 — Asset Spec (for image-gen AI)

**Global rules for every asset:**
- Transparent background PNG unless noted. No drop shadows baked in.
- Consistent style across all assets: slightly cartoonish, clean flat shading with simple highlights — think "mobile game car," not photoreal. Muted, sun-bleached daytime palette.
- Consistent light source: harsh midday sun from directly above / slightly front.
- Consistent perspective per view type (see below) so sprites can be swapped freely.
- Power-of-two friendly canvas sizes listed per asset (game will scale down).

---

## A. Vehicle sprites (the big one)

**Vehicle types (5):** sedan, SUV, pickup truck, hatchback/beater, semi truck with box trailer.
**Colors per passenger vehicle (4):** silver, white, dark red, navy. Semi: 1 color (white cab, plain dirty-white trailer).
That's 4×4 + 1 = **17 vehicle variants.** Each variant needs the views below.

### A1. Rear view (dead-on, seen from behind at driver eye height)
- Two states each: **brake lights OFF** and **brake lights ON** (bright red glow, slight bloom).
- Camera height ~1.2m, looking straight up the lane. Very slight downward view of trunk/roofline.
- Canvas: 512×512, vehicle filling ~85% width. Semi trailer: 512×1024 (it's tall — trailer doors, mudflaps, "HOW'S MY DRIVING" sticker optional gag).

### A2. Rear-3/4 view, LEFT side visible (for cars in the lane to your RIGHT)
- ~30° off-axis, same eye height. Brake OFF + ON states.
- Canvas: 768×512.

### A3. Rear-3/4 view, RIGHT side visible (for cars in the lane to your LEFT)
- Mirror composition of A2 (generate separately or flip — flipping is fine if there's no text/badging; keep badging off side panels to allow flipping and cut asset count in half).
- Canvas: 768×512.

### A4. Front view (for the rearview mirror car)
- Dead-on front, headlights off, one per vehicle type in one color each (5 images).
- Canvas: 512×512.

**Sprite-sheet packing:** deliver each vehicle as ONE sheet: 2 columns (brake off/on) × rows for each view. Or individual PNGs — builder can pack them. Name format: `car_{type}_{color}_{view}_{brake}.png`.

**Detail notes:** visible driver silhouette through rear window (generic head shape) sells it. One sedan variant with a "My kid is an honor student" bumper sticker, one beater with duct-taped taillight = free comedy.

## B. Cockpit / interior

### B1. Dashboard + windshield frame overlay (the hero asset)
- Full-frame overlay: A-pillars left/right, top of windshield with rearview mirror housing (mirror glass area TRANSPARENT — game renders into it), dashboard bottom third, sliver of hood at the very bottom.
- Include on the dash: instrument cluster (speedo maxes at 120, needle will sit near 0 — can be static art), air vents, and a clearly tappable **stereo head unit with a cassette slot, cassette visibly jammed in it**.
- Leave the CENTER of the steering column EMPTY — wheel is a separate layer.
- Style: aging 90s–2000s commuter car interior, gray plastic.
- Canvas: 2048×1152 (16:9), transparent where the windshield is. Also a 1152×2048 portrait crop/variant if easy.

### B2. Steering wheel (separate, rotatable)
- Dead-center front view, perfectly circular rim, transparent background, centered on canvas so it rotates around canvas center cleanly.
- Worn gray/black, faded horn button.
- Canvas: 1024×1024.

### B3. Stereo states (2 small sprites or one 2-frame sheet)
- Same head unit as B1 close-up: OFF (dark) and ON (green LED lit, faint backlit display reading "TAPE").
- Canvas: 512×256 each.

## C. Environment

### C1. Road texture (tiling)
- Top-down asphalt, seamlessly tiling vertically: gray, cracked, oil stains, tire wear lines. NO lane lines baked in (lines drawn separately) — OR provide a second variant WITH a white dashed line down the center. Deliver both.
- Canvas: 512×512, seamless top-to-bottom.

### C2. Concrete barrier / sound wall (tiling strip)
- Side view, seamlessly tiling horizontally: beige highway sound wall with stains and one patch of scrubbed-off graffiti.
- Canvas: 1024×256.

### C3. Guardrail strip (tiling)
- Side view, seamless horizontal: standard W-beam metal guardrail with posts.
- Canvas: 1024×128.

### C4. Distant scenery backdrop (tiling)
- Wide horizontal strip: hazy brown-green hills, a few power lines, maybe a distant billboard back. Flat, low-detail, sits at horizon.
- Canvas: 2048×256, seamless horizontal.

### C5. Overhead sign gantry
- Green freeway sign on a gantry viewed from the road: "EXIT 12 — 1 MILE" in Highway Gothic style lettering. Front view.
- Canvas: 1024×512.

### C6. Sky
- Simple gradient, washed-out blue to hazy white at horizon, faint smog band. Can also be done in-code; asset optional.
- Canvas: 1024×512.

## D. UI

### D1. Pedals (2 sprites, each with pressed + unpressed states)
- GAS: vertical rubber accelerator pedal. BRAKE: wide brake pedal. Chunky, readable at small size, looks good as a touch button.
- Canvas: 256×384 each state.

### D2. Title art (optional, stretch)
- "TRAFFIC SIMULATOR 3000" logo: chrome 90s racing-game lettering over a wall of red brake lights. Ironic AAA energy.
- Canvas: 1024×512.

### D3. Game-over card background (optional)
- Faux insurance claim form / clipboard texture, empty space in the middle for stats text.
- Canvas: 1024×1024.

---

## Priority order if generating in batches
1. B1 dashboard, B2 wheel (the game IS this view)
2. A1 rear views, sedan + SUV + semi, brake off/on
3. C1 road, C4 backdrop, C2 barrier
4. A2/A3 3/4 views
5. Everything else

**Total minimum viable set:** ~14 images (dash, wheel, 3 vehicles × rear × 2 brake states, road, backdrop, barrier, 2 pedals, stereo states).
