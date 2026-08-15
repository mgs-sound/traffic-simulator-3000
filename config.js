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
  CAM_HEIGHT:      1.15, // m above the road
  CAM_X:          -0.36, // m left of car centreline (US left-hand drive)
  DRIVER_SETBACK:  2.40, // m the driver sits behind the front bumper
  FOV:            62,
  CAM_PITCH_DEG: -11.0,  // fixed downward pitch. A driver looks AT the bumper
                         // ahead, not at the sky. Tuned to HUD_Dashboard.png,
                         // whose window bottom sits at 52% of the frame: any
                         // shallower and the lead car's wheels land exactly on
                         // the dash line, hiding the road entirely.
  CAM_SWAY_DEG:    1.8,  // max pitch/roll sway under braking & acceleration
  FOG_NEAR:       55,
  FOG_FAR:       430,

  // ------------------------------------------------------- player geometry --
  PLAYER_WIDTH:  1.86,
  PLAYER_LENGTH: 4.90,

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

  // --- game over beat: crash, silence, one lone sad horn, then the form ---
  CRASH_DUCK: 0.15,
  GAMEOVER_SAD_HONK_S: 2.6,
  GAMEOVER_STATS_S: 3.35,
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
