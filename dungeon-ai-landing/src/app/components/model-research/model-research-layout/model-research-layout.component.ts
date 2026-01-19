import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModelResearchService } from '../../../services/model-research.service';
import {
  ModelConfig,
  ModelCategory,
  ModelFramework,
  MODEL_CATEGORIES,
  FRAMEWORKS
} from '../../../config/model-research.config';

@Component({
  selector: 'app-model-research-layout',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './model-research-layout.component.html',
  styleUrls: ['./model-research-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModelResearchLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  readonly modelService = inject(ModelResearchService);

  // Local UI state
  readonly showFilters = signal(false);
  readonly showDemo = signal(false);
  readonly demoInput = signal('');
  readonly activeTab = signal<'grid' | 'list'>('grid');

  // Category and framework options
  readonly categories = Object.entries(MODEL_CATEGORIES) as [ModelCategory, { label: string; icon: string; color: string }][];
  readonly frameworks = Object.entries(FRAMEWORKS) as [ModelFramework, { label: string; description: string; url: string }][];

  // Search input binding
  searchQuery = '';

  // Particles for background
  readonly particles = signal<Array<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }>>([]);

  private animationFrame: number | null = null;
  private particleInterval: number | null = null;

  ngOnInit(): void {
    this.initParticles();
    this.startParticleAnimation();
  }

  ngOnDestroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.particleInterval) {
      clearInterval(this.particleInterval);
    }
  }

  private initParticles(): void {
    const initialParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.1,
      opacity: Math.random() * 0.5 + 0.2
    }));
    this.particles.set(initialParticles);
  }

  private startParticleAnimation(): void {
    const animate = () => {
      this.particles.update(particles =>
        particles.map(p => ({
          ...p,
          y: p.y - p.speed,
          ...(p.y < -5 ? { y: 105, x: Math.random() * 100 } : {})
        }))
      );
      this.animationFrame = requestAnimationFrame(animate);
    };
    this.animationFrame = requestAnimationFrame(animate);
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/']);
  }

  // Filter methods
  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  setCategory(category: ModelCategory | 'all'): void {
    this.modelService.setFilter({ category });
  }

  setFramework(framework: ModelFramework | 'all'): void {
    this.modelService.setFilter({ framework });
  }

  onSearchChange(): void {
    this.modelService.setFilter({ search: this.searchQuery });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.modelService.resetFilter();
  }

  // Model selection and demo
  selectModel(model: ModelConfig): void {
    this.modelService.selectModel(model);
    this.showDemo.set(true);
    this.demoInput.set('');
  }

  closeDemo(): void {
    this.showDemo.set(false);
    this.modelService.selectModel(null);
  }

  async loadAndRunDemo(): Promise<void> {
    const model = this.modelService.selectedModel();
    if (!model) return;

    try {
      await this.modelService.loadModel(model);
      if (this.demoInput()) {
        await this.modelService.runDemo(this.demoInput());
      }
    } catch (error) {
      console.error('Error running demo:', error);
    }
  }

  async runDemo(): Promise<void> {
    if (!this.demoInput()) return;

    try {
      await this.modelService.runDemo(this.demoInput());
    } catch (error) {
      console.error('Error running demo:', error);
    }
  }

  async clearCache(): Promise<void> {
    await this.modelService.clearModelCache();
  }

  // View toggle
  setView(view: 'grid' | 'list'): void {
    this.activeTab.set(view);
  }

  // Get innovation stars
  getStars(score: number): string {
    return '★'.repeat(score) + '☆'.repeat(5 - score);
  }

  // Get category color
  getCategoryColor(category: ModelCategory): string {
    return MODEL_CATEGORIES[category]?.color || '#00ff44';
  }

  // Get category icon
  getCategoryIcon(category: ModelCategory): string {
    return MODEL_CATEGORIES[category]?.icon || '🤖';
  }

  // Copy code to clipboard
  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  // Open external URL
  openDocs(url: string | undefined): void {
    if (url) {
      window.open(url, '_blank');
    }
  }
}
