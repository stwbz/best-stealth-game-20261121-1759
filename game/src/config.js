// MOTHLIGHT — A Quiet Heist. Every tuning number, colour and the whole level
// layout in one place. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule depends on the screen size.
// The level is a lamplit archive at night: outer walls, interior walls that
// split it into rooms, wooden crates that block both movement and sight,
// three lantern shards to steal, and a green exit door in the top-right.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  sneakSpeed: 96,
  start: { x: 92, y: 628 },
};

export const ATTEMPTS = 3;

export const GUARD = {
  radius: 14,
  patrolSpeed: 56,
  chaseSpeed: 152,
  returnSpeed: 90,
  visionRange: 262,
  visionHalfAngle: 0.61,
  hearRadius: 132,
  pauseAtWaypoint: 1.1,
  chaseGiveUpSeconds: 2.6,
};

/** Detection: 0 = unseen, 1 = spotted. Rates are per second while seen. */
export const DETECTION = {
  walkNear: 1.15,
  walkFar: 0.55,
  sneakNear: 0.5,
  sneakFar: 0.22,
  heardPerSecond: 0.3,
  decayPerSecond: 0.34,
  suspiciousFloor: 0.42,
  nearDistance: 130,
};

export const SHARD_POINTS = 100;
export const TIME_BONUS_PER_SECOND = 2;

/** Walls are {x, y, w, h} rectangles. They block movement and sight. */
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  { x: 420, y: 96, w: 28, h: 300 },
  { x: 856, y: 324, w: 28, h: 300 },
  { x: 600, y: 228, w: 360, h: 28 },
  { x: 180, y: 468, w: 340, h: 28 },
  { x: 960, y: 468, w: 296, h: 28 },
  { x: 640, y: 468, w: 28, h: 140 },
];

/** Crates are cover: they block movement and a guard's line of sight. */
export const CRATES = [
  { x: 520, y: 272, w: 56, h: 56 },
  { x: 576, y: 272, w: 56, h: 56 },
  { x: 300, y: 180, w: 56, h: 56 },
  { x: 980, y: 140, w: 56, h: 56 },
  { x: 720, y: 560, w: 56, h: 56 },
  { x: 240, y: 340, w: 56, h: 56 },
  { x: 1080, y: 340, w: 56, h: 56 },
  { x: 180, y: 120, w: 56, h: 56 },
];

export const SHARDS = [
  { x: 660, y: 150 },
  { x: 1120, y: 600 },
  { x: 300, y: 600 },
];

export const EXIT = { x: 1150, y: 48, w: 82, h: 82 };

/** Guards: name, patrol loop, and where the loop starts. */
export const GUARDS = [
  {
    name: 'Pip',
    waypoints: [
      { x: 520, y: 140 },
      { x: 780, y: 140 },
      { x: 780, y: 200 },
      { x: 520, y: 200 },
    ],
  },
  {
    name: 'Bram',
    waypoints: [
      { x: 500, y: 360 },
      { x: 820, y: 360 },
      { x: 820, y: 440 },
      { x: 500, y: 440 },
    ],
  },
  {
    name: 'Sable',
    waypoints: [
      { x: 940, y: 320 },
      { x: 1140, y: 320 },
      { x: 1140, y: 440 },
      { x: 940, y: 440 },
    ],
  },
  {
    name: 'Wren',
    waypoints: [
      { x: 260, y: 540 },
      { x: 420, y: 540 },
      { x: 420, y: 620 },
      { x: 260, y: 620 },
    ],
  },
];

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#1c1a26',
  floorAlt: '#211e2e',
  floorLine: '#2b2840',
  wall: '#3a3550',
  wallTop: '#57517a',
  crate: '#6b4a2a',
  crateEdge: '#8a6238',
  crateDark: '#4a3018',
  cone: '#f5c542',
  coneAlert: '#ff5a3c',
  guard: '#e5484d',
  guardDark: '#8f2a30',
  player: '#37b58f',
  playerLight: '#ffd97a',
  shard: '#7fe7d2',
  exit: '#39d98a',
  exitDark: '#1d7a4c',
  text: '#f2ead8',
  muted: '#a49e8f',
  panel: '#171522',
  panelEdge: '#3d3654',
  danger: '#ff6b57',
  safe: '#39d98a',
  glass: 'rgba(23, 21, 34, 0.72)',
  glassEdge: 'rgba(255, 255, 255, 0.08)',
  glassHi: 'rgba(255, 255, 255, 0.10)',
  ctaEdge: 'rgba(255, 255, 255, 0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'mothlight.best';
