import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// ============ INTERFACES ============
interface Vector2D {
  x: number;
  y: number;
}

interface GameObject {
  position: Vector2D;
  velocity: Vector2D;
  size: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
}

interface Player extends GameObject {
  level: number;
  xp: number;
  xpToNextLevel: number;
  moveSpeed: number;
  attackDamage: number;
  attackSpeed: number;
  attackRange: number;
  pickupRadius: number;
}

interface Enemy extends GameObject {
  damage: number;
  xpValue: number;
  color: string;
  type: 'basic' | 'fast' | 'tank' | 'boss';
}

interface Projectile {
  position: Vector2D;
  velocity: Vector2D;
  damage: number;
  size: number;
  lifetime: number;
  color: string;
}

interface XPOrb {
  position: Vector2D;
  velocity: Vector2D;
  value: number;
  size: number;
  isBeingCollected: boolean;
}

interface Upgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (player: Player) => void;
}

enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  LEVEL_UP,
  GAME_OVER
}

@Component({
  selector: 'app-vampire-survivors-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vampire-survivors-game.component.html',
  styleUrl: './vampire-survivors-game.component.scss'
})
export class VampireSurvivorsGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private animationFrameId?: number;

  // Game State
  gameState: GameState = GameState.MENU;
  GameState = GameState; // Expose enum to template

  // Player
  player: Player = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    size: 20,
    health: 100,
    maxHealth: 100,
    isDead: false,
    level: 1,
    xp: 0,
    xpToNextLevel: 10,
    moveSpeed: 3,
    attackDamage: 10,
    attackSpeed: 1,
    attackRange: 200,
    pickupRadius: 50
  };

  // Input
  private keys: { [key: string]: boolean } = {};

  // Game Objects
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];

  // Game Stats
  score = 0;
  highScore = 0;
  survivalTime = 0;
  killCount = 0;

  // Timers
  private lastTime = 0;
  private lastAttackTime = 0;
  private lastEnemySpawnTime = 0;
  private survivalTimer = 0;
  private difficultyTimer = 0;

  // Difficulty Scaling
  private enemySpawnRate = 2000; // ms
  private maxEnemies = 50;
  private difficultyMultiplier = 1;

  // Level Up
  availableUpgrades: Upgrade[] = [];

  // Canvas size
  private readonly CANVAS_WIDTH = 1200;
  private readonly CANVAS_HEIGHT = 800;

  constructor(private router: Router) {
    // Load high score from localStorage
    const saved = localStorage.getItem('vampire-survivors-highscore');
    if (saved) {
      this.highScore = parseInt(saved, 10);
    }
  }

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;

    // Set canvas size
    canvas.width = this.CANVAS_WIDTH;
    canvas.height = this.CANVAS_HEIGHT;

    // Initial render
    this.renderMenu();
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

    // Escape to pause
    if (event.key === 'Escape' && this.gameState === GameState.PLAYING) {
      this.pauseGame();
    } else if (event.key === 'Escape' && this.gameState === GameState.PAUSED) {
      this.resumeGame();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keys[event.key.toLowerCase()] = false;
  }

  // ============ GAME LOOP ============
  private gameLoop = (currentTime: number): void => {
    if (this.gameState !== GameState.PLAYING) {
      return;
    }

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Update
    this.update(deltaTime);

    // Render
    this.render();

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  // ============ UPDATE ============
  private update(deltaTime: number): void {
    // Update survival time
    this.survivalTimer += deltaTime;
    this.survivalTime = Math.floor(this.survivalTimer / 1000);

    // Update difficulty every 30 seconds
    this.difficultyTimer += deltaTime;
    if (this.difficultyTimer >= 30000) {
      this.increaseDifficulty();
      this.difficultyTimer = 0;
    }

    // Update player
    this.updatePlayer(deltaTime);

    // Auto attack
    this.updateAutoAttack(deltaTime);

    // Spawn enemies
    this.updateEnemySpawning(deltaTime);

    // Update enemies
    this.updateEnemies(deltaTime);

    // Update projectiles
    this.updateProjectiles(deltaTime);

    // Update XP orbs
    this.updateXPOrbs(deltaTime);

    // Check collisions
    this.checkCollisions();

    // Clean up dead objects
    this.cleanupDeadObjects();

    // Check game over
    if (this.player.health <= 0 && !this.player.isDead) {
      this.player.isDead = true;
      this.gameOver();
    }
  }

  private updatePlayer(deltaTime: number): void {
    // Movement input
    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    // Apply movement
    this.player.position.x += dx * this.player.moveSpeed;
    this.player.position.y += dy * this.player.moveSpeed;

    // Keep player in bounds
    this.player.position.x = Math.max(this.player.size, Math.min(this.CANVAS_WIDTH - this.player.size, this.player.position.x));
    this.player.position.y = Math.max(this.player.size, Math.min(this.CANVAS_HEIGHT - this.player.size, this.player.position.y));
  }

  private updateAutoAttack(deltaTime: number): void {
    const currentTime = performance.now();
    const attackCooldown = 1000 / this.player.attackSpeed; // attacks per second

    if (currentTime - this.lastAttackTime >= attackCooldown) {
      // Find nearest enemy
      const nearestEnemy = this.findNearestEnemy();

      if (nearestEnemy) {
        const distance = this.getDistance(this.player.position, nearestEnemy.position);

        if (distance <= this.player.attackRange) {
          this.shootProjectile(nearestEnemy);
          this.lastAttackTime = currentTime;
        }
      }
    }
  }

  private shootProjectile(target: Enemy): void {
    const direction = this.normalize({
      x: target.position.x - this.player.position.x,
      y: target.position.y - this.player.position.y
    });

    this.projectiles.push({
      position: { ...this.player.position },
      velocity: {
        x: direction.x * 8,
        y: direction.y * 8
      },
      damage: this.player.attackDamage,
      size: 5,
      lifetime: 2000,
      color: '#00ff00'
    });
  }

  private updateEnemySpawning(deltaTime: number): void {
    const currentTime = performance.now();
    if (currentTime - this.lastEnemySpawnTime >= this.enemySpawnRate && this.enemies.length < this.maxEnemies) {
      this.spawnEnemy();
      this.lastEnemySpawnTime = currentTime;
    }
  }

  private spawnEnemy(): void {
    const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let x = 0, y = 0;

    switch (side) {
      case 0: // top
        x = Math.random() * this.CANVAS_WIDTH;
        y = -20;
        break;
      case 1: // right
        x = this.CANVAS_WIDTH + 20;
        y = Math.random() * this.CANVAS_HEIGHT;
        break;
      case 2: // bottom
        x = Math.random() * this.CANVAS_WIDTH;
        y = this.CANVAS_HEIGHT + 20;
        break;
      case 3: // left
        x = -20;
        y = Math.random() * this.CANVAS_HEIGHT;
        break;
    }

    // Random enemy type based on difficulty
    const rand = Math.random();
    let enemyType: 'basic' | 'fast' | 'tank' | 'boss' = 'basic';

    if (this.difficultyMultiplier > 3 && rand < 0.05) {
      enemyType = 'boss';
    } else if (rand < 0.2) {
      enemyType = 'fast';
    } else if (rand < 0.4) {
      enemyType = 'tank';
    }

    const enemy = this.createEnemy(x, y, enemyType);
    this.enemies.push(enemy);
  }

  private createEnemy(x: number, y: number, type: 'basic' | 'fast' | 'tank' | 'boss'): Enemy {
    const baseStats = {
      basic: { health: 30, damage: 10, xp: 5, speed: 1.5, size: 15, color: '#ff0000' },
      fast: { health: 20, damage: 8, xp: 8, speed: 3, size: 12, color: '#ff6600' },
      tank: { health: 80, damage: 15, xp: 15, speed: 0.8, size: 25, color: '#990000' },
      boss: { health: 300, damage: 25, xp: 100, speed: 1, size: 40, color: '#ff00ff' }
    };

    const stats = baseStats[type];

    return {
      position: { x, y },
      velocity: { x: 0, y: 0 },
      size: stats.size * Math.sqrt(this.difficultyMultiplier),
      health: stats.health * this.difficultyMultiplier,
      maxHealth: stats.health * this.difficultyMultiplier,
      isDead: false,
      damage: stats.damage * this.difficultyMultiplier,
      xpValue: stats.xp * this.difficultyMultiplier,
      color: stats.color,
      type
    };
  }

  private updateEnemies(deltaTime: number): void {
    for (const enemy of this.enemies) {
      // Move towards player
      const direction = this.normalize({
        x: this.player.position.x - enemy.position.x,
        y: this.player.position.y - enemy.position.y
      });

      const speed = enemy.type === 'basic' ? 1.5 :
                    enemy.type === 'fast' ? 3 :
                    enemy.type === 'tank' ? 0.8 : 1;

      enemy.position.x += direction.x * speed * Math.sqrt(this.difficultyMultiplier);
      enemy.position.y += direction.y * speed * Math.sqrt(this.difficultyMultiplier);
    }
  }

  private updateProjectiles(deltaTime: number): void {
    for (const projectile of this.projectiles) {
      projectile.position.x += projectile.velocity.x;
      projectile.position.y += projectile.velocity.y;
      projectile.lifetime -= deltaTime;
    }
  }

  private updateXPOrbs(deltaTime: number): void {
    for (const orb of this.xpOrbs) {
      // Check if in pickup radius
      const distance = this.getDistance(this.player.position, orb.position);

      if (distance <= this.player.pickupRadius) {
        orb.isBeingCollected = true;

        // Move towards player
        const direction = this.normalize({
          x: this.player.position.x - orb.position.x,
          y: this.player.position.y - orb.position.y
        });

        orb.position.x += direction.x * 10;
        orb.position.y += direction.y * 10;

        // Collect if close enough
        if (distance <= this.player.size + orb.size) {
          this.collectXP(orb.value);
          orb.value = 0; // Mark for removal
        }
      }
    }
  }

  private checkCollisions(): void {
    // Projectile vs Enemy
    for (const projectile of this.projectiles) {
      for (const enemy of this.enemies) {
        if (this.circleCollision(projectile.position, projectile.size, enemy.position, enemy.size)) {
          enemy.health -= projectile.damage;
          projectile.lifetime = 0; // Mark for removal

          if (enemy.health <= 0 && !enemy.isDead) {
            enemy.isDead = true;
            this.onEnemyKilled(enemy);
          }
        }
      }
    }

    // Enemy vs Player
    for (const enemy of this.enemies) {
      if (this.circleCollision(enemy.position, enemy.size, this.player.position, this.player.size)) {
        this.player.health -= enemy.damage * 0.016; // Damage per frame (60fps)
        this.player.health = Math.max(0, this.player.health);
      }
    }
  }

  private onEnemyKilled(enemy: Enemy): void {
    this.killCount++;
    this.score += Math.floor(enemy.xpValue * 10);

    // Drop XP orb
    this.xpOrbs.push({
      position: { ...enemy.position },
      velocity: { x: 0, y: 0 },
      value: enemy.xpValue,
      size: 8,
      isBeingCollected: false
    });
  }

  private collectXP(amount: number): void {
    this.player.xp += amount;

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

    // Show upgrade options
    this.gameState = GameState.LEVEL_UP;
    this.generateUpgradeOptions();
  }

  private generateUpgradeOptions(): void {
    const allUpgrades: Upgrade[] = [
      {
        id: 'max-health',
        name: '+20 Max Health',
        description: 'Increase maximum health',
        icon: '❤️',
        apply: (player: Player) => {
          player.maxHealth += 20;
          player.health += 20;
        }
      },
      {
        id: 'move-speed',
        name: '+10% Move Speed',
        description: 'Move faster',
        icon: '⚡',
        apply: (player: Player) => {
          player.moveSpeed *= 1.1;
        }
      },
      {
        id: 'attack-damage',
        name: '+20% Damage',
        description: 'Deal more damage',
        icon: '⚔️',
        apply: (player: Player) => {
          player.attackDamage *= 1.2;
        }
      },
      {
        id: 'attack-speed',
        name: '+15% Attack Speed',
        description: 'Attack faster',
        icon: '🔥',
        apply: (player: Player) => {
          player.attackSpeed *= 1.15;
        }
      },
      {
        id: 'attack-range',
        name: '+20% Range',
        description: 'Increase attack range',
        icon: '🎯',
        apply: (player: Player) => {
          player.attackRange *= 1.2;
        }
      },
      {
        id: 'pickup-radius',
        name: '+30% Pickup Radius',
        description: 'Collect XP from farther away',
        icon: '🧲',
        apply: (player: Player) => {
          player.pickupRadius *= 1.3;
        }
      }
    ];

    // Randomly select 3 upgrades
    const shuffled = allUpgrades.sort(() => Math.random() - 0.5);
    this.availableUpgrades = shuffled.slice(0, 3);
  }

  selectUpgrade(upgrade: Upgrade): void {
    upgrade.apply(this.player);
    this.gameState = GameState.PLAYING;
    this.availableUpgrades = [];

    // Resume game loop
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  private increaseDifficulty(): void {
    this.difficultyMultiplier += 0.3;
    this.enemySpawnRate = Math.max(500, this.enemySpawnRate * 0.9);
    this.maxEnemies = Math.min(200, this.maxEnemies + 10);
  }

  private cleanupDeadObjects(): void {
    this.enemies = this.enemies.filter(e => !e.isDead);
    this.projectiles = this.projectiles.filter(p => p.lifetime > 0);
    this.xpOrbs = this.xpOrbs.filter(o => o.value > 0);
  }

  // ============ RENDER ============
  private render(): void {
    // Clear canvas
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw grid
    this.drawGrid();

    // Draw XP orbs
    for (const orb of this.xpOrbs) {
      this.drawXPOrb(orb);
    }

    // Draw enemies
    for (const enemy of this.enemies) {
      this.drawEnemy(enemy);
    }

    // Draw projectiles
    for (const projectile of this.projectiles) {
      this.drawProjectile(projectile);
    }

    // Draw player
    this.drawPlayer();

    // Draw HUD
    this.drawHUD();
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < this.CANVAS_WIDTH; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.CANVAS_HEIGHT);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < this.CANVAS_HEIGHT; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.CANVAS_WIDTH, y);
      this.ctx.stroke();
    }
  }

  private drawPlayer(): void {
    // Player body (square)
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillRect(
      this.player.position.x - this.player.size / 2,
      this.player.position.y - this.player.size / 2,
      this.player.size,
      this.player.size
    );

    // Glow effect
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = '#00ff00';
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillRect(
      this.player.position.x - this.player.size / 2,
      this.player.position.y - this.player.size / 2,
      this.player.size,
      this.player.size
    );
    this.ctx.shadowBlur = 0;

    // Attack range indicator (subtle)
    this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(this.player.position.x, this.player.position.y, this.player.attackRange, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private drawEnemy(enemy: Enemy): void {
    // Enemy body (shape based on type)
    this.ctx.fillStyle = enemy.color;

    if (enemy.type === 'basic' || enemy.type === 'tank') {
      // Square for basic/tank
      this.ctx.fillRect(
        enemy.position.x - enemy.size / 2,
        enemy.position.y - enemy.size / 2,
        enemy.size,
        enemy.size
      );
    } else if (enemy.type === 'fast') {
      // Triangle for fast
      this.ctx.beginPath();
      this.ctx.moveTo(enemy.position.x, enemy.position.y - enemy.size);
      this.ctx.lineTo(enemy.position.x + enemy.size, enemy.position.y + enemy.size);
      this.ctx.lineTo(enemy.position.x - enemy.size, enemy.position.y + enemy.size);
      this.ctx.closePath();
      this.ctx.fill();
    } else if (enemy.type === 'boss') {
      // Pentagon for boss
      this.drawPolygon(enemy.position.x, enemy.position.y, enemy.size, 5);
      this.ctx.fill();
    }

    // Health bar
    const healthBarWidth = enemy.size * 2;
    const healthBarHeight = 4;
    const healthPercentage = enemy.health / enemy.maxHealth;

    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(
      enemy.position.x - healthBarWidth / 2,
      enemy.position.y - enemy.size - 10,
      healthBarWidth,
      healthBarHeight
    );

    // Health
    this.ctx.fillStyle = '#00ff00';
    this.ctx.fillRect(
      enemy.position.x - healthBarWidth / 2,
      enemy.position.y - enemy.size - 10,
      healthBarWidth * healthPercentage,
      healthBarHeight
    );
  }

  private drawProjectile(projectile: Projectile): void {
    this.ctx.fillStyle = projectile.color;
    this.ctx.beginPath();
    this.ctx.arc(projectile.position.x, projectile.position.y, projectile.size, 0, Math.PI * 2);
    this.ctx.fill();

    // Glow
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = projectile.color;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  private drawXPOrb(orb: XPOrb): void {
    this.ctx.fillStyle = orb.isBeingCollected ? '#ffff00' : '#00ffff';
    this.ctx.beginPath();
    this.ctx.arc(orb.position.x, orb.position.y, orb.size, 0, Math.PI * 2);
    this.ctx.fill();

    // Glow
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = orb.isBeingCollected ? '#ffff00' : '#00ffff';
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  private drawHUD(): void {
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 16px "Courier New", monospace';
    this.ctx.textAlign = 'left';

    // Top left stats
    this.ctx.fillText(`Level: ${this.player.level}`, 10, 25);
    this.ctx.fillText(`XP: ${Math.floor(this.player.xp)}/${this.player.xpToNextLevel}`, 10, 45);
    this.ctx.fillText(`Score: ${this.score}`, 10, 65);
    this.ctx.fillText(`Kills: ${this.killCount}`, 10, 85);
    this.ctx.fillText(`Time: ${this.survivalTime}s`, 10, 105);

    // Health bar
    const hpBarWidth = 200;
    const hpBarHeight = 20;
    const hpPercentage = this.player.health / this.player.maxHealth;

    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(10, this.CANVAS_HEIGHT - 40, hpBarWidth, hpBarHeight);

    // Health
    this.ctx.fillStyle = hpPercentage > 0.5 ? '#00ff00' : hpPercentage > 0.25 ? '#ffaa00' : '#ff0000';
    this.ctx.fillRect(10, this.CANVAS_HEIGHT - 40, hpBarWidth * hpPercentage, hpBarHeight);

    // Health text
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.ceil(this.player.health)}/${this.player.maxHealth}`, 10 + hpBarWidth / 2, this.CANVAS_HEIGHT - 23);
  }

  private renderMenu(): void {
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 48px "Courier New", monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('VAMPIRE SURVIVORS', this.CANVAS_WIDTH / 2, 200);

    this.ctx.font = '24px "Courier New", monospace';
    this.ctx.fillText('Press SPACE to Start', this.CANVAS_WIDTH / 2, 300);
    this.ctx.fillText('WASD or Arrow Keys to Move', this.CANVAS_WIDTH / 2, 350);
    this.ctx.fillText('Auto-attack nearest enemy', this.CANVAS_WIDTH / 2, 390);
    this.ctx.fillText('ESC to Pause', this.CANVAS_WIDTH / 2, 430);

    if (this.highScore > 0) {
      this.ctx.fillText(`High Score: ${this.highScore}`, this.CANVAS_WIDTH / 2, 500);
    }

    this.ctx.fillStyle = '#666';
    this.ctx.font = '16px "Courier New", monospace';
    this.ctx.fillText('Press ESC to return to Landing Page', this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT - 50);
  }

  // ============ UTILITY ============
  private getDistance(a: Vector2D, b: Vector2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private normalize(v: Vector2D): Vector2D {
    const length = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: v.x / length, y: v.y / length };
  }

  private circleCollision(pos1: Vector2D, size1: number, pos2: Vector2D, size2: number): boolean {
    const distance = this.getDistance(pos1, pos2);
    return distance < size1 + size2;
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

  private drawPolygon(x: number, y: number, radius: number, sides: number): void {
    this.ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
  }

  // ============ GAME STATE ACTIONS ============
  startGame(): void {
    // Reset game state
    this.player = {
      position: { x: this.CANVAS_WIDTH / 2, y: this.CANVAS_HEIGHT / 2 },
      velocity: { x: 0, y: 0 },
      size: 20,
      health: 100,
      maxHealth: 100,
      isDead: false,
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      moveSpeed: 3,
      attackDamage: 10,
      attackSpeed: 1,
      attackRange: 200,
      pickupRadius: 50
    };

    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.score = 0;
    this.survivalTime = 0;
    this.killCount = 0;
    this.survivalTimer = 0;
    this.difficultyTimer = 0;
    this.difficultyMultiplier = 1;
    this.enemySpawnRate = 2000;
    this.maxEnemies = 50;

    this.gameState = GameState.PLAYING;
    this.lastTime = performance.now();
    this.lastAttackTime = 0;
    this.lastEnemySpawnTime = 0;

    // Start game loop
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  pauseGame(): void {
    this.gameState = GameState.PAUSED;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  resumeGame(): void {
    this.gameState = GameState.PLAYING;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  gameOver(): void {
    this.gameState = GameState.GAME_OVER;

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('vampire-survivors-highscore', this.score.toString());
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  returnToMenu(): void {
    this.gameState = GameState.MENU;
    this.renderMenu();
  }

  exitToLanding(): void {
    this.router.navigate(['/']);
  }
}
