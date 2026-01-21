import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  Vector2D, Player, Enemy, EnemyType, Projectile, DataOrb, Particle, DamageNumber,
  Weapon, WeaponType, PassiveItem, PassiveItemType, UpgradeOption, DatacenterLevel,
  GameState, PermanentUpgrades, GameStats, LeaderboardEntry,
  ENEMY_CONFIGS, WEAPON_CONFIGS, PASSIVE_CONFIGS
} from './game.types';
import { DATACENTER_LEVELS, getDifficultyColor } from './datacenter.data';
import { WorldMapComponent } from './world-map.component';

@Component({
  selector: 'app-cyber-defense-game',
  standalone: true,
  imports: [CommonModule, WorldMapComponent],
  templateUrl: './cyber-defense-game.component.html',
  styleUrl: './cyber-defense-game.component.scss'
})
export class CyberDefenseGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId?: number;

  // ============ SIGNALS ============
  gameState = signal<GameState>(GameState.MAP_SELECT);
  GameState = GameState; // Expose to template

  // ============ CURRENT LEVEL ============
  currentLevel: DatacenterLevel | null = null;
  allLevels = DATACENTER_LEVELS;

  // ============ PLAYER ============
  player: Player = this.createDefaultPlayer();

  // ============ INPUT ============
  private keys: { [key: string]: boolean } = {};

  // ============ GAME OBJECTS ============
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private dataOrbs: DataOrb[] = [];
  private particles: Particle[] = [];
  private damageNumbers: DamageNumber[] = [];

  // ============ GAME STATS ============
  score = 0;
  survivalTime = 0;
  killCount = 0;
  gameTime = 0; // in seconds

  // ============ TIMERS ============
  private lastTime = 0;
  private survivalTimer = 0;
  private difficultyTimer = 0;
  private lastEnemySpawnTime = 0;

  // ============ DIFFICULTY ============
  private difficultyMultiplier = 1;
  private enemySpawnRate = 2000;
  private maxEnemies = 50;

  // ============ LEVEL UP ============
  availableUpgrades: UpgradeOption[] = [];
  evolutionAvailable: { weapon: Weapon; newName: string; newDescription: string } | null = null;

  // ============ META PROGRESSION ============
  permanentUpgrades: PermanentUpgrades = this.loadPermanentUpgrades();
  gameStats: GameStats = this.loadGameStats();
  leaderboard: LeaderboardEntry[] = this.loadLeaderboard();
  currency = signal(this.loadCurrency());

  // ============ CANVAS ============
  private readonly CANVAS_WIDTH = 1200;
  private readonly CANVAS_HEIGHT = 800;

  // ============ VISUAL SETTINGS ============
  private scanlineOpacity = 0.03;
  private glitchIntensity = 0;
  private matrixRain: { x: number; y: number; speed: number; char: string }[] = [];

  constructor(private router: Router) {
    this.initMatrixRain();
  }

  // ============ LIFECYCLE ============
  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    canvas.width = this.CANVAS_WIDTH;
    canvas.height = this.CANVAS_HEIGHT;
    this.renderMapSelect();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  // ============ INPUT HANDLING ============
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = true;

    if (event.key === 'Escape') {
      if (this.gameState() === GameState.PLAYING) {
        this.pauseGame();
      } else if (this.gameState() === GameState.PAUSED) {
        this.resumeGame();
      } else if (this.gameState() === GameState.MAP_SELECT) {
        this.exitToLanding();
      }
    }

    if (event.key === ' ' && this.gameState() === GameState.MENU) {
      event.preventDefault();
      this.startGame();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = false;
  }

  // ============ PLAYER CREATION ============
  private createDefaultPlayer(): Player {
    const upgrades = this.loadPermanentUpgrades();
    return {
      id: 'player',
      position: { x: this.CANVAS_WIDTH / 2, y: this.CANVAS_HEIGHT / 2 },
      velocity: { x: 0, y: 0 },
      size: 18,
      health: 100 + (upgrades.maxHealth * 10),
      maxHealth: 100 + (upgrades.maxHealth * 10),
      isDead: false,
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      moveSpeed: 3 * (1 + upgrades.firewall * 0.05),
      bandwidth: 1 + (upgrades.bandwidth * 0.05),
      weapons: [],
      passiveItems: [],
      permanentUpgrades: upgrades
    };
  }

  // ============ GAME LOOP ============
  private gameLoop = (currentTime: number): void => {
    if (this.gameState() !== GameState.PLAYING) {
      return;
    }

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  // ============ UPDATE ============
  private update(deltaTime: number): void {
    // Update survival time
    this.survivalTimer += deltaTime;
    this.survivalTime = Math.floor(this.survivalTimer / 1000);
    this.gameTime = this.survivalTime;

    // Check victory condition
    if (this.currentLevel && this.survivalTime >= this.currentLevel.durationMinutes * 60) {
      this.victory();
      return;
    }

    // Update difficulty every 30 seconds
    this.difficultyTimer += deltaTime;
    if (this.difficultyTimer >= 30000) {
      this.increaseDifficulty();
      this.difficultyTimer = 0;
    }

    // Update systems
    this.updatePlayer(deltaTime);
    this.updateWeapons(deltaTime);
    this.updateEnemySpawning(deltaTime);
    this.updateEnemies(deltaTime);
    this.updateProjectiles(deltaTime);
    this.updateDataOrbs(deltaTime);
    this.updateParticles(deltaTime);
    this.updateDamageNumbers(deltaTime);
    this.checkCollisions();
    this.cleanupDeadObjects();

    // Check game over
    if (this.player.health <= 0 && !this.player.isDead) {
      this.player.isDead = true;
      this.gameOver();
    }

    // Random glitch effect
    if (Math.random() < 0.001) {
      this.glitchIntensity = Math.random() * 0.5;
    } else {
      this.glitchIntensity *= 0.95;
    }
  }

  private updatePlayer(deltaTime: number): void {
    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    // Apply movement
    this.player.position.x += dx * this.player.moveSpeed;
    this.player.position.y += dy * this.player.moveSpeed;

    // Keep in bounds
    const margin = this.player.size;
    this.player.position.x = Math.max(margin, Math.min(this.CANVAS_WIDTH - margin, this.player.position.x));
    this.player.position.y = Math.max(margin, Math.min(this.CANVAS_HEIGHT - margin, this.player.position.y));
  }

  private updateWeapons(deltaTime: number): void {
    const currentTime = performance.now();

    for (const weapon of this.player.weapons) {
      const config = WEAPON_CONFIGS[weapon.type];
      const cooldown = weapon.cooldown / this.player.bandwidth;

      if (currentTime - weapon.lastFired >= cooldown) {
        this.fireWeapon(weapon);
        weapon.lastFired = currentTime;
      }
    }
  }

  private fireWeapon(weapon: Weapon): void {
    const config = WEAPON_CONFIGS[weapon.type];
    const nearestEnemy = this.findNearestEnemy();

    switch (weapon.type) {
      case 'firewall':
      case 'antivirus':
      case 'ddos-defender':
        if (nearestEnemy && this.getDistance(this.player.position, nearestEnemy.position) <= weapon.range) {
          this.createProjectile(weapon, nearestEnemy.position);
        }
        break;

      case 'packet-analyzer':
        // Spread shot
        for (let i = 0; i < weapon.projectileCount; i++) {
          const spreadAngle = ((i - (weapon.projectileCount - 1) / 2) * 15) * (Math.PI / 180);
          const baseAngle = nearestEnemy
            ? Math.atan2(nearestEnemy.position.y - this.player.position.y, nearestEnemy.position.x - this.player.position.x)
            : Math.random() * Math.PI * 2;
          const angle = baseAngle + spreadAngle;

          this.projectiles.push({
            id: this.generateId(),
            position: { ...this.player.position },
            velocity: {
              x: Math.cos(angle) * weapon.projectileSpeed,
              y: Math.sin(angle) * weapon.projectileSpeed
            },
            damage: weapon.damage,
            size: 4,
            lifetime: 2000,
            color: config.color,
            weaponType: weapon.type,
            piercing: weapon.piercing,
            hitEnemies: new Set()
          });
        }
        break;

      case 'encryption':
        // Rotating shield - handled in render
        break;

      case 'honeypot':
        // AoE damage around player
        for (const enemy of this.enemies) {
          const distance = this.getDistance(this.player.position, enemy.position);
          if (distance <= weapon.range) {
            enemy.health -= weapon.damage;
            this.createDamageNumber(enemy.position, weapon.damage);
            this.createParticles(enemy.position, config.color, 3);
          }
        }
        break;
    }
  }

  private createProjectile(weapon: Weapon, targetPos: Vector2D): void {
    const config = WEAPON_CONFIGS[weapon.type];
    const direction = this.normalize({
      x: targetPos.x - this.player.position.x,
      y: targetPos.y - this.player.position.y
    });

    for (let i = 0; i < weapon.projectileCount; i++) {
      const spread = (i - (weapon.projectileCount - 1) / 2) * 0.1;
      this.projectiles.push({
        id: this.generateId(),
        position: { ...this.player.position },
        velocity: {
          x: (direction.x + spread) * weapon.projectileSpeed,
          y: (direction.y + spread) * weapon.projectileSpeed
        },
        damage: weapon.damage,
        size: 5,
        lifetime: 2000,
        color: config.color,
        weaponType: weapon.type,
        piercing: weapon.piercing,
        hitEnemies: new Set()
      });
    }
  }

  private updateEnemySpawning(deltaTime: number): void {
    const currentTime = performance.now();
    if (currentTime - this.lastEnemySpawnTime >= this.enemySpawnRate && this.enemies.length < this.maxEnemies) {
      this.spawnEnemy();
      this.lastEnemySpawnTime = currentTime;
    }
  }

  private spawnEnemy(): void {
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;

    switch (side) {
      case 0: x = Math.random() * this.CANVAS_WIDTH; y = -30; break;
      case 1: x = this.CANVAS_WIDTH + 30; y = Math.random() * this.CANVAS_HEIGHT; break;
      case 2: x = Math.random() * this.CANVAS_WIDTH; y = this.CANVAS_HEIGHT + 30; break;
      case 3: x = -30; y = Math.random() * this.CANVAS_HEIGHT; break;
    }

    const enemyType = this.selectEnemyType();
    const enemy = this.createEnemy(x, y, enemyType);
    this.enemies.push(enemy);
  }

  private selectEnemyType(): EnemyType {
    const availableTypes = Object.entries(ENEMY_CONFIGS)
      .filter(([_, config]) => config.minDifficulty <= this.difficultyMultiplier)
      .map(([type, config]) => {
        let weight = config.spawnWeight;
        // Apply level modifiers
        if (this.currentLevel?.enemyModifiers?.[type as EnemyType]) {
          weight *= this.currentLevel.enemyModifiers[type as EnemyType]!;
        }
        return { type: type as EnemyType, weight };
      });

    const totalWeight = availableTypes.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { type, weight } of availableTypes) {
      random -= weight;
      if (random <= 0) return type;
    }

    return 'malware';
  }

  private createEnemy(x: number, y: number, type: EnemyType): Enemy {
    const config = ENEMY_CONFIGS[type];
    const diffScale = Math.sqrt(this.difficultyMultiplier);

    return {
      id: this.generateId(),
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: config.size * diffScale,
      health: config.health * this.difficultyMultiplier,
      maxHealth: config.health * this.difficultyMultiplier,
      isDead: false,
      type,
      damage: config.damage * diffScale,
      xpValue: config.xpValue * this.difficultyMultiplier,
      color: config.color,
      secondaryColor: config.secondaryColor,
      movePattern: config.movePattern,
      specialAbility: undefined
    };
  }

  private updateEnemies(deltaTime: number): void {
    const time = performance.now() / 1000;

    for (const enemy of this.enemies) {
      const config = ENEMY_CONFIGS[enemy.type];
      let direction = this.normalize({
        x: this.player.position.x - enemy.position.x,
        y: this.player.position.y - enemy.position.y
      });

      let speed = config.speed * Math.sqrt(this.difficultyMultiplier);

      // Movement patterns
      switch (enemy.movePattern) {
        case 'zigzag':
          const zigzag = Math.sin(time * 5 + enemy.position.x * 0.1) * 0.5;
          direction.x += zigzag;
          direction = this.normalize(direction);
          break;

        case 'stealth':
          // Phase in/out
          if (Math.sin(time * 2 + enemy.id.charCodeAt(0)) < -0.5) {
            speed *= 0.3;
          }
          break;

        case 'swarm':
          // Slight randomness for swarm behavior
          direction.x += (Math.random() - 0.5) * 0.3;
          direction.y += (Math.random() - 0.5) * 0.3;
          direction = this.normalize(direction);
          break;
      }

      enemy.position.x += direction.x * speed;
      enemy.position.y += direction.y * speed;
    }
  }

  private updateProjectiles(deltaTime: number): void {
    for (const projectile of this.projectiles) {
      projectile.position.x += projectile.velocity.x;
      projectile.position.y += projectile.velocity.y;
      projectile.lifetime -= deltaTime;

      // Create trail particles
      if (Math.random() < 0.3) {
        this.particles.push({
          position: { ...projectile.position },
          velocity: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
          life: 300,
          maxLife: 300,
          size: 2,
          color: projectile.color,
          type: 'trail'
        });
      }
    }
  }

  private updateDataOrbs(deltaTime: number): void {
    const pickupRadius = 50 + this.getPassiveBonus('pickupRadius');

    for (const orb of this.dataOrbs) {
      const distance = this.getDistance(this.player.position, orb.position);

      if (distance <= pickupRadius) {
        orb.isBeingCollected = true;

        const direction = this.normalize({
          x: this.player.position.x - orb.position.x,
          y: this.player.position.y - orb.position.y
        });

        orb.position.x += direction.x * 12;
        orb.position.y += direction.y * 12;

        if (distance <= this.player.size + orb.size) {
          this.collectXP(orb.value);
          orb.value = 0;
        }
      }
    }
  }

  private updateParticles(deltaTime: number): void {
    for (const particle of this.particles) {
      particle.position.x += particle.velocity.x;
      particle.position.y += particle.velocity.y;
      particle.life -= deltaTime;
      particle.velocity.x *= 0.98;
      particle.velocity.y *= 0.98;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  private updateDamageNumbers(deltaTime: number): void {
    for (const num of this.damageNumbers) {
      num.position.y -= 1;
      num.life -= deltaTime;
    }
    this.damageNumbers = this.damageNumbers.filter(n => n.life > 0);
  }

  private checkCollisions(): void {
    const damageReduction = 1 - (this.player.permanentUpgrades.firewall * 0.05);

    // Projectile vs Enemy
    for (const projectile of this.projectiles) {
      for (const enemy of this.enemies) {
        if (projectile.hitEnemies.has(enemy.id)) continue;

        if (this.circleCollision(projectile.position, projectile.size, enemy.position, enemy.size)) {
          const damage = projectile.damage * (1 + this.getPassiveBonus('damage'));
          enemy.health -= damage;
          projectile.hitEnemies.add(enemy.id);

          this.createDamageNumber(enemy.position, damage);
          this.createParticles(enemy.position, projectile.color, 5);

          if (projectile.piercing <= 0) {
            projectile.lifetime = 0;
          } else {
            projectile.piercing--;
          }

          if (enemy.health <= 0 && !enemy.isDead) {
            enemy.isDead = true;
            this.onEnemyKilled(enemy);
          }
        }
      }
    }

    // Encryption shield collision
    const encryptionWeapon = this.player.weapons.find(w => w.type === 'encryption');
    if (encryptionWeapon) {
      const shieldRadius = encryptionWeapon.range;
      const time = performance.now() / 1000;

      for (let i = 0; i < encryptionWeapon.projectileCount; i++) {
        const angle = (time * 2) + (i * (Math.PI * 2 / encryptionWeapon.projectileCount));
        const shieldPos = {
          x: this.player.position.x + Math.cos(angle) * shieldRadius,
          y: this.player.position.y + Math.sin(angle) * shieldRadius
        };

        for (const enemy of this.enemies) {
          if (this.circleCollision(shieldPos, 15, enemy.position, enemy.size)) {
            enemy.health -= encryptionWeapon.damage;
            this.createParticles(enemy.position, '#ffff00', 3);

            if (enemy.health <= 0 && !enemy.isDead) {
              enemy.isDead = true;
              this.onEnemyKilled(enemy);
            }
          }
        }
      }
    }

    // Enemy vs Player
    for (const enemy of this.enemies) {
      if (this.circleCollision(enemy.position, enemy.size, this.player.position, this.player.size)) {
        const damage = enemy.damage * 0.016 * damageReduction;
        this.player.health -= damage;
        this.player.health = Math.max(0, this.player.health);
      }
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.killCount++;
    this.score += Math.floor(enemy.xpValue * 10);

    // Drop data orb
    this.dataOrbs.push({
      id: this.generateId(),
      position: { ...enemy.position },
      velocity: { x: 0, y: 0 },
      value: enemy.xpValue,
      size: Math.min(12, 6 + enemy.xpValue / 10),
      isBeingCollected: false
    });

    // Worm special: spawn more worms on death
    if (enemy.type === 'worm' && Math.random() < 0.3) {
      for (let i = 0; i < 2; i++) {
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        const newWorm = this.createEnemy(
          enemy.position.x + offsetX,
          enemy.position.y + offsetY,
          'worm'
        );
        newWorm.health *= 0.5;
        newWorm.maxHealth *= 0.5;
        newWorm.size *= 0.7;
        this.enemies.push(newWorm);
      }
    }

    // Create explosion particles
    this.createParticles(enemy.position, enemy.color, 15);
  }

  private collectXP(amount: number): void {
    const bonus = 1 + (this.player.permanentUpgrades.storage * 0.05);
    this.player.xp += Math.floor(amount * bonus);

    if (this.player.xp >= this.player.xpToNextLevel) {
      this.levelUp();
    }
  }

  private levelUp(): void {
    this.player.xp -= this.player.xpToNextLevel;
    this.player.level++;
    this.player.xpToNextLevel = Math.floor(this.player.xpToNextLevel * 1.5);

    // Heal player
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 20);

    // Check for evolution
    const evolution = this.checkEvolution();
    if (evolution) {
      this.evolutionAvailable = evolution;
      this.gameState.set(GameState.EVOLUTION);
    } else {
      this.generateUpgradeOptions();
      this.gameState.set(GameState.LEVEL_UP);
    }

    // Create level up particles
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      this.particles.push({
        position: { ...this.player.position },
        velocity: { x: Math.cos(angle) * 5, y: Math.sin(angle) * 5 },
        life: 1000,
        maxLife: 1000,
        size: 4,
        color: '#00ffff',
        type: 'data'
      });
    }
  }

  private checkEvolution(): { weapon: Weapon; newName: string; newDescription: string } | null {
    for (const weapon of this.player.weapons) {
      if (weapon.level >= weapon.maxLevel && !weapon.evolved) {
        const config = WEAPON_CONFIGS[weapon.type];
        const hasRequirement = this.player.passiveItems.some(
          p => p.type === config.evolutionRequirement && p.level >= 3
        );

        if (hasRequirement) {
          return {
            weapon,
            newName: config.evolvedName,
            newDescription: config.evolvedDescription
          };
        }
      }
    }
    return null;
  }

  evolveWeapon(): void {
    if (this.evolutionAvailable) {
      const weapon = this.evolutionAvailable.weapon;
      weapon.evolved = true;
      weapon.damage *= 2;
      weapon.projectileCount += 2;
      weapon.range *= 1.5;

      this.evolutionAvailable = null;
      this.gameState.set(GameState.PLAYING);
      this.lastTime = performance.now();
      this.animationFrameId = requestAnimationFrame(this.gameLoop);
    }
  }

  private generateUpgradeOptions(): void {
    const options: UpgradeOption[] = [];

    // Weapon upgrades
    const weaponTypes: WeaponType[] = ['firewall', 'antivirus', 'honeypot', 'encryption', 'packet-analyzer', 'ddos-defender'];

    for (const type of weaponTypes) {
      const existing = this.player.weapons.find(w => w.type === type);
      const config = WEAPON_CONFIGS[type];

      if (!existing) {
        options.push({
          id: `new-${type}`,
          type: 'weapon',
          weaponType: type,
          name: config.name,
          description: config.description,
          icon: config.icon,
          isNew: true
        });
      } else if (existing.level < existing.maxLevel) {
        options.push({
          id: `upgrade-${type}`,
          type: 'weapon',
          weaponType: type,
          name: `${config.name} Lv${existing.level + 1}`,
          description: `+20% damage, +10% speed`,
          icon: config.icon,
          currentLevel: existing.level,
          maxLevel: existing.maxLevel
        });
      }
    }

    // Passive items
    const passiveTypes: PassiveItemType[] = ['bandwidth-boost', 'deep-learning', 'threat-intel', 'encryption-key', 'packet-amplifier', 'rate-limiter', 'cooling-system', 'overclock'];

    for (const type of passiveTypes) {
      const existing = this.player.passiveItems.find(p => p.type === type);
      const config = PASSIVE_CONFIGS[type];

      if (!existing) {
        options.push({
          id: `new-passive-${type}`,
          type: 'passive',
          passiveType: type,
          name: config.name,
          description: config.description,
          icon: config.icon,
          isNew: true
        });
      } else if (existing.level < existing.maxLevel) {
        options.push({
          id: `upgrade-passive-${type}`,
          type: 'passive',
          passiveType: type,
          name: `${config.name} Lv${existing.level + 1}`,
          description: config.description,
          icon: config.icon,
          currentLevel: existing.level,
          maxLevel: existing.maxLevel
        });
      }
    }

    // Shuffle and take 4
    this.availableUpgrades = options.sort(() => Math.random() - 0.5).slice(0, 4);
  }

  selectUpgrade(upgrade: UpgradeOption): void {
    if (upgrade.type === 'weapon' && upgrade.weaponType) {
      const existing = this.player.weapons.find(w => w.type === upgrade.weaponType);
      const config = WEAPON_CONFIGS[upgrade.weaponType];

      if (existing) {
        existing.level++;
        existing.damage *= 1.2;
        existing.cooldown *= 0.9;
      } else {
        this.player.weapons.push({
          type: upgrade.weaponType,
          level: 1,
          maxLevel: config.maxLevel,
          damage: config.baseDamage * (1 + this.player.permanentUpgrades.processing * 0.05),
          cooldown: config.baseCooldown,
          lastFired: 0,
          range: config.baseRange,
          projectileSpeed: config.baseProjectileSpeed,
          projectileCount: config.baseProjectileCount,
          piercing: config.basePiercing,
          evolved: false,
          evolutionRequirement: config.evolutionRequirement
        });
      }
    } else if (upgrade.type === 'passive' && upgrade.passiveType) {
      const existing = this.player.passiveItems.find(p => p.type === upgrade.passiveType);
      const config = PASSIVE_CONFIGS[upgrade.passiveType];

      if (existing) {
        existing.level++;
      } else {
        this.player.passiveItems.push({
          type: upgrade.passiveType,
          level: 1,
          maxLevel: config.maxLevel
        });
      }
    }

    this.gameState.set(GameState.PLAYING);
    this.availableUpgrades = [];
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  private getPassiveBonus(effect: string): number {
    let bonus = 0;
    for (const passive of this.player.passiveItems) {
      const config = PASSIVE_CONFIGS[passive.type];
      if (config.effect === effect) {
        bonus += passive.level * 0.1; // 10% per level
      }
    }
    return bonus;
  }

  private increaseDifficulty(): void {
    this.difficultyMultiplier += 0.3;
    this.enemySpawnRate = Math.max(300, this.enemySpawnRate * 0.85);
    this.maxEnemies = Math.min(200, this.maxEnemies + 15);
  }

  private cleanupDeadObjects(): void {
    this.enemies = this.enemies.filter(e => !e.isDead);
    this.projectiles = this.projectiles.filter(p => p.lifetime > 0);
    this.dataOrbs = this.dataOrbs.filter(o => o.value > 0);
  }

  // ============ RENDER ============
  private render(): void {
    // Clear
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Matrix rain background
    this.renderMatrixRain();

    // Grid
    this.renderGrid();

    // Data orbs
    for (const orb of this.dataOrbs) {
      this.renderDataOrb(orb);
    }

    // Particles (below enemies)
    for (const particle of this.particles) {
      if (particle.type === 'trail') {
        this.renderParticle(particle);
      }
    }

    // Enemies
    for (const enemy of this.enemies) {
      this.renderEnemy(enemy);
    }

    // Projectiles
    for (const projectile of this.projectiles) {
      this.renderProjectile(projectile);
    }

    // Encryption shield
    this.renderEncryptionShield();

    // Player
    this.renderPlayer();

    // Particles (above player)
    for (const particle of this.particles) {
      if (particle.type !== 'trail') {
        this.renderParticle(particle);
      }
    }

    // Damage numbers
    for (const num of this.damageNumbers) {
      this.renderDamageNumber(num);
    }

    // Scanlines
    this.renderScanlines();

    // Glitch effect
    if (this.glitchIntensity > 0.01) {
      this.renderGlitch();
    }

    // HUD
    this.renderHUD();
  }

  private renderMatrixRain(): void {
    this.ctx.fillStyle = '#00ff0008';
    this.ctx.font = '12px monospace';

    for (const drop of this.matrixRain) {
      this.ctx.fillText(drop.char, drop.x, drop.y);
      drop.y += drop.speed;

      if (drop.y > this.CANVAS_HEIGHT) {
        drop.y = -20;
        drop.char = this.getRandomMatrixChar();
      }
    }
  }

  private renderGrid(): void {
    this.ctx.strokeStyle = '#1a2a1a';
    this.ctx.lineWidth = 1;

    for (let x = 0; x < this.CANVAS_WIDTH; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.CANVAS_HEIGHT);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.CANVAS_HEIGHT; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.CANVAS_WIDTH, y);
      this.ctx.stroke();
    }
  }

  private renderPlayer(): void {
    const { x, y } = this.player.position;
    const size = this.player.size;

    // Glow
    this.ctx.shadowBlur = 25;
    this.ctx.shadowColor = '#00ffff';

    // Hexagon body
    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Inner detail
    this.ctx.fillStyle = '#003333';
    this.ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size * 0.5;
      const py = y + Math.sin(angle) * size * 0.5;
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Core
    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  }

  private renderEnemy(enemy: Enemy): void {
    const { x, y } = enemy.position;
    const size = enemy.size;
    const config = ENEMY_CONFIGS[enemy.type];
    const time = performance.now() / 1000;

    // Stealth effect for rootkit
    if (enemy.movePattern === 'stealth') {
      const alpha = Math.sin(time * 2 + enemy.id.charCodeAt(0)) < -0.5 ? 0.3 : 1;
      this.ctx.globalAlpha = alpha;
    }

    // Glow
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = enemy.color;

    this.ctx.fillStyle = enemy.color;

    switch (enemy.type) {
      case 'malware':
        // Diamond shape
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x + size, y);
        this.ctx.lineTo(x, y + size);
        this.ctx.lineTo(x - size, y);
        this.ctx.closePath();
        this.ctx.fill();
        break;

      case 'trojan':
        // Triangle
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x + size, y + size);
        this.ctx.lineTo(x - size, y + size);
        this.ctx.closePath();
        this.ctx.fill();
        break;

      case 'worm':
        // Segmented
        for (let i = 0; i < 3; i++) {
          this.ctx.beginPath();
          this.ctx.arc(x - i * size * 0.6, y, size * (1 - i * 0.2), 0, Math.PI * 2);
          this.ctx.fill();
        }
        break;

      case 'ransomware':
        // Lock shape
        this.ctx.fillRect(x - size / 2, y - size / 4, size, size * 0.75);
        this.ctx.strokeStyle = enemy.color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y - size / 4, size / 3, Math.PI, 0);
        this.ctx.stroke();
        break;

      case 'rootkit':
        // Ghost shape
        this.ctx.beginPath();
        this.ctx.arc(x, y - size / 3, size / 2, Math.PI, 0);
        this.ctx.lineTo(x + size / 2, y + size / 2);
        for (let i = 0; i < 4; i++) {
          const bx = x + size / 2 - (i + 1) * size / 4;
          const by = y + size / 2 + (i % 2 === 0 ? size / 4 : 0);
          this.ctx.lineTo(bx, by);
        }
        this.ctx.closePath();
        this.ctx.fill();
        break;

      case 'zeroday':
        // Star burst
        this.ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const radius = i % 2 === 0 ? size : size / 2;
          const px = x + Math.cos(angle) * radius;
          const py = y + Math.sin(angle) * radius;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        break;

      case 'apt':
        // Skull-like pentagon
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const px = x + Math.cos(angle) * size;
          const py = y + Math.sin(angle) * size;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // Eyes
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(x - size / 3, y - size / 4, size / 5, 0, Math.PI * 2);
        this.ctx.arc(x + size / 3, y - size / 4, size / 5, 0, Math.PI * 2);
        this.ctx.fill();
        break;

      case 'ddos':
        // Small circle with pulse
        const pulseSize = size * (1 + Math.sin(time * 10) * 0.2);
        this.ctx.beginPath();
        this.ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        this.ctx.fill();
        break;
    }

    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;

    // Health bar
    const hpWidth = size * 2;
    const hpHeight = 3;
    const hpPercent = enemy.health / enemy.maxHealth;

    this.ctx.fillStyle = '#330000';
    this.ctx.fillRect(x - hpWidth / 2, y - size - 8, hpWidth, hpHeight);

    this.ctx.fillStyle = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
    this.ctx.fillRect(x - hpWidth / 2, y - size - 8, hpWidth * hpPercent, hpHeight);
  }

  private renderProjectile(projectile: Projectile): void {
    this.ctx.fillStyle = projectile.color;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = projectile.color;

    this.ctx.beginPath();
    this.ctx.arc(projectile.position.x, projectile.position.y, projectile.size, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
  }

  private renderDataOrb(orb: DataOrb): void {
    const color = orb.isBeingCollected ? '#ffff00' : '#00ffff';

    this.ctx.fillStyle = color;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = color;

    this.ctx.beginPath();
    this.ctx.arc(orb.position.x, orb.position.y, orb.size, 0, Math.PI * 2);
    this.ctx.fill();

    // Data symbol
    this.ctx.fillStyle = '#000';
    this.ctx.font = `${orb.size}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('1', orb.position.x, orb.position.y);

    this.ctx.shadowBlur = 0;
  }

  private renderEncryptionShield(): void {
    const weapon = this.player.weapons.find(w => w.type === 'encryption');
    if (!weapon) return;

    const time = performance.now() / 1000;
    const radius = weapon.range;

    this.ctx.strokeStyle = '#ffff00';
    this.ctx.lineWidth = 2;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = '#ffff00';

    // Rotating shields
    for (let i = 0; i < weapon.projectileCount; i++) {
      const angle = (time * 2) + (i * (Math.PI * 2 / weapon.projectileCount));
      const sx = this.player.position.x + Math.cos(angle) * radius;
      const sy = this.player.position.y + Math.sin(angle) * radius;

      // Shield orb
      this.ctx.fillStyle = '#ffff0088';
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Key symbol
      this.ctx.fillStyle = '#000';
      this.ctx.font = '10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('🔐', sx, sy);
    }

    this.ctx.shadowBlur = 0;
  }

  private renderParticle(particle: Particle): void {
    const alpha = particle.life / particle.maxLife;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = particle.color;

    this.ctx.beginPath();
    this.ctx.arc(particle.position.x, particle.position.y, particle.size * alpha, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.globalAlpha = 1;
  }

  private renderDamageNumber(num: DamageNumber): void {
    const alpha = num.life / 500;
    this.ctx.globalAlpha = alpha;

    this.ctx.font = num.isCritical ? 'bold 18px monospace' : '14px monospace';
    this.ctx.fillStyle = num.color;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(Math.floor(num.value).toString(), num.position.x, num.position.y);

    this.ctx.globalAlpha = 1;
  }

  private renderScanlines(): void {
    this.ctx.fillStyle = `rgba(0, 0, 0, ${this.scanlineOpacity})`;

    for (let y = 0; y < this.CANVAS_HEIGHT; y += 2) {
      this.ctx.fillRect(0, y, this.CANVAS_WIDTH, 1);
    }
  }

  private renderGlitch(): void {
    const imgData = this.ctx.getImageData(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    for (let i = 0; i < 5; i++) {
      const y = Math.floor(Math.random() * this.CANVAS_HEIGHT);
      const height = Math.floor(Math.random() * 20) + 5;
      const shift = Math.floor((Math.random() - 0.5) * 20 * this.glitchIntensity);

      const sliceData = this.ctx.getImageData(0, y, this.CANVAS_WIDTH, height);
      this.ctx.putImageData(sliceData, shift, y);
    }
  }

  private renderHUD(): void {
    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = 'bold 14px "Courier New", monospace';
    this.ctx.textAlign = 'left';

    // Top left stats
    this.ctx.fillText(`LEVEL: ${this.player.level}`, 15, 25);
    this.ctx.fillText(`XP: ${Math.floor(this.player.xp)}/${this.player.xpToNextLevel}`, 15, 45);
    this.ctx.fillText(`SCORE: ${this.score}`, 15, 65);
    this.ctx.fillText(`KILLS: ${this.killCount}`, 15, 85);

    // Time remaining
    if (this.currentLevel) {
      const remaining = Math.max(0, this.currentLevel.durationMinutes * 60 - this.survivalTime);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      this.ctx.fillText(`TIME: ${mins}:${secs.toString().padStart(2, '0')}`, 15, 105);
    }

    // Weapons
    this.ctx.textAlign = 'right';
    let weaponY = 25;
    for (const weapon of this.player.weapons) {
      const config = WEAPON_CONFIGS[weapon.type];
      const text = weapon.evolved ? `${config.evolvedName}` : `${config.name} Lv${weapon.level}`;
      this.ctx.fillStyle = config.color;
      this.ctx.fillText(`${config.icon} ${text}`, this.CANVAS_WIDTH - 15, weaponY);
      weaponY += 20;
    }

    // Health bar
    const hpBarWidth = 250;
    const hpBarHeight = 20;
    const hpPercent = this.player.health / this.player.maxHealth;

    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(15, this.CANVAS_HEIGHT - 40, hpBarWidth, hpBarHeight);

    const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffaa00' : '#ff0000';
    this.ctx.fillStyle = hpColor;
    this.ctx.fillRect(15, this.CANVAS_HEIGHT - 40, hpBarWidth * hpPercent, hpBarHeight);

    this.ctx.strokeStyle = '#00ffff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(15, this.CANVAS_HEIGHT - 40, hpBarWidth, hpBarHeight);

    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.ceil(this.player.health)}/${this.player.maxHealth}`, 15 + hpBarWidth / 2, this.CANVAS_HEIGHT - 25);
  }

  // ============ GAME STATE ACTIONS ============
  selectLevel(level: DatacenterLevel): void {
    this.currentLevel = level;
    this.gameState.set(GameState.MENU);
    this.renderMenu();
  }

  // Called from WorldMapComponent when a level is selected
  onLevelSelectedFromMap(level: DatacenterLevel): void {
    this.currentLevel = level;
    this.startGame();
  }

  startGame(): void {
    // Reset game state
    this.player = this.createDefaultPlayer();

    // Give starter weapon
    const starterWeapon = WEAPON_CONFIGS['firewall'];
    this.player.weapons.push({
      type: 'firewall',
      level: 1,
      maxLevel: starterWeapon.maxLevel,
      damage: starterWeapon.baseDamage * (1 + this.player.permanentUpgrades.processing * 0.05),
      cooldown: starterWeapon.baseCooldown,
      lastFired: 0,
      range: starterWeapon.baseRange,
      projectileSpeed: starterWeapon.baseProjectileSpeed,
      projectileCount: starterWeapon.baseProjectileCount,
      piercing: starterWeapon.basePiercing,
      evolved: false,
      evolutionRequirement: starterWeapon.evolutionRequirement
    });

    this.enemies = [];
    this.projectiles = [];
    this.dataOrbs = [];
    this.particles = [];
    this.damageNumbers = [];
    this.score = 0;
    this.survivalTime = 0;
    this.killCount = 0;
    this.survivalTimer = 0;
    this.difficultyTimer = 0;
    this.difficultyMultiplier = 1;
    this.enemySpawnRate = 2000;
    this.maxEnemies = 50;

    this.gameState.set(GameState.PLAYING);
    this.lastTime = performance.now();
    this.lastEnemySpawnTime = 0;

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  pauseGame(): void {
    this.gameState.set(GameState.PAUSED);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  resumeGame(): void {
    this.gameState.set(GameState.PLAYING);
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  private victory(): void {
    this.gameState.set(GameState.VICTORY);

    // Add currency
    const earnings = this.score + this.killCount * 10 + this.player.level * 100;
    this.currency.update(c => c + earnings);
    this.saveCurrency(this.currency());

    // Mark level as cleared
    if (this.currentLevel && !this.gameStats.datacentersCleared.includes(this.currentLevel.id)) {
      this.gameStats.datacentersCleared.push(this.currentLevel.id);
      this.gameStats.wins++;
    }

    this.saveLeaderboardEntry();
    this.saveGameStats();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  gameOver(): void {
    this.gameState.set(GameState.GAME_OVER);

    // Add partial currency
    const earnings = Math.floor((this.score + this.killCount * 5) * 0.5);
    this.currency.update(c => c + earnings);
    this.saveCurrency(this.currency());

    this.saveLeaderboardEntry();
    this.saveGameStats();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  returnToMapSelect(): void {
    this.gameState.set(GameState.MAP_SELECT);
    this.currentLevel = null;
    this.renderMapSelect();
  }

  exitToLanding(): void {
    this.router.navigate(['/']);
  }

  // ============ RENDERING SCREENS ============
  private renderMapSelect(): void {
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
    this.renderMatrixRain();

    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = 'bold 36px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('CYBER DEFENSE', this.CANVAS_WIDTH / 2, 60);

    this.ctx.font = '16px "Courier New", monospace';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillText('Select a datacenter to defend', this.CANVAS_WIDTH / 2, 90);
  }

  private renderMenu(): void {
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = 'bold 32px "Courier New", monospace';
    this.ctx.textAlign = 'center';

    if (this.currentLevel) {
      this.ctx.fillText(this.currentLevel.name, this.CANVAS_WIDTH / 2, 150);
      this.ctx.font = '18px "Courier New", monospace';
      this.ctx.fillStyle = getDifficultyColor(this.currentLevel.difficulty);
      this.ctx.fillText(`${this.currentLevel.company} - ${this.currentLevel.difficulty.toUpperCase()}`, this.CANVAS_WIDTH / 2, 190);
      this.ctx.fillStyle = '#888';
      this.ctx.fillText(this.currentLevel.description, this.CANVAS_WIDTH / 2, 230);
      this.ctx.fillText(`Duration: ${this.currentLevel.durationMinutes} minutes`, this.CANVAS_WIDTH / 2, 270);
    }
  }

  // ============ UTILITY ============
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private getDistance(a: Vector2D, b: Vector2D): number {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }

  private normalize(v: Vector2D): Vector2D {
    const length = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: v.x / length, y: v.y / length };
  }

  private circleCollision(pos1: Vector2D, size1: number, pos2: Vector2D, size2: number): boolean {
    return this.getDistance(pos1, pos2) < size1 + size2;
  }

  private findNearestEnemy(): Enemy | null {
    if (this.enemies.length === 0) return null;

    let nearest = this.enemies[0];
    let minDistance = this.getDistance(this.player.position, nearest.position);

    for (const enemy of this.enemies) {
      const distance = this.getDistance(this.player.position, enemy.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private createParticles(pos: Vector2D, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        position: { ...pos },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 500 + Math.random() * 500,
        maxLife: 1000,
        size: 2 + Math.random() * 3,
        color,
        type: 'explosion'
      });
    }
  }

  private createDamageNumber(pos: Vector2D, value: number, isCritical = false): void {
    this.damageNumbers.push({
      position: { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 10 },
      value,
      life: 500,
      color: isCritical ? '#ff0000' : '#ffffff',
      isCritical
    });
  }

  private initMatrixRain(): void {
    for (let x = 0; x < this.CANVAS_WIDTH; x += 20) {
      this.matrixRain.push({
        x,
        y: Math.random() * this.CANVAS_HEIGHT,
        speed: 1 + Math.random() * 2,
        char: this.getRandomMatrixChar()
      });
    }
  }

  private getRandomMatrixChar(): string {
    const chars = '01アイウエオカキクケコサシスセソ';
    return chars[Math.floor(Math.random() * chars.length)];
  }

  // ============ PERSISTENCE ============
  private loadPermanentUpgrades(): PermanentUpgrades {
    const saved = localStorage.getItem('cyber-defense-upgrades');
    return saved ? JSON.parse(saved) : {
      maxHealth: 0,
      bandwidth: 0,
      processing: 0,
      storage: 0,
      firewall: 0
    };
  }

  private savePermanentUpgrades(): void {
    localStorage.setItem('cyber-defense-upgrades', JSON.stringify(this.permanentUpgrades));
  }

  private loadGameStats(): GameStats {
    const saved = localStorage.getItem('cyber-defense-stats');
    return saved ? JSON.parse(saved) : {
      totalPlayTime: 0,
      totalKills: 0,
      totalXP: 0,
      highestLevel: 0,
      gamesPlayed: 0,
      wins: 0,
      datacentersCleared: []
    };
  }

  private saveGameStats(): void {
    this.gameStats.totalPlayTime += this.survivalTime;
    this.gameStats.totalKills += this.killCount;
    this.gameStats.totalXP += this.player.xp;
    this.gameStats.highestLevel = Math.max(this.gameStats.highestLevel, this.player.level);
    this.gameStats.gamesPlayed++;
    localStorage.setItem('cyber-defense-stats', JSON.stringify(this.gameStats));
  }

  private loadLeaderboard(): LeaderboardEntry[] {
    const saved = localStorage.getItem('cyber-defense-leaderboard');
    return saved ? JSON.parse(saved) : [];
  }

  private saveLeaderboardEntry(): void {
    const entry: LeaderboardEntry = {
      name: 'Player',
      score: this.score,
      level: this.player.level,
      datacenter: this.currentLevel?.name || 'Unknown',
      time: this.survivalTime,
      kills: this.killCount,
      timestamp: Date.now()
    };

    this.leaderboard.push(entry);
    this.leaderboard.sort((a, b) => b.score - a.score);
    this.leaderboard = this.leaderboard.slice(0, 100);
    localStorage.setItem('cyber-defense-leaderboard', JSON.stringify(this.leaderboard));
  }

  private loadCurrency(): number {
    const saved = localStorage.getItem('cyber-defense-currency');
    return saved ? parseInt(saved, 10) : 0;
  }

  private saveCurrency(amount: number): void {
    localStorage.setItem('cyber-defense-currency', amount.toString());
  }

  // ============ META PROGRESSION ============
  purchaseUpgrade(type: keyof PermanentUpgrades): void {
    const costs: Record<keyof PermanentUpgrades, number[]> = {
      maxHealth: [100, 200, 400, 800, 1600],
      bandwidth: [150, 300, 600, 1200, 2400],
      processing: [200, 400, 800, 1600, 3200],
      storage: [100, 200, 400, 800, 1600],
      firewall: [150, 300, 600, 1200, 2400]
    };

    const level = this.permanentUpgrades[type];
    if (level >= 5) return;

    const cost = costs[type][level];
    if (this.currency() >= cost) {
      this.currency.update(c => c - cost);
      this.permanentUpgrades[type]++;
      this.saveCurrency(this.currency());
      this.savePermanentUpgrades();
    }
  }
}
