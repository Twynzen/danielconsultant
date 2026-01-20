import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  signal
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
  private cdr = inject(ChangeDetectorRef);
  readonly modelService = inject(ModelResearchService);

  // Local UI state
  readonly showFilters = signal(false);
  readonly showDemo = signal(false);
  readonly demoInput = signal('');
  readonly activeTab = signal<'grid' | 'list'>('grid');
  readonly selectedFile = signal<File | null>(null);
  readonly filePreview = signal<string | null>(null);
  readonly isProcessing = signal(false);
  readonly copiedCode = signal(false);

  // Category and framework options
  readonly categories = Object.entries(MODEL_CATEGORIES) as [ModelCategory, { label: string; icon: string; color: string }][];
  readonly frameworks = Object.entries(FRAMEWORKS) as [ModelFramework, { label: string; description: string; url: string }][];

  // Search input binding
  searchQuery = '';

  // Particles for background
  readonly particles = signal<Array<{ id: number; x: number; y: number; size: number; speed: number; opacity: number }>>([]);

  private animationFrame: number | null = null;

  ngOnInit(): void {
    this.initParticles();
    this.startParticleAnimation();
  }

  ngOnDestroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    // Clear file preview URL
    const preview = this.filePreview();
    if (preview) {
      URL.revokeObjectURL(preview);
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
    if (model.status === 'broken') {
      alert(`MODELO NO DISPONIBLE\n\nRazón: ${model.errorMessage || 'Error desconocido'}`);
      return;
    }
    this.modelService.selectModel(model);
    this.showDemo.set(true);
    this.demoInput.set('');
    this.selectedFile.set(null);
    this.filePreview.set(null);
  }

  closeDemo(): void {
    this.showDemo.set(false);
    this.modelService.selectModel(null);
    this.selectedFile.set(null);
    const preview = this.filePreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.filePreview.set(null);
  }

  // File handling
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedFile.set(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const preview = this.filePreview();
        if (preview) {
          URL.revokeObjectURL(preview);
        }
        this.filePreview.set(URL.createObjectURL(file));
      } else {
        this.filePreview.set(null);
      }
      this.cdr.markForCheck();
    }
  }

  clearFile(): void {
    this.selectedFile.set(null);
    const preview = this.filePreview();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    this.filePreview.set(null);
  }

  async loadAndRunDemo(): Promise<void> {
    const model = this.modelService.selectedModel();
    if (!model) return;

    this.isProcessing.set(true);
    this.cdr.markForCheck();

    try {
      await this.modelService.loadModel(model);
      // Auto-run if we have input
      const input = this.demoInput();
      const file = this.selectedFile();
      if (input || file) {
        await this.modelService.runDemo(input, file || undefined);
      }
    } catch (error) {
      console.error('Error running demo:', error);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async runDemo(): Promise<void> {
    const input = this.demoInput();
    const file = this.selectedFile();

    if (!input && !file) return;

    this.isProcessing.set(true);
    this.cdr.markForCheck();

    try {
      await this.modelService.runDemo(input, file || undefined);
    } catch (error) {
      console.error('Error running demo:', error);
    } finally {
      this.isProcessing.set(false);
      this.cdr.markForCheck();
    }
  }

  async clearCache(): Promise<void> {
    await this.modelService.clearModelCache();
    this.cdr.markForCheck();
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
      this.copiedCode.set(true);
      setTimeout(() => this.copiedCode.set(false), 2000);
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

  // Check if model needs file input
  needsFileInput(): boolean {
    const model = this.modelService.selectedModel();
    if (!model) return false;
    return ['image', 'audio', 'multimodal'].includes(model.demoType);
  }

  // Get file input accept type
  getFileAccept(): string {
    const model = this.modelService.selectedModel();
    if (!model) return '*/*';
    switch (model.demoType) {
      case 'image':
      case 'multimodal':
        return 'image/*';
      case 'audio':
        return 'audio/*';
      default:
        return '*/*';
    }
  }
}
