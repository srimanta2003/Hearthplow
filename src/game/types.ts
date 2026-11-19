export type GamePhase = 'title' | 'playing' | 'paused' | 'workshop' | 'victory' | 'sunset';

export type UpgradeKey = 'blade' | 'engine' | 'turbo' | 'chime' | 'thermal';

export interface UpgradeLevels {
  blade: number;
  engine: number;
  turbo: number;
  chime: number;
  thermal: number;
}

export interface UpgradeSpec {
  key: UpgradeKey;
  shortcut: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  formatStat: (level: number) => string;
}

export const UPGRADE_SPECS: UpgradeSpec[] = [
  {
    key: 'blade',
    shortcut: '1',
    name: 'Wide Plow Blade',
    description: 'Extends the steel scoop wings to clear wider snow lanes in one pass.',
    maxLevel: 5,
    baseCost: 75,
    costMultiplier: 1.75,
    formatStat: (lvl) => `${(2.3 + lvl * 0.48).toFixed(1)}m`,
  },
  {
    key: 'engine',
    shortcut: '2',
    name: 'Alpine V8 Torque',
    description: 'Boosts cruising speed, snow-tire grip, and power through deep drifts.',
    maxLevel: 5,
    baseCost: 85,
    costMultiplier: 1.75,
    formatStat: (lvl) => `${Math.round(100 + lvl * 18)}%`,
  },
  {
    key: 'turbo',
    shortcut: '3',
    name: 'Copper Turbo Boiler',
    description: 'Increases boost velocity, fuel tank capacity, and steam recharge rate.',
    maxLevel: 5,
    baseCost: 90,
    costMultiplier: 1.8,
    formatStat: (lvl) => `${(3.2 + lvl * 0.9).toFixed(1)}s`,
  },
  {
    key: 'chime',
    shortcut: '4',
    name: 'Hearth Bell Multiplier',
    description: 'Holds combo streaks longer and raises coin payout per multiplier tier.',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.85,
    formatStat: (lvl) => `x${(1.0 + lvl * 0.25).toFixed(2)}`,
  },
  {
    key: 'thermal',
    shortcut: '5',
    name: 'Heated Thermal Edge',
    description: 'Melts packed deep drifts and slick ice sheets effortlessly on contact.',
    maxLevel: 5,
    baseCost: 115,
    costMultiplier: 1.9,
    formatStat: (lvl) => (lvl === 0 ? 'Cold Steel' : `Tier ${lvl}`),
  },
];

export function getUpgradeCost(spec: UpgradeSpec, currentLevel: number): number {
  return Math.round((spec.baseCost * Math.pow(spec.costMultiplier, currentLevel)) / 5) * 5;
}

export type WeatherCondition = 'crisp_flurries' | 'drifting_squall' | 'heavy_blizzard' | 'whiteout_storm';

export interface WeatherProfile {
  condition: WeatherCondition;
  label: string;
  skyHex: number;
  fogNear: number;
  fogFar: number;
  gustFogPull: number; // How many meters closer fogFar/fogNear pull during active gusts
  sunIntensity: number;
  hemiIntensity: number;
  headlightBoost: number; // Extra headlight & glow intensity in poor visibility
  activeFlakeRatio: number; // 0..1 fraction of pooled snowflakes active
  windSpeed: number; // Horizontal blowing snow velocity
  gustStrength: number; // Additional wind & flake surge during gusts (0..1)
  gustPeriodSec: number; // Seconds between rolling squall gusts
  baseVisibilityPercent: number; // Nominal visibility % before gusts
}

export interface DayConfig {
  day: number;
  title: string;
  subtitle: string;
  targetPercent: number;
  durationSec: number;
  deepDriftRatio: number;
  icePatchRatio: number;
  refillRate: number; // snow cells per second slowly drifting back during heavy storm
  snowIntensity: number; // visual snowfall speed/density 0.6 - 1.8
  clearBonus: number;
  weather: WeatherProfile;
}

export function getDayConfig(day: number): DayConfig {
  const presets: Omit<DayConfig, 'day'>[] = [
    {
      title: 'Morning Dusting',
      subtitle: 'Fresh overnight powder blankets Hearthstone Square.',
      targetPercent: 85,
      durationSec: 95,
      deepDriftRatio: 0.16,
      icePatchRatio: 0.0,
      refillRate: 0,
      snowIntensity: 0.72,
      clearBonus: 140,
      weather: {
        condition: 'crisp_flurries',
        label: 'Crisp Flurries',
        skyHex: 0xcfe2f4,
        fogNear: 46,
        fogFar: 118,
        gustFogPull: 6,
        sunIntensity: 2.1,
        hemiIntensity: 0.94,
        headlightBoost: 0.0,
        activeFlakeRatio: 0.34,
        windSpeed: 1.4,
        gustStrength: 0.25,
        gustPeriodSec: 22,
        baseVisibilityPercent: 95,
      },
    },
    {
      title: 'Timberlane Squall',
      subtitle: 'Deeper roadside banks and drifting valley mist across the square.',
      targetPercent: 87,
      durationSec: 95,
      deepDriftRatio: 0.28,
      icePatchRatio: 0.1,
      refillRate: 0.35,
      snowIntensity: 1.05,
      clearBonus: 210,
      weather: {
        condition: 'drifting_squall',
        label: 'Drifting Squall',
        skyHex: 0xb8cde1,
        fogNear: 37,
        fogFar: 86,
        gustFogPull: 11,
        sunIntensity: 1.68,
        hemiIntensity: 0.84,
        headlightBoost: 0.4,
        activeFlakeRatio: 0.58,
        windSpeed: 3.1,
        gustStrength: 0.55,
        gustPeriodSec: 17,
        baseVisibilityPercent: 74,
      },
    },
    {
      title: 'Pinecrest Nor’easter',
      subtitle: 'Heavy blowing snow and dense fog narrowing street visibility.',
      targetPercent: 88,
      durationSec: 92,
      deepDriftRatio: 0.4,
      icePatchRatio: 0.16,
      refillRate: 0.75,
      snowIntensity: 1.38,
      clearBonus: 300,
      weather: {
        condition: 'heavy_blizzard',
        label: 'Heavy Blizzard',
        skyHex: 0x9fb5cb,
        fogNear: 31,
        fogFar: 69,
        gustFogPull: 12,
        sunIntensity: 1.25,
        hemiIntensity: 0.72,
        headlightBoost: 0.85,
        activeFlakeRatio: 0.82,
        windSpeed: 5.0,
        gustStrength: 0.8,
        gustPeriodSec: 13.5,
        baseVisibilityPercent: 52,
      },
    },
    {
      title: 'Solstice Whiteout',
      subtitle: 'Thick alpine fog and howling whiteout gusts—rely on headlights and lamps.',
      targetPercent: 90,
      durationSec: 90,
      deepDriftRatio: 0.52,
      icePatchRatio: 0.2,
      refillRate: 1.1,
      snowIntensity: 1.65,
      clearBonus: 420,
      weather: {
        condition: 'whiteout_storm',
        label: 'Whiteout Gusts',
        skyHex: 0x8ea6be,
        fogNear: 27,
        fogFar: 60,
        gustFogPull: 11,
        sunIntensity: 0.92,
        hemiIntensity: 0.64,
        headlightBoost: 1.25,
        activeFlakeRatio: 1.0,
        windSpeed: 6.8,
        gustStrength: 1.0,
        gustPeriodSec: 11,
        baseVisibilityPercent: 36,
      },
    },
  ];

  if (day <= presets.length) {
    return { day, ...presets[day - 1] };
  }

  const extra = day - presets.length;
  return {
    day,
    title: `Alpine Storm #${day}`,
    subtitle: 'Relentless high-altitude whiteout squalls sweeping the village.',
    targetPercent: Math.min(93, 90 + Math.floor(extra / 2)),
    durationSec: Math.max(82, 90 - extra * 2),
    deepDriftRatio: Math.min(0.68, 0.52 + extra * 0.04),
    icePatchRatio: Math.min(0.28, 0.2 + extra * 0.02),
    refillRate: Math.min(2.0, 1.1 + extra * 0.18),
    snowIntensity: Math.min(1.95, 1.65 + extra * 0.08),
    clearBonus: 420 + extra * 120,
    weather: {
      condition: 'whiteout_storm',
      label: extra >= 2 ? 'Severe Whiteout' : 'Whiteout Gusts',
      skyHex: 0x859db6,
      fogNear: Math.max(24, 27 - extra * 0.7),
      fogFar: Math.max(54, 60 - extra * 1.4),
      gustFogPull: Math.min(13, 11 + extra * 0.5),
      sunIntensity: Math.max(0.75, 0.92 - extra * 0.04),
      hemiIntensity: Math.max(0.56, 0.64 - extra * 0.02),
      headlightBoost: Math.min(1.6, 1.25 + extra * 0.1),
      activeFlakeRatio: 1.0,
      windSpeed: Math.min(8.5, 6.8 + extra * 0.45),
      gustStrength: 1.0,
      gustPeriodSec: Math.max(8.5, 11 - extra * 0.5),
      baseVisibilityPercent: Math.max(24, 36 - extra * 3),
    },
  };
}

export interface HudSnapshot {
  phase: GamePhase;
  day: number;
  dayTitle: string;
  weatherLabel: string;
  visibilityPercent: number;
  isGusting: boolean;
  clearedPercent: number;
  targetPercent: number;
  timeRemaining: number;
  coins: number;
  shiftCoins: number;
  score: number;
  highScore: number;
  comboCount: number;
  comboMultiplier: number;
  comboTimerRatio: number; // 0..1
  turboRatio: number; // 0..1
  isBoosting: boolean;
  maxCombo: number;
  cratesFound: number;
  cratesTotal: number;
  upgrades: UpgradeLevels;
  muted: boolean;
  floatingEvent: { id: number; text: string; tone: 'gold' | 'combo' | 'clear' } | null;
}

export interface SavedProgress {
  coins: number;
  highScore: number;
  bestDay: number;
  upgrades: UpgradeLevels;
}

const STORAGE_KEY = 'hearthplow_save_v1';

export const DEFAULT_UPGRADES: UpgradeLevels = {
  blade: 0,
  engine: 0,
  turbo: 0,
  chime: 0,
  thermal: 0,
};

export function loadProgress(): SavedProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { coins: 0, highScore: 0, bestDay: 1, upgrades: { ...DEFAULT_UPGRADES } };
    }
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return {
      coins: typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) ? Math.max(0, Math.floor(parsed.coins)) : 0,
      highScore: typeof parsed.highScore === 'number' && Number.isFinite(parsed.highScore) ? Math.max(0, Math.floor(parsed.highScore)) : 0,
      bestDay: typeof parsed.bestDay === 'number' && Number.isFinite(parsed.bestDay) ? Math.max(1, Math.floor(parsed.bestDay)) : 1,
      upgrades: {
        blade: clampLevel(parsed.upgrades?.blade),
        engine: clampLevel(parsed.upgrades?.engine),
        turbo: clampLevel(parsed.upgrades?.turbo),
        chime: clampLevel(parsed.upgrades?.chime),
        thermal: clampLevel(parsed.upgrades?.thermal),
      },
    };
  } catch {
    return { coins: 0, highScore: 0, bestDay: 1, upgrades: { ...DEFAULT_UPGRADES } };
  }
}

function clampLevel(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(5, Math.floor(val)));
}

export function saveProgress(progress: SavedProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}
