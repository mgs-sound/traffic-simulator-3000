// =============================================================================
//  TRAFFIC SIMULATOR 3000 — tuning constants (GDD §10)
//  Everything about the *feel* lives here. Expect to iterate on WAVE_* and
//  BUMP_TOLERANCE_MPH the most.
//
//  UNITS: the sim runs in metres and metres/second. The HUD lies to you in
//  feet and mph, because that is the joke.
// =============================================================================

export const MPH = 0.44704;  // 1 mph in m/s
export const FT  = 3.280839; // 1 m in feet

export const CFG = {

  // ---------------------------------------------------------------- player --
  CREEP_SPEED:  0.5 * MPH,  // automatic-transmission idle roll. Forces micro-braking.
  MAX_SPEED:   15.0 * MPH,  // absolute ceiling, only reachable mid-surge
  ACCEL:            1.9,    // m/s² — deliberately sluggish
  BRAKE_FORCE:      7.6,    // m/s² — brakes are strong, that is the whole tension
  COAST_DRAG:       1.15,   // m/s² decel when off both pedals and above creep
  PEDAL_RAMP:       0.30,   // s to reach full pedal force (GDD §4 "analog-feeling")

  // --------------------------------------------------------------- steering --
  STEER_RATE:          1.25, // m/s lateral velocity at full lock
  STEER_SPEED_FALLOFF: 1.60, // m/s of forward speed for FULL steering authority.
                             // Below this, steering scales down; at a dead stop
                             // the wheel turns but the car does not.
  WHEEL_MAX_DEG:     120,    // visual lock-to-lock (GDD §4)
  WHEEL_TURN_RATE:   235,    // deg/s while a key is held
  WHEEL_RETURN_RATE: 165,    // deg/s auto-centre when released

  // ------------------------------------------------------- the wave engine --
  // A lane spends ~85% of its life crawling. Every WAVE_INTERVAL seconds the
  // FRONT of the lane is released; it accelerates for SURGE_DURATION and then
  // the lead car slams to zero with no warning. The stop propagates backwards.
  WAVE_INTERVAL_MIN:  8.0,
  WAVE_INTERVAL_MAX: 25.0,
  SURGE_DURATION_MIN: 2.0,
  SURGE_DURATION_MAX: 4.0,
  SURGE_SPEED:      13.0 * MPH,
  CRAWL_SPEED:       2.0 * MPH,  // ceiling for the idle lurches between waves
  LURCH_MIN:         1.6,        // s between pointless little crawl-forwards
  LURCH_MAX:         5.0,
  SLAM_CHANCE:       0.86,       // probability a surge ends in a full brake slam
                                 // (the rest just decay back to a crawl)

  // ------------------------------------------------------- NPC car-following --
  // Spacing is specified NOSE-TO-NOSE (centre-to-centre), because that is what
  // reads as a queue on screen. A stopped car wants ~1.5 car lengths of it.
  // The follow model works in clear air, so the per-pair clear gap is derived:
  //     clear = SPACING_TARGET - (leadLength + ownLength) / 2
  SPACING_TARGET:     7.0,  // m nose-to-nose when stopped (~1.5 car lengths)
  SPACING_MIN:        5.5,  // m nose-to-nose floor outside a collision
  CLEAR_MIN:          1.2,  // m of clear air never squeezed below (long vehicles)
  CLEAR_PANIC:        0.5,  // m — inside this an NPC brakes at maximum
  K_GAP:              0.85, // P-gain on gap error
  NPC_ACCEL:          2.3,  // m/s²
  NPC_BRAKE_HARSHNESS: 9.5, // m/s² — NPCs brake harder than they accelerate,
                            // which is exactly what makes the wave propagate
  NPC_BRAKELIGHT_DECEL: 0.45, // m/s² of decel that trips the brake lights

  // ------------------------------------------------------------- collision --
  BUMP_TOLERANCE_MPH: 1.5,  // relative impact speed forgiven as a "love tap".
                            // Unlimited love taps; ONE impact above this ends
                            // the commute. (GDD §5)
  BUMP_RESTITUTION:   0.25, // how much a love tap bounces the player back

  // ------------------------------------------------------------ the world --
  LANE_WIDTH:      3.60,
  LANE_COUNT:      3,
  CAR_COUNT_AHEAD: 8,   // per lane, visible ahead
  CAR_COUNT_BEHIND:3,   // per lane, behind (mirror dressing + they follow you)
  RECYCLE_BEHIND:  70,  // m behind the camera before a car is recycled forward
  RECYCLE_AHEAD:  420,  // m ahead before a car is recycled backward
  RESPAWN_MIN:     80,  // recycled cars always reappear far away, never near
  RESPAWN_MAX:    120,  //   the camera where they would pop in huge

  // Adjacent-lane cars this close (or closer) to the camera are faded out and
  // hidden. A camera-facing billboard alongside the driver is metres wide and
  // reads as a giant blurry wall; there is nothing sensible to draw there.
  ADJACENT_DEAD_ZONE: 4.0,   // m ahead of the camera
  ADJACENT_FADE_ZONE: 3.0,   // m of fade above the dead zone

  // --------------------------------------------------------------- camera --
  // The camera is the DRIVER'S EYE, not the car's centre. It rides at
  // player.x + CAMERA_SEAT_OFFSET_X so steering actually moves the view.
  // The collision box stays centred on the car's true centreline.
  CAMERA_HEIGHT:        1.15,  // m above the road
  CAMERA_SEAT_OFFSET_X: -0.37, // m left of centreline (US left-hand drive)

  // Camera-to-front-bumper distance. This is the whole of the "collision
  // triggers too early" fix: player.s is the front bumper, and the camera sits
  // this far behind it. Too large and you crash with daylight still showing.
  PLAYER_FRONT_OVERHANG: 1.90,

  // --------------------------------------------------------------- view ----
  // The game renders into a fixed 16:9 rect, letterboxed on anything else, so
  // the cockpit art and every touch target keep their exact relationship at any
  // window shape. The FOV never changes with the window.
  VIEW_ASPECT: 16 / 9,
  FOV:         70,
  CAM_PITCH_DEG: -11.0,  // fixed downward pitch. A driver looks AT the bumper
                         // ahead, not at the sky. Tuned to HUD_Dashboard.png,
                         // whose window bottom sits at 52% of the frame: any
                         // shallower and the lead car's wheels land exactly on
                         // the dash line, hiding the road entirely.
  CAM_SWAY_DEG:    1.8,  // max pitch/roll sway under braking & acceleration
  FOG_NEAR:       55,
  FOG_FAR:       430,

  // ------------------------------------------------------- player geometry --
  // Real footprint. player.s is the FRONT BUMPER; the body extends back
  // PLAYER_LENGTH from there and is centred on player.x.
  PLAYER_WIDTH:  1.82,
  PLAYER_LENGTH: 4.60,
  // Half-width of the collision box. Calibrated against the sprite footprint:
  // a touch under half the body width so a shared lane line is not an instant
  // scrape, but honest enough that a real overlap always registers.
  PLAYER_SIDE_HALF_WIDTH: 0.86,
  NPC_SIDE_SHRINK: 0.92,   // NPC half-widths are scaled by this for contact

  // ---------------------------------------------------------------- honking --
  HONK_LATERAL_TRIGGER: 0.62, // fraction of a lane-width of encroachment that
                              // makes the neighbours lean on the horn
  HONK_COOLDOWN:        2.4,  // s per car
  HONK_RANGE:          14.0,  // m — how close a car has to be to bother

  // ------------------------------------------------------------- rendering --
  MAX_PIXEL_RATIO: 2,
  ADJACENT_YAW_DEG: 12,  // fallback yaw for adjacent-lane cars when the
                         // rear-3/4 atlas is absent (see ASSETS.cars34)
  SPRITE_ALPHA_TEST: 0.22,
};

// =============================================================================
//  ASSET PATHS
//  Single lookup table. Every entry is optional: if the file is missing the
//  game generates a programmatic placeholder with the *same layout*, so real
//  PNGs can be dropped into /assets/ later with zero code changes.
// =============================================================================

export const ASSETS = {
  carsRear: 'assets/Car_Rears_Sprite.png', // 8 x 4, rear view
  cars34:   'assets/Car_rear_Turned.png',  // 4 rows x 8 cars, rear-3/4 (see note)
  semiRear: 'assets/Truck_Rear.png',       // 2 cells, trailer rear
  fronts:   'assets/Car_Fronts.png',       // 3 + 2 vehicles, front views (mirror)
  cockpit:  'assets/HUD_Dashboard.png',    // full-frame cockpit overlay
  wheel:    'assets/SteeringWheel.png',    // steering wheel, rotates about its rim centre
  stereo:   'assets/Stereo.png',           // 2 cells: OFF / ON
  pedals:   'assets/Pedals.png',           // 4 cells: gas off/on, brake off/on
  road:     'assets/Street_Texture.png',   // 2 cells: plain / dashed
  wall:     'assets/Freeway_Wall.png',     // 3 stacked strips: backdrop / wall / guardrail
  sign:     'assets/Exit_Sign.png',        // complete gantry incl. posts
  title:    'assets/Title.png',            // start-screen logo
  gps:      'assets/GPS.png',              // 2 cells: off / on-with-magenta-key screen
  hand:     'assets/ThumbsUp.png',         // 3 frames: rise / hold / present
  streak:   'assets/StreakCrash.png',      // wall-scrape decal, single wide streak
  music:    'assets/buttrock.mp3',         // the cassette that is stuck in there
};

// -----------------------------------------------------------------------------
//  ATLAS SEGMENTATION
//  MEASURED, not assumed. Two of the supplied atlases are NOT uniform grids:
//
//   Car_Rears_Sprite.png  1774x887  — true 8x4 grid (cell 221.75, non-integer)
//   Car_rear_Turned.png   2172x724  — 4 rows of 8 cars, but the cars are packed
//                                     at DIFFERENT scales (silver ~294px wide,
//                                     red ~250px, navy ~150px) and the navy pair
//                                     touches. A uniform slice cuts cars in half.
//   Car_Fronts.png        1536x1024 — 3 vehicles on row 0, 2 on row 1, centred.
//
//  So every atlas is segmented by ALPHA CONTENT: row bands first, then column
//  runs inside each band, splitting merged runs at their coverage minima. Quad
//  size then comes from each sprite's own measured box, which also normalises
//  the mixed scales in the 3/4 sheet for free.
// -----------------------------------------------------------------------------

export const SEGMENT = {
  carsRear: { rows: 4, perRow: [8, 8, 8, 8] },
  cars34:   { rows: 4, perRow: [8, 8, 8, 8] },
  semiRear: { rows: 1, perRow: [2] },
  fronts:   { rows: 2, perRow: [3, 2] },
  stereo:   { rows: 1, perRow: [2] },
  pedals:   { rows: 1, perRow: [4] },
  ALPHA_EDGE: 16,    // alpha above this counts as content (includes brake glow)
  ALPHA_CORE: 150,   // alpha above this is solid body (excludes glow halo)
  UV_INSET_PX: 1,    // guards against neighbour bleed once mipmapped
};

// -----------------------------------------------------------------------------
//  CAR ATLAS LAYOUT
//  Cell size is 1774/8 = 887/4 = 221.75 px — NOT an integer. Never hardcode
//  222; slices are always computed with Math.round(i * size / n).
// -----------------------------------------------------------------------------

export const ATLAS = {
  COLS: 8,
  ROWS: 4,
  UV_INSET_PX: 1,   // guards against neighbour bleed once mipmapped

  // NOTE: there is deliberately no turn-angle constant any more. Assuming a
  // fixed 32 deg yaw and deriving width from w*cos+len*sin scaled the turned
  // sprites to ~4.9 m — the "giant blurry pickup". The sheet's real yaw varies
  // from roughly 5 to 13 deg per colour, so turned sprites are fitted by
  // HEIGHT instead, which is yaw-invariant. See buildCarVariants().

  // TRUE WORLD DIMENSIONS, in metres. Every sprite is a plane of exactly these
  // dimensions placed in 3D — size attenuation is the perspective camera's job
  // and nothing is ever scaled in screen space.
  //
  // `height` is authoritative: the measured sprite box is fitted to width AND
  // height (geometric mean of the two scales) so a sloppy art aspect can never
  // make one vehicle 2-3x its neighbours.
  ROWS_DEF: [
    { type: 'sedan',  width: 1.80, height: 1.45, length: 4.85 },
    { type: 'suv',    width: 1.90, height: 1.75, length: 4.79 },
    { type: 'pickup', width: 1.95, height: 1.90, length: 5.88 },
    { type: 'hatch',  width: 1.70, height: 1.50, length: 4.28 },
  ],

  // Column pairs, left -> right. Even col = brake OFF, odd col = brake ON.
  COLORS: [
    { name: 'silver',  col: 0, hex: '#c9ccd0' },
    { name: 'white',   col: 2, hex: '#eef0f1' },
    { name: 'darkred', col: 4, hex: '#7d1c22' },
    { name: 'navy',    col: 6, hex: '#243a66' },
  ],
};

// -----------------------------------------------------------------------------
//  BUMPER STICKER FIX (GDD kickoff item 5)
//  The dark-red sedan (row 0, cols 4-5) ships with gibberish AI text on its
//  trunk. At load we redraw that rect and stamp clean text over BOTH cells.
//  Coordinates are fractions of one cell, so they survive any atlas rescale.
//  Eyeballed once — nudge these if the stamp sits proud of the sticker.
// -----------------------------------------------------------------------------

export const STICKER = {
  row: 0,
  cols: [4, 5],       // the dark-red pair, as segmented cell indices in row 0
  text: 'MY KID IS AN HONOR STUDENT',
  // Rect as fractions of that sprite's MEASURED body box (x, y, w, h).
  // Derived by scanning the sheet for the light, low-saturation sticker stock
  // on the boot lid: px [1013,143,67,26] inside body box [901,35,197,165],
  // then grown ~6% so no gibberish survives around the edges.
  rect: { x: 0.562, y: 0.648, w: 0.353, h: 0.172 },
  paper: '#f2f0e8',   // sticker stock
  ink:   '#2a2a2a',
};

// -----------------------------------------------------------------------------
//  SEMI TRUCK — one guaranteed per session (GDD §5). It blocks the view
//  forward, which is both funny and strategic.
// -----------------------------------------------------------------------------

export const SEMI = {
  width:  2.60,
  height: 4.10,   // authoritative — it must tower over the 1.45-1.9 m cars
  length: 16.2,
  lane:   1,   // centre lane — maximum view blockage
  slot:   3,   // Nth car ahead of the player
};

// -----------------------------------------------------------------------------
//  FRONT-VIEW ATLAS (rearview mirror dressing)
//  3 cols x 2 rows: [sedan, suv, pickup] / [hatch, semi, -]
// -----------------------------------------------------------------------------

export const FRONTS = { COLS: 3, ROWS: 2, ORDER: ['sedan', 'suv', 'pickup', 'hatch', 'semi'] };

// -----------------------------------------------------------------------------
//  COCKPIT ANCHORS
//  Fractions of the cockpit image. These drive hit-testing (stereo tap target),
//  the rotating wheel overlay, mirror contents and the HUD readouts, so they
//  hold whether the art is the real PNG or the procedural placeholder.
//
//  The cockpit art is anchored BOTTOM-CENTRE and scaled to the viewport width;
//  any leftover space above is filled with HEADLINER so tall/portrait screens
//  do not show a raw seam.
// -----------------------------------------------------------------------------

export const COCKPIT = {
  ASPECT: 1672 / 941,        // measured from HUD_Dashboard.png
  HEADLINER: '#6d675e',      // fills above the art on tall screens

  // Interior of the rearview mirror glass — the fake "cars behind" view.
  // The dashboard PNG is genuinely transparent here (alpha 0-2), so the mirror
  // contents are painted BEFORE the dash and the housing frames them.
  mirror: { x: 0.405, y: 0.087, w: 0.198, h: 0.110 },

  // The head unit slot on the dash. Stereo.png is composited over this rect and
  // the whole rect is the tap target (GDD §4). Slot aspect 2.29 vs the sprite's
  // 2.27 — near-perfect fit, no distortion.
  stereo: { x: 0.495, y: 0.733, w: 0.171, h: 0.133 },

  // Steering wheel: the dash art has a wheel baked in, so the rotatable layer is
  // drawn slightly larger to cover it completely.
  wheel: { cx: 0.315, cy: 0.840, r: 0.122 },

  // Trip-computer panel laid over the top of the instrument binnacle (the real
  // gauges are static art, so the live numbers get their own readable slab).
  // Sits above the wheel rim so rotation never covers it.
  trip: { x: 0.186, y: 0.578, w: 0.262, h: 0.084 },

  // Windshield opening — shapes the PLACEHOLDER cockpit and keeps HUD text off
  // the glass. Measured from HUD_Dashboard.png's transparent region.
  glass: { x: 0.045, y: 0.048, w: 0.907, h: 0.473 },
};

// -----------------------------------------------------------------------------
//  TOUCH CONTROLS — sized in fractions of the viewport's short edge, floored at
//  64 CSS px per GDD §8.
// -----------------------------------------------------------------------------

export const TOUCH = {
  MIN_TARGET_PX: 64,
  PEDAL_H: 0.300,      // pedal height as a fraction of the short edge;
                       // width follows each sprite's own measured aspect
  PEDAL_MARGIN: 0.030,
  PEDAL_GAP: 0.035,
  WHEEL_R: 0.215,      // on-screen draggable wheel radius
};

// =============================================================================
//  AUDIO
//  Master gain bus with three sub-buses. Music deliberately sits UNDER the
//  ambient bed: the horns are the signature sound of this game, and the world
//  has to stay audible with the stereo on.
// =============================================================================

export const AUDIO = {
  MASTER:  0.90,
  MUSIC:   0.30,   // the cassette, kept below the traffic
  AMBIENT: 0.62,   // engine drone + freeway rumble + the endless honking
  SFX:     0.90,   // reactive: squeaks, thunks, the crash

  // "blown factory speakers" EQ on the cassette
  MUSIC_LOWPASS_HZ:  3100,
  MUSIC_HIGHPASS_HZ:  190,
  MUSIC_PEAK_HZ:     1400,
  MUSIC_PEAK_DB:        4,

  ENGINE_LEVEL: 0.17,
  ENGINE_GAS_BOOST: 0.10,
  RUMBLE_LEVEL: 0.11,
  RUMBLE_SWELL_S: 14,     // period of the slow distant-traffic swell

  // --- the nonstop honking ---
  HONK_MIN_S: 2.0,        // somewhere out there, someone leans on the horn
  HONK_MAX_S: 8.0,
  HONK_PITCH_JITTER: 0.15,
  MAX_HONK_VOICES: 6,     // hard cap so flurries cannot clip the bus
  HONK_MIN_DIST: 4,       // metres, for random ambient honks
  HONK_MAX_DIST: 70,
  FLURRY_MIN: 3,          // honks released when a wave slams to a stop
  FLURRY_MAX: 6,
  FLURRY_SPREAD_S: 1.6,

  // --- distant off-screen flavour (never a visible NPC collision) ---
  FLAVOR_MIN_S: 45,
  FLAVOR_MAX_S: 120,
  FLAVOR_CRASH_CHANCE: 0.22,

  // --- reactive ---
  BRAKE_SQUEAK_MIN_MPH: 5.0,
  NPC_SCREECH_DECEL: 4.5,   // m/s² of NPC braking that squeals a tyre
  NPC_SCREECH_RANGE: 40,    // m
  NPC_SCREECH_COOLDOWN: 2.5,

  // --- game over beat: crash, silence, one lone sad horn ---
  // The screen starts a 1.5 s fade at FADE_START, so the horn at 2.6 s lands
  // partway through the fade, as the words arrive.
  CRASH_DUCK: 0.15,
  GAMEOVER_FADE_START_S: 1.80,
  GAMEOVER_SAD_HONK_S:   2.60,
};

// =============================================================================
//  JEFF PASS — lane changing
//  Lane changes are VERY hard on purpose: gaps in the other lanes are tuned
//  slightly smaller than the car needs, and anyone who sees your blinker
//  closes theirs. Real changes need a surge wave — exactly when it is most
//  dangerous.
// =============================================================================

export const LANE = {
  // Holding steering toward a lane for longer than this auto-starts the
  // blinker on that side.
  SIGNAL_HOLD_S: 1.0,
  BLINK_PERIOD_S: 0.8,       // dash indicator flash period

  // Committing = crossing the lane line by >40% of car width. Measured from
  // the car's centreline: line + 0.4*width - width/2 = line - 0.1*width.
  COMMIT_FRACTION: 0.40,

  // --- adjacent-lane gap tuning (nose-to-nose multiples of car length) ---
  GAP_TIGHT_MULT: 1.1,       // typical adjacent gap: just too small
  GAP_FAIR_MULT:  1.6,       // the occasional real chance
  GAP_FAIR_CHANCE: 0.22,     // how often a fair gap appears

  // --- the joke: blinker seen -> gap closes ---
  CLOSE_SEE_RANGE: 26,       // m — how far back a driver notices your blinker
  CLOSE_DURATION_MIN: 1.0,   // s to shrink the gap
  CLOSE_DURATION_MAX: 2.0,
  CLOSE_SPEED_BOOST: 2.6,    // m/s of extra closing speed while shutting you out
  CLOSE_TARGET_MULT: 0.55,   // the gap they leave you, in car lengths. Rude.

  // --- walls (gameplay faces, inside the visual barrier art) ---
  WALL_RIGHT_X:  9.9,        // sound wall inner face
  WALL_LEFT_X:  -9.2,        // guardrail inner face
  WALL_CRASH_MPH: 2.0,       // lateral closing speed above this = crash
  SCRAPE_MAX_S:   3.0,       // continuous scraping longer than this = game over
  SCRAPE_DRAG:    2.2,       // m/s² speed scrub while scraping
  SCRAPE_SHAKE:   0.35,      // continuous screen rumble amplitude

  // --- scrape decal (StreakCrash.png stamped along the barrier) ---
  DECAL_HEIGHT_M: 0.62,      // world height of the streak band
  DECAL_Y_M:      0.72,      // centre height on the barrier (door-panel line)
  DECAL_MIN_LEN:  1.2,       // m — a touch always leaves at least this much
  DECAL_GROW_S:   0.5,       // m of extra streak per second while pinned still
  DECAL_TINT_LEFT: 0x8f8f8f, // darker on the guardrail so it reads on metal
  DECAL_MAX: 6,              // keep this many episodes before recycling
};

// =============================================================================
//  JEFF PASS — distance unlocks
//  Generic framework keyed to feet travelled this run. Each milestone fires
//  once per run: banner, chime (existing placeholder tone), feature flag.
//  Adding a milestone later must be pure config: append an entry here.
// =============================================================================

export const UNLOCKS = [
  { ft: 5280, id: 'gps', label: 'GPS NAVIGATION' },
  // TODO(art/design): milestone at 2 miles — e.g. cup holder / coffee.
  // { ft: 10560, id: 'tbd2mi', label: 'TBD' },
  // TODO(art/design): milestone at 5 miles — e.g. cruise control that only
  // works below 4 mph.
  // { ft: 26400, id: 'tbd5mi', label: 'TBD' },
];

export const GPS = {
  // Position, fractions of the cockpit art: sitting on the LOW part of the
  // dashboard shelf, right of the instrument cluster — mount planted on the
  // dash surface, screen just breaking the windshield line.
  rect: { x: 0.545, y: 0.434, w: 0.135, h: 0.155 },   // (0.439 - ~5px of art height)
  DROP_S: 0.55,              // drop-in animation duration at unlock

  DEST_MI_START: 14.2,
  // Distance ticks down insultingly slowly and never reaches zero: only a
  // tenth of real progress registers, and it floors at 11.9 mi.
  DEST_PROGRESS_RATIO: 0.1,
  DEST_MI_FLOOR: 11.9,

  ETA_START_MIN: 28,
  RECALC_MIN_S: 20,          // every 20-45 s...
  RECALC_MAX_S: 45,
  ETA_BUMP_MIN: 1,           // ...the ETA goes UP by 1-8 minutes. Never down.
  ETA_BUMP_MAX: 8,           // averages ~8.3 min of ETA per real minute, so a
                             // 15-minute commute reads comfortably past 2 hours
  RECALC_FLASH_S: 1.4,       // "RECALCULATING..." flash
};

// =============================================================================
//  JEFF PASS — thumbs-up emote
//  Funny AND raises crash risk: that is the trade.
// =============================================================================

export const EMOTE = {
  COOLDOWN_S: 10,
  RISE_S: 0.25, HOLD_S: 1.5, AWAY_S: 0.30,   // 3-phase: rise / hold / present-away

  RAGE_RADIUS: 15,           // m — everyone this close honks at you
  RAGE_VOLUME_BOOST: 1.5,    // +50% (existing honk voices, just louder/denser)
  TAILGATE_COUNT: 2,         // the two nearest cars...
  TAILGATE_FACTOR: 0.7,      // ...close to 30% tighter spacing...
  TAILGATE_S: 20,            // ...for this long...
  TAILGATE_BRAKE_MULT: 1.5,  // ...with harsher brake-slam reactions
  AMBIENT_RATE_MULT: 2,      // ambient honk frequency doubles...
  AMBIENT_RATE_S: 30,        // ...for this long

  // Touch button, left side above the wheel (fractions of the view rect).
  btn: { x: 0.030, y: 0.560, w: 0.075, h: 0.135 },
};

// =============================================================================
//  SHARE CARD
//  A 1200x630 PNG generated once per crash and handed to the native share
//  sheet, with the stats image and a text line together.
// =============================================================================

export const SHARE = {
  W: 1200,
  H: 630,
  BG: '#0b0d0f',            // matches the game-over screen

  // Shown at the bottom of the card. A deployed copy uses its own origin;
  // this is the fallback when running from localhost.
  URL: 'github.com/mgs-sound/traffic-simulator-3000',

  // Picked by time survived. `under` is an exclusive upper bound in seconds,
  // so the bands are: <30s, 30s-2m, 2-5m, 5-10m, 10-20m, 20m+.
  SUPERLATIVES: [
    { under: 30,       text: 'Barely Commuted' },
    { under: 120,      text: 'Certified Lane Occupant' },
    { under: 300,      text: 'Regional Gridlock Finalist' },
    { under: 600,      text: 'Distinguished Brake Rider' },
    { under: 1200,     text: 'Senior Traffic Veteran' },
    { under: Infinity, text: 'Absolutely Nowhere, Champion' },
  ],

  // Overrides the time band at any duration.
  NOWHERE_FT: 50,
  NOWHERE_TEXT: 'Went Nowhere. Proud of It.',
};

// =============================================================================
//  WORLD ART
//  Freeway_Wall.png is a single sheet holding three stacked strips. Bands are
//  detected at load; these are the fallbacks and the real-world scaling.
// =============================================================================

export const WORLD = {
  // Street_Texture.png: cell 0 = plain asphalt, cell 1 = asphalt + dashed line.
  // We tile cell 0 and draw the lane markings ourselves — it tiles cleaner and
  // gives correct 3 m stripe / 9 m gap spacing (the art's dashes are ~4 m apart).
  ROAD_TILE_M: 24,        // metres of road per texture tile
  ROAD_WIDTH_M: 20,       // 3 lanes + shoulders
  ROAD_SEAM_INSET_PX: 3,  // the street sheet has a bright 1px seam at the cell join
  LINE_W_M: 0.14,
  DASH_LEN_M: 3,
  DASH_PERIOD_M: 12,
  EDGE_LEFT:  '#d8c65a',  // median side, yellow
  EDGE_RIGHT: '#d8d4c6',  // shoulder side, white
  DASH_COLOR: '#d8d4c6',

  WALL_HEIGHT_M: 3.6,     // concrete sound wall, right side
  WALL_X: 10.4,
  RAIL_HEIGHT_M: 1.1,     // W-beam guardrail, left side
  RAIL_X: -9.6,

  BACKDROP_HEIGHT_M: 170, // distant hills / pylons / skyline. The strip is ~60%
                          // sky, so it needs real height for the hills to read
                          // as more than a smudge on the horizon.
  BACKDROP_Z: -700,
  BACKDROP_REPEAT: 4,
  BACKDROP_PARALLAX: 0.06,// scrolls at 6% of road speed

  SIGN_WIDTH_M: 20,       // Exit_Sign.png is the whole gantry, posts included
  SIGN_START_S: 380,
  SIGN_RECYCLE_M: 400,

  SKY_TOP: '#4b8ecb',
  SKY_HAZE: '#c0ced5',
};
