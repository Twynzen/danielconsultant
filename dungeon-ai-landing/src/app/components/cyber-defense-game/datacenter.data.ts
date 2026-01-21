import { DatacenterLevel } from './game.types';

// ============ 50+ REAL DATACENTER LOCATIONS ============
export const DATACENTER_LEVELS: DatacenterLevel[] = [
  // ==================== TUTORIAL LEVELS ====================
  {
    id: 'tutorial-1',
    name: 'Training Facility',
    company: 'CyberSec Academy',
    city: 'Silicon Valley',
    country: 'USA',
    coordinates: [-122.0840, 37.4220],
    difficulty: 'tutorial',
    description: 'Learn the basics of cyber defense.',
    durationMinutes: 3,
    isUnlocked: true
  },

  // ==================== GOOGLE DATACENTERS (Easy) ====================
  {
    id: 'google-dalles',
    name: 'The Dalles',
    company: 'Google',
    city: 'The Dalles, Oregon',
    country: 'USA',
    coordinates: [-121.1787, 45.5946],
    difficulty: 'easy',
    description: 'Google\'s first major datacenter. Cooled by Columbia River water.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'google-council',
    name: 'Council Bluffs',
    company: 'Google',
    city: 'Council Bluffs, Iowa',
    country: 'USA',
    coordinates: [-95.8608, 41.2619],
    difficulty: 'easy',
    description: 'Massive facility in the American heartland.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'google-hamina',
    name: 'Hamina Mill',
    company: 'Google',
    city: 'Hamina',
    country: 'Finland',
    coordinates: [27.1977, 60.5697],
    difficulty: 'easy',
    description: 'Converted paper mill using Baltic Sea water for cooling.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'google-eemshaven',
    name: 'Eemshaven',
    company: 'Google',
    city: 'Eemshaven',
    country: 'Netherlands',
    coordinates: [6.8347, 53.4390],
    difficulty: 'easy',
    description: 'Wind-powered datacenter on the Dutch coast.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'google-changhua',
    name: 'Changhua County',
    company: 'Google',
    city: 'Changhua',
    country: 'Taiwan',
    coordinates: [120.5161, 24.0518],
    difficulty: 'easy',
    description: 'Google\'s first datacenter in Asia.',
    durationMinutes: 5,
    isUnlocked: true
  },

  // ==================== AWS DATACENTERS (Medium) ====================
  {
    id: 'aws-ashburn',
    name: 'US-East-1',
    company: 'Amazon AWS',
    city: 'Ashburn, Virginia',
    country: 'USA',
    coordinates: [-77.4874, 39.0438],
    difficulty: 'medium',
    description: 'The original AWS region. Hosts much of the internet.',
    enemyModifiers: { trojan: 1.5, ransomware: 1.3 },
    durationMinutes: 10,
    isUnlocked: false,
    unlockRequirement: 'Clear 3 Easy levels'
  },
  {
    id: 'aws-oregon',
    name: 'US-West-2',
    company: 'Amazon AWS',
    city: 'Boardman, Oregon',
    country: 'USA',
    coordinates: [-119.7006, 45.8399],
    difficulty: 'medium',
    description: 'Major West Coast infrastructure hub.',
    enemyModifiers: { worm: 1.5 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'aws-dublin',
    name: 'EU-Ireland',
    company: 'Amazon AWS',
    city: 'Dublin',
    country: 'Ireland',
    coordinates: [-6.2603, 53.3498],
    difficulty: 'medium',
    description: 'Primary European AWS region.',
    enemyModifiers: { rootkit: 1.5 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'aws-tokyo',
    name: 'AP-Northeast-1',
    company: 'Amazon AWS',
    city: 'Tokyo',
    country: 'Japan',
    coordinates: [139.6503, 35.6762],
    difficulty: 'medium',
    description: 'Busiest Asia-Pacific region.',
    enemyModifiers: { ddos: 1.8 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'aws-saopaulo',
    name: 'SA-East-1',
    company: 'Amazon AWS',
    city: 'Sao Paulo',
    country: 'Brazil',
    coordinates: [-46.6333, -23.5505],
    difficulty: 'medium',
    description: 'South America\'s cloud hub.',
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'aws-singapore',
    name: 'AP-Southeast-1',
    company: 'Amazon AWS',
    city: 'Singapore',
    country: 'Singapore',
    coordinates: [103.8198, 1.3521],
    difficulty: 'medium',
    description: 'Strategic Southeast Asian hub.',
    enemyModifiers: { trojan: 1.3, zeroday: 1.2 },
    durationMinutes: 10,
    isUnlocked: false
  },

  // ==================== MICROSOFT AZURE (Hard) ====================
  {
    id: 'azure-virginia',
    name: 'East US',
    company: 'Microsoft Azure',
    city: 'Boydton, Virginia',
    country: 'USA',
    coordinates: [-78.3875, 36.6677],
    difficulty: 'hard',
    description: 'One of Azure\'s largest facilities.',
    enemyModifiers: { apt: 1.3, zeroday: 1.5 },
    durationMinutes: 15,
    isUnlocked: false,
    unlockRequirement: 'Clear 3 Medium levels'
  },
  {
    id: 'azure-quincy',
    name: 'West US 2',
    company: 'Microsoft Azure',
    city: 'Quincy, Washington',
    country: 'USA',
    coordinates: [-119.8526, 47.2343],
    difficulty: 'hard',
    description: 'Hydropower-cooled mega facility.',
    enemyModifiers: { ransomware: 1.5 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'azure-amsterdam',
    name: 'West Europe',
    company: 'Microsoft Azure',
    city: 'Amsterdam',
    country: 'Netherlands',
    coordinates: [4.9041, 52.3676],
    difficulty: 'hard',
    description: 'Major European Azure region.',
    enemyModifiers: { rootkit: 1.8 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'azure-sydney',
    name: 'Australia East',
    company: 'Microsoft Azure',
    city: 'Sydney',
    country: 'Australia',
    coordinates: [151.2093, -33.8688],
    difficulty: 'hard',
    description: 'Primary Australian cloud infrastructure.',
    durationMinutes: 15,
    isUnlocked: false
  },

  // ==================== META/FACEBOOK (Hard) ====================
  {
    id: 'meta-lulea',
    name: 'Lulea',
    company: 'Meta',
    city: 'Lulea',
    country: 'Sweden',
    coordinates: [22.1465, 65.5848],
    difficulty: 'hard',
    description: 'Arctic-cooled facility near the Polar Circle.',
    enemyModifiers: { apt: 1.2 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'meta-prineville',
    name: 'Prineville',
    company: 'Meta',
    city: 'Prineville, Oregon',
    country: 'USA',
    coordinates: [-120.8502, 44.3010],
    difficulty: 'hard',
    description: 'Meta\'s first custom-built datacenter.',
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'meta-singapore',
    name: 'Singapore DC',
    company: 'Meta',
    city: 'Singapore',
    country: 'Singapore',
    coordinates: [103.7492, 1.3644],
    difficulty: 'hard',
    description: '11-story vertical datacenter.',
    enemyModifiers: { ddos: 1.5, trojan: 1.3 },
    durationMinutes: 15,
    isUnlocked: false
  },

  // ==================== FINANCIAL EXCHANGES (Boss) ====================
  {
    id: 'nyse',
    name: 'NYSE Datacenter',
    company: 'New York Stock Exchange',
    city: 'Mahwah, New Jersey',
    country: 'USA',
    coordinates: [-74.1857, 41.0534],
    difficulty: 'boss',
    description: 'The nerve center of global finance. Maximum security.',
    enemyModifiers: { apt: 2.0, zeroday: 2.0, ransomware: 1.8 },
    durationMinutes: 20,
    isUnlocked: false,
    unlockRequirement: 'Clear 3 Hard levels'
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ OMX',
    company: 'NASDAQ',
    city: 'Carteret, New Jersey',
    country: 'USA',
    coordinates: [-74.2282, 40.5832],
    difficulty: 'boss',
    description: 'Tech stock exchange. High-frequency trading target.',
    enemyModifiers: { ddos: 2.5, zeroday: 1.8 },
    durationMinutes: 20,
    isUnlocked: false
  },
  {
    id: 'lse',
    name: 'London Stock Exchange',
    company: 'LSE',
    city: 'Basildon',
    country: 'UK',
    coordinates: [0.4635, 51.5760],
    difficulty: 'boss',
    description: 'Europe\'s largest exchange. APT hotspot.',
    enemyModifiers: { apt: 2.5, rootkit: 2.0 },
    durationMinutes: 20,
    isUnlocked: false
  },
  {
    id: 'tse',
    name: 'Tokyo Stock Exchange',
    company: 'JPX',
    city: 'Tokyo',
    country: 'Japan',
    coordinates: [139.7758, 35.6813],
    difficulty: 'boss',
    description: 'Asia\'s premier financial market.',
    enemyModifiers: { apt: 2.0, ransomware: 2.0, ddos: 2.0 },
    durationMinutes: 20,
    isUnlocked: false
  },
  {
    id: 'hkex',
    name: 'Hong Kong Exchange',
    company: 'HKEX',
    city: 'Hong Kong',
    country: 'Hong Kong',
    coordinates: [114.1550, 22.2837],
    difficulty: 'boss',
    description: 'Gateway to China. Extreme threat level.',
    enemyModifiers: { apt: 3.0, zeroday: 2.5 },
    durationMinutes: 20,
    isUnlocked: false
  },

  // ==================== TECH GIANTS HQ (Special) ====================
  {
    id: 'apple-park',
    name: 'Apple Park',
    company: 'Apple',
    city: 'Cupertino, California',
    country: 'USA',
    coordinates: [-122.0091, 37.3346],
    difficulty: 'hard',
    description: 'The Ring. Apple\'s crown jewel.',
    enemyModifiers: { zeroday: 2.0 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'meta-hq',
    name: 'Meta HQ',
    company: 'Meta',
    city: 'Menlo Park, California',
    country: 'USA',
    coordinates: [-122.1480, 37.4850],
    difficulty: 'hard',
    description: 'Metaverse command center.',
    enemyModifiers: { trojan: 1.5, worm: 1.5 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'nvidia-endeavor',
    name: 'Endeavor Building',
    company: 'NVIDIA',
    city: 'Santa Clara, California',
    country: 'USA',
    coordinates: [-121.9647, 37.3708],
    difficulty: 'hard',
    description: 'AI chip giant headquarters.',
    enemyModifiers: { apt: 1.5, zeroday: 1.5 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'spacex-hq',
    name: 'SpaceX HQ',
    company: 'SpaceX',
    city: 'Hawthorne, California',
    country: 'USA',
    coordinates: [-118.3275, 33.9199],
    difficulty: 'hard',
    description: 'Rocket telemetry and Starlink control.',
    enemyModifiers: { apt: 2.0 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'tesla-giga',
    name: 'Gigafactory Texas',
    company: 'Tesla',
    city: 'Austin, Texas',
    country: 'USA',
    coordinates: [-97.6170, 30.2230],
    difficulty: 'hard',
    description: 'Cybertruck and AI training facility.',
    durationMinutes: 15,
    isUnlocked: false
  },

  // ==================== ADDITIONAL LOCATIONS ====================
  {
    id: 'equinix-ashburn',
    name: 'Equinix DC1-DC15',
    company: 'Equinix',
    city: 'Ashburn, Virginia',
    country: 'USA',
    coordinates: [-77.4710, 39.0300],
    difficulty: 'medium',
    description: 'Internet backbone. Massive peering point.',
    enemyModifiers: { ddos: 2.0 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'digital-realty-frankfurt',
    name: 'Frankfurt Hub',
    company: 'Digital Realty',
    city: 'Frankfurt',
    country: 'Germany',
    coordinates: [8.6821, 50.1109],
    difficulty: 'medium',
    description: 'Europe\'s largest internet exchange.',
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'alibaba-hangzhou',
    name: 'Alibaba Cloud',
    company: 'Alibaba',
    city: 'Hangzhou',
    country: 'China',
    coordinates: [120.1551, 30.2741],
    difficulty: 'hard',
    description: 'Asia\'s largest cloud provider.',
    enemyModifiers: { apt: 1.8, ddos: 1.5 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'tencent-shenzhen',
    name: 'Tencent Cloud',
    company: 'Tencent',
    city: 'Shenzhen',
    country: 'China',
    coordinates: [114.0579, 22.5431],
    difficulty: 'hard',
    description: 'WeChat and gaming empire headquarters.',
    enemyModifiers: { worm: 1.8, ddos: 1.5 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'oracle-austin',
    name: 'Oracle Cloud',
    company: 'Oracle',
    city: 'Austin, Texas',
    country: 'USA',
    coordinates: [-97.7431, 30.2672],
    difficulty: 'medium',
    description: 'Enterprise database giant.',
    enemyModifiers: { ransomware: 1.5 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'ibm-poughkeepsie',
    name: 'IBM Mainframe Center',
    company: 'IBM',
    city: 'Poughkeepsie, New York',
    country: 'USA',
    coordinates: [-73.9215, 41.7004],
    difficulty: 'medium',
    description: 'Legacy mainframe and quantum research.',
    enemyModifiers: { rootkit: 1.5 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'cloudflare-sf',
    name: 'Cloudflare HQ',
    company: 'Cloudflare',
    city: 'San Francisco',
    country: 'USA',
    coordinates: [-122.3992, 37.7902],
    difficulty: 'medium',
    description: 'DDoS protection specialist.',
    enemyModifiers: { ddos: 2.5 },
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'ovh-roubaix',
    name: 'OVH Roubaix',
    company: 'OVHcloud',
    city: 'Roubaix',
    country: 'France',
    coordinates: [3.1746, 50.6942],
    difficulty: 'medium',
    description: 'Europe\'s largest hosting provider.',
    durationMinutes: 10,
    isUnlocked: false
  },
  {
    id: 'hetzner-falkenstein',
    name: 'Hetzner Park',
    company: 'Hetzner',
    city: 'Falkenstein',
    country: 'Germany',
    coordinates: [12.3255, 50.4781],
    difficulty: 'easy',
    description: 'Budget-friendly German hosting.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'digitalocean-nyc',
    name: 'DigitalOcean NYC',
    company: 'DigitalOcean',
    city: 'New York',
    country: 'USA',
    coordinates: [-74.0060, 40.7128],
    difficulty: 'easy',
    description: 'Developer-friendly cloud platform.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'vultr-nj',
    name: 'Vultr New Jersey',
    company: 'Vultr',
    city: 'Piscataway',
    country: 'USA',
    coordinates: [-74.4390, 40.4862],
    difficulty: 'easy',
    description: 'High-performance cloud compute.',
    durationMinutes: 5,
    isUnlocked: true
  },
  {
    id: 'linode-dallas',
    name: 'Linode Dallas',
    company: 'Akamai/Linode',
    city: 'Dallas',
    country: 'USA',
    coordinates: [-96.7970, 32.7767],
    difficulty: 'easy',
    description: 'Independent cloud alternative.',
    durationMinutes: 5,
    isUnlocked: true
  },

  // ==================== GOVERNMENT/DEFENSE ====================
  {
    id: 'nsa-utah',
    name: 'Utah Data Center',
    company: 'NSA',
    city: 'Bluffdale, Utah',
    country: 'USA',
    coordinates: [-111.9413, 40.4232],
    difficulty: 'boss',
    description: 'Intelligence Community Comprehensive National Cybersecurity Initiative.',
    enemyModifiers: { apt: 3.0, zeroday: 3.0, rootkit: 2.5 },
    durationMinutes: 25,
    isUnlocked: false,
    unlockRequirement: 'Clear all Financial Boss levels'
  },
  {
    id: 'pentagon-cloud',
    name: 'JEDI Cloud',
    company: 'DoD',
    city: 'Pentagon',
    country: 'USA',
    coordinates: [-77.0558, 38.8719],
    difficulty: 'boss',
    description: 'Joint Enterprise Defense Infrastructure.',
    enemyModifiers: { apt: 3.5, zeroday: 3.0 },
    durationMinutes: 25,
    isUnlocked: false
  },

  // ==================== CRYPTO/WEB3 ====================
  {
    id: 'coinbase-sf',
    name: 'Coinbase Vault',
    company: 'Coinbase',
    city: 'San Francisco',
    country: 'USA',
    coordinates: [-122.4194, 37.7749],
    difficulty: 'hard',
    description: 'Cryptocurrency exchange cold storage.',
    enemyModifiers: { ransomware: 2.0, trojan: 1.8 },
    durationMinutes: 15,
    isUnlocked: false
  },
  {
    id: 'binance-malta',
    name: 'Binance EU',
    company: 'Binance',
    city: 'Malta',
    country: 'Malta',
    coordinates: [14.5146, 35.8989],
    difficulty: 'hard',
    description: 'World\'s largest crypto exchange.',
    enemyModifiers: { apt: 1.5, ransomware: 2.5 },
    durationMinutes: 15,
    isUnlocked: false
  }
];

// Helper function to get levels by difficulty
export function getLevelsByDifficulty(difficulty: string): DatacenterLevel[] {
  return DATACENTER_LEVELS.filter(level => level.difficulty === difficulty);
}

// Helper function to get unlocked levels
export function getUnlockedLevels(): DatacenterLevel[] {
  return DATACENTER_LEVELS.filter(level => level.isUnlocked);
}

// Helper function to count total levels
export function getTotalLevelCount(): number {
  return DATACENTER_LEVELS.length;
}

// Get difficulty color
export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    tutorial: '#00ff00',
    easy: '#00ffff',
    medium: '#ffff00',
    hard: '#ff6600',
    boss: '#ff0066'
  };
  return colors[difficulty] || '#ffffff';
}

// Get difficulty marker size
export function getDifficultyMarkerSize(difficulty: string): number {
  const sizes: Record<string, number> = {
    tutorial: 8,
    easy: 10,
    medium: 12,
    hard: 14,
    boss: 18
  };
  return sizes[difficulty] || 10;
}
