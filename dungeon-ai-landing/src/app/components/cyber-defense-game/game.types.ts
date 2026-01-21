// ============ CYBER DEFENSE GAME TYPES ============

export interface Vector2D {
  x: number;
  y: number;
}

export interface GameObject {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  size: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
}

// ============ PLAYER ============
export interface Player extends GameObject {
  level: number;
  xp: number;
  xpToNextLevel: number;
  moveSpeed: number;
  bandwidth: number; // Processing power for attacks
  weapons: Weapon[];
  passiveItems: PassiveItem[];
  permanentUpgrades: PermanentUpgrades;
}

// ============ ENEMIES ============
export type EnemyType = 'malware' | 'trojan' | 'worm' | 'ransomware' | 'rootkit' | 'zeroday' | 'apt' | 'ddos';

export interface Enemy extends GameObject {
  type: EnemyType;
  damage: number;
  xpValue: number;
  color: string;
  secondaryColor: string;
  movePattern: 'direct' | 'zigzag' | 'stealth' | 'swarm';
  specialAbility?: string;
}

export const ENEMY_CONFIGS: Record<EnemyType, {
  name: string;
  health: number;
  damage: number;
  xpValue: number;
  speed: number;
  size: number;
  color: string;
  secondaryColor: string;
  movePattern: 'direct' | 'zigzag' | 'stealth' | 'swarm';
  spawnWeight: number;
  minDifficulty: number;
  description: string;
}> = {
  malware: {
    name: 'Malware',
    health: 30,
    damage: 8,
    xpValue: 5,
    speed: 1.5,
    size: 14,
    color: '#ff0066',
    secondaryColor: '#ff3388',
    movePattern: 'direct',
    spawnWeight: 5,
    minDifficulty: 1,
    description: 'Basic threat. Low damage, high quantity.'
  },
  trojan: {
    name: 'Trojan',
    health: 25,
    damage: 12,
    xpValue: 8,
    speed: 2.8,
    size: 12,
    color: '#ff6600',
    secondaryColor: '#ff9933',
    movePattern: 'zigzag',
    spawnWeight: 3,
    minDifficulty: 1,
    description: 'Fast infiltrator. Unpredictable movement.'
  },
  worm: {
    name: 'Worm',
    health: 20,
    damage: 5,
    xpValue: 10,
    speed: 2.0,
    size: 10,
    color: '#00ff66',
    secondaryColor: '#66ff99',
    movePattern: 'swarm',
    spawnWeight: 4,
    minDifficulty: 1,
    description: 'Self-replicating. Spawns more on death.'
  },
  ransomware: {
    name: 'Ransomware',
    health: 100,
    damage: 20,
    xpValue: 20,
    speed: 0.8,
    size: 28,
    color: '#ffcc00',
    secondaryColor: '#ffee66',
    movePattern: 'direct',
    spawnWeight: 2,
    minDifficulty: 1.5,
    description: 'Heavy threat. Encrypts your defenses on contact.'
  },
  rootkit: {
    name: 'Rootkit',
    health: 40,
    damage: 15,
    xpValue: 25,
    speed: 1.2,
    size: 16,
    color: '#9933ff',
    secondaryColor: '#bb66ff',
    movePattern: 'stealth',
    spawnWeight: 2,
    minDifficulty: 2,
    description: 'Stealthy. Phases in and out of visibility.'
  },
  zeroday: {
    name: 'Zero-Day',
    health: 60,
    damage: 30,
    xpValue: 50,
    speed: 2.5,
    size: 18,
    color: '#00ffff',
    secondaryColor: '#66ffff',
    movePattern: 'zigzag',
    spawnWeight: 1,
    minDifficulty: 2.5,
    description: 'Unknown exploit. Bypasses basic defenses.'
  },
  apt: {
    name: 'APT',
    health: 500,
    damage: 40,
    xpValue: 200,
    speed: 1.0,
    size: 50,
    color: '#ff0000',
    secondaryColor: '#ff6666',
    movePattern: 'direct',
    spawnWeight: 0.1,
    minDifficulty: 3,
    description: 'Advanced Persistent Threat. Boss-level danger.'
  },
  ddos: {
    name: 'DDoS Bot',
    health: 15,
    damage: 3,
    xpValue: 3,
    speed: 3.5,
    size: 8,
    color: '#0088ff',
    secondaryColor: '#66bbff',
    movePattern: 'swarm',
    spawnWeight: 6,
    minDifficulty: 2,
    description: 'Botnet node. Weak alone, dangerous in swarms.'
  }
};

// ============ WEAPONS ============
export type WeaponType = 'firewall' | 'antivirus' | 'honeypot' | 'encryption' | 'packet-analyzer' | 'ddos-defender';

export interface Weapon {
  type: WeaponType;
  level: number;
  maxLevel: number;
  damage: number;
  cooldown: number;
  lastFired: number;
  range: number;
  projectileSpeed: number;
  projectileCount: number;
  piercing: number;
  evolved: boolean;
  evolutionRequirement?: PassiveItemType;
}

export const WEAPON_CONFIGS: Record<WeaponType, {
  name: string;
  description: string;
  baseDamage: number;
  baseCooldown: number;
  baseRange: number;
  baseProjectileSpeed: number;
  baseProjectileCount: number;
  basePiercing: number;
  maxLevel: number;
  color: string;
  icon: string;
  evolutionRequirement: PassiveItemType;
  evolvedName: string;
  evolvedDescription: string;
}> = {
  firewall: {
    name: 'Firewall',
    description: 'Basic barrier. Shoots packets at threats.',
    baseDamage: 10,
    baseCooldown: 1000,
    baseRange: 200,
    baseProjectileSpeed: 8,
    baseProjectileCount: 1,
    basePiercing: 0,
    maxLevel: 8,
    color: '#00ffff',
    icon: '🛡️',
    evolutionRequirement: 'bandwidth-boost',
    evolvedName: 'Adaptive Firewall',
    evolvedDescription: 'AI-powered barrier. Tracks and eliminates threats.'
  },
  antivirus: {
    name: 'Antivirus Scanner',
    description: 'Scans and destroys known threats.',
    baseDamage: 15,
    baseCooldown: 1500,
    baseRange: 250,
    baseProjectileSpeed: 6,
    baseProjectileCount: 1,
    basePiercing: 1,
    maxLevel: 8,
    color: '#00ff00',
    icon: '🔍',
    evolutionRequirement: 'deep-learning',
    evolvedName: 'Heuristic Hunter',
    evolvedDescription: 'Detects unknown threats. Massive damage boost.'
  },
  honeypot: {
    name: 'Honeypot Trap',
    description: 'Attracts and damages nearby enemies.',
    baseDamage: 5,
    baseCooldown: 3000,
    baseRange: 150,
    baseProjectileSpeed: 0,
    baseProjectileCount: 1,
    basePiercing: 999,
    maxLevel: 8,
    color: '#ffaa00',
    icon: '🍯',
    evolutionRequirement: 'threat-intel',
    evolvedName: 'Advanced Persistent Trap',
    evolvedDescription: 'Captures and analyzes threats. Huge AoE.'
  },
  encryption: {
    name: 'Encryption Shield',
    description: 'Rotating shield that blocks damage.',
    baseDamage: 8,
    baseCooldown: 100,
    baseRange: 80,
    baseProjectileSpeed: 0,
    baseProjectileCount: 2,
    basePiercing: 999,
    maxLevel: 8,
    color: '#ffff00',
    icon: '🔐',
    evolutionRequirement: 'encryption-key',
    evolvedName: 'Zero-Trust Barrier',
    evolvedDescription: 'Impenetrable shield. Reflects damage.'
  },
  'packet-analyzer': {
    name: 'Packet Analyzer',
    description: 'Fires data packets in a spread.',
    baseDamage: 6,
    baseCooldown: 800,
    baseRange: 300,
    baseProjectileSpeed: 10,
    baseProjectileCount: 3,
    basePiercing: 0,
    maxLevel: 8,
    color: '#ff00ff',
    icon: '📡',
    evolutionRequirement: 'packet-amplifier',
    evolvedName: 'Deep Packet Inspector',
    evolvedDescription: 'Fires in all directions. Critical hit chance.'
  },
  'ddos-defender': {
    name: 'DDoS Defender',
    description: 'Counter-attacks swarm threats.',
    baseDamage: 3,
    baseCooldown: 200,
    baseRange: 400,
    baseProjectileSpeed: 12,
    baseProjectileCount: 1,
    basePiercing: 0,
    maxLevel: 8,
    color: '#0088ff',
    icon: '⚡',
    evolutionRequirement: 'rate-limiter',
    evolvedName: 'Botnet Destroyer',
    evolvedDescription: 'Chain lightning. Decimates swarms.'
  }
};

// ============ PASSIVE ITEMS ============
export type PassiveItemType = 'bandwidth-boost' | 'deep-learning' | 'threat-intel' | 'encryption-key' | 'packet-amplifier' | 'rate-limiter' | 'cooling-system' | 'overclock';

export interface PassiveItem {
  type: PassiveItemType;
  level: number;
  maxLevel: number;
}

export const PASSIVE_CONFIGS: Record<PassiveItemType, {
  name: string;
  description: string;
  maxLevel: number;
  icon: string;
  effect: string;
}> = {
  'bandwidth-boost': {
    name: 'Bandwidth Boost',
    description: '+10% attack speed per level',
    maxLevel: 5,
    icon: '📶',
    effect: 'attackSpeed'
  },
  'deep-learning': {
    name: 'Deep Learning',
    description: '+15% damage per level',
    maxLevel: 5,
    icon: '🧠',
    effect: 'damage'
  },
  'threat-intel': {
    name: 'Threat Intel',
    description: '+20% pickup radius per level',
    maxLevel: 5,
    icon: '🎯',
    effect: 'pickupRadius'
  },
  'encryption-key': {
    name: 'Encryption Key',
    description: '+10% max health per level',
    maxLevel: 5,
    icon: '🔑',
    effect: 'maxHealth'
  },
  'packet-amplifier': {
    name: 'Packet Amplifier',
    description: '+1 projectile per 2 levels',
    maxLevel: 4,
    icon: '📊',
    effect: 'projectileCount'
  },
  'rate-limiter': {
    name: 'Rate Limiter',
    description: '+15% range per level',
    maxLevel: 5,
    icon: '🚦',
    effect: 'range'
  },
  'cooling-system': {
    name: 'Cooling System',
    description: '-8% cooldown per level',
    maxLevel: 5,
    icon: '❄️',
    effect: 'cooldown'
  },
  'overclock': {
    name: 'Overclock',
    description: '+8% move speed per level',
    maxLevel: 5,
    icon: '⚙️',
    effect: 'moveSpeed'
  }
};

// ============ PROJECTILES ============
export interface Projectile {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  damage: number;
  size: number;
  lifetime: number;
  color: string;
  weaponType: WeaponType;
  piercing: number;
  hitEnemies: Set<string>;
}

// ============ XP ORBS ============
export interface DataOrb {
  id: string;
  position: Vector2D;
  velocity: Vector2D;
  value: number;
  size: number;
  isBeingCollected: boolean;
}

// ============ UPGRADES ============
export interface UpgradeOption {
  id: string;
  type: 'weapon' | 'passive' | 'stat';
  weaponType?: WeaponType;
  passiveType?: PassiveItemType;
  statType?: 'health' | 'moveSpeed' | 'bandwidth';
  name: string;
  description: string;
  icon: string;
  currentLevel?: number;
  maxLevel?: number;
  isNew?: boolean;
  isEvolution?: boolean;
}

// ============ DATACENTER LEVELS ============
export type Difficulty = 'tutorial' | 'easy' | 'medium' | 'hard' | 'boss';

export interface DatacenterLevel {
  id: string;
  name: string;
  company: string;
  city: string;
  country: string;
  coordinates: [number, number]; // [lng, lat]
  difficulty: Difficulty;
  description: string;
  enemyModifiers?: Partial<Record<EnemyType, number>>; // Spawn weight modifiers
  durationMinutes: number;
  unlockRequirement?: string;
  isUnlocked: boolean;
}

// ============ META PROGRESSION ============
export interface PermanentUpgrades {
  maxHealth: number;      // +10 HP per level
  bandwidth: number;      // +5% attack speed per level
  processing: number;     // +5% damage per level
  storage: number;        // +5% pickup radius per level
  firewall: number;       // -5% damage taken per level
}

export interface GameStats {
  totalPlayTime: number;
  totalKills: number;
  totalXP: number;
  highestLevel: number;
  gamesPlayed: number;
  wins: number;
  datacentersCleared: string[];
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  datacenter: string;
  time: number;
  kills: number;
  timestamp: number;
}

// ============ GAME STATE ============
export enum GameState {
  MAP_SELECT = 'MAP_SELECT',
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  LEVEL_UP = 'LEVEL_UP',
  EVOLUTION = 'EVOLUTION',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

// ============ VISUAL EFFECTS ============
export interface Particle {
  position: Vector2D;
  velocity: Vector2D;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'explosion' | 'data' | 'spark' | 'trail';
}

export interface DamageNumber {
  position: Vector2D;
  value: number;
  life: number;
  color: string;
  isCritical: boolean;
}
