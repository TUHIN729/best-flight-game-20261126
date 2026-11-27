// Sky Courier: The Island Run — configuration.
// One file, one job: every tunable number of the game lives here.

export const CFG = {
  // Canvas the game draws into (screenshots are taken at this size).
  viewW: 1280,
  viewH: 720,
  fov: 1.31, // ~75 degrees, horizontal

  // World
  seaLevel: 0,
  runway: { x: 0, zMin: -240, zMax: 240, halfW: 13, height: 6 },
  islands: [
    { cx: 0, cz: 0, r: 620, h: 26 }, // home island, holds the runway
    { cx: 900, cz: 700, r: 420, h: 48 },
    { cx: -850, cz: 850, r: 380, h: 60 },
    { cx: 1150, cz: -650, r: 340, h: 38 },
    { cx: -1050, cz: -750, r: 460, h: 72 },
    { cx: 250, cz: 1500, r: 300, h: 30 },
    { cx: -300, cz: -1500, r: 330, h: 44 },
  ],

  // The courier route: six golden rings over the islands, then home.
  rings: [
    { x: 0, y: 78, z: 420, r: 26 },
    { x: 260, y: 96, z: 760, r: 24 },
    { x: 700, y: 110, z: 950, r: 24 },
    { x: 420, y: 92, z: 420, r: 22 },
    { x: -350, y: 120, z: 1050, r: 24 },
    { x: -620, y: 104, z: 620, r: 22 },
  ],

  // Flight model
  minSpeed: 30,
  maxSpeed: 185,
  stallSpeed: 52,
  cruiseThrottle: 0.62,
  rollRate: 2.6,
  pitchRate: 1.9,
  turnAuthority: 1.15,
  maxRoll: 1.05,
  maxPitch: 0.55,
  fuelMax: 100,
  fuelBurnBase: 0.16,
  fuelBurnThrottle: 0.85,

  // Scoring
  ringScore: 100,
  landScore: 500,
  fuelBonusPerUnit: 4,
  timeBonusPerSecond: 2,

  // Palette
  skyTop: '#2e6fc4',
  skyMid: '#7fb2e8',
  skyLow: '#cfe6f7',
  sun: '#fff3c4',
  seaDeep: '#155a8a',
  seaShallow: '#2f8fc0',
  sand: '#d9c27a',
  grassLow: '#4f9e3f',
  grassHigh: '#7ab648',
  rock: '#8a7f72',
  snow: '#eef2f5',
  runwayColor: '#3a3f46',
  runwayLineColor: '#f2f2e8',
  ringGold: '#ffc93c',
  ringGlow: '#ff9d00',
};

export const MISSIONS = [
  { id: 'rings', text: 'Fly the route: pass all 6 golden rings' },
  { id: 'land', text: 'Then bring her home: land on the runway' },
];

export const PLANE_NAME = 'Sky Courier';
export const CALLSIGN = 'SKY-7';
