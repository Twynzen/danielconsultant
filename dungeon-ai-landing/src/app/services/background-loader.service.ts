/**
 * BackgroundLoaderService - Coordinated Background Model Downloads
 * v1.0: Manages LLM and Embeddings downloads during onboarding
 *
 * KEY INSIGHT: During onboarding, Sendell shows ~10 pre-written dialogs
 * taking ~25-30 seconds. NO AI is needed during this time.
 * We use this window to download models in the background.
 *
 * DOWNLOAD ORDER:
 * 1. Embeddings (~23MB) - Fast, needed for semantic search
 * 2. LLM (~700MB) - Large, needed only for chat after onboarding
 *
 * USER EXPERIENCE:
 * - Loading screen completes INSTANTLY (no waiting for downloads)
 * - Models download while user watches onboarding dialogs
 * - If user tries to chat before ready, friendly "loading" message
 */

import { Injectable, signal, computed, inject, NgZone } from '@angular/core';
import { LLMService } from './llm.service';
import { SemanticSearchService } from './semantic-search.service';

export interface DownloadProgress {
  isDownloading: boolean;
  currentFile: 'embeddings' | 'llm' | 'complete' | 'none';
  fileProgress: number;     // 0-100 for current file
  totalProgress: number;    // 0-100 overall (embeddings = 0-20%, LLM = 20-100%)
  estimatedTimeRemaining: string | null;
  error: string | null;
}

export type BackgroundLoaderStatus = 'idle' | 'downloading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root'
})
export class BackgroundLoaderService {
  private llmService = inject(LLMService);
  private semanticSearch = inject(SemanticSearchService);
  private ngZone = inject(NgZone);

  // Internal state
  private _status = signal<BackgroundLoaderStatus>('idle');
  private _progress = signal<DownloadProgress>({
    isDownloading: false,
    currentFile: 'none',
    fileProgress: 0,
    totalProgress: 0,
    estimatedTimeRemaining: null,
    error: null
  });
  private _downloadStartTime: number | null = null;
  private _hasStarted = signal(false);

  // Public signals
  readonly status = computed(() => this._status());
  readonly progress = computed(() => this._progress());
  readonly isDownloading = computed(() => this._status() === 'downloading');
  readonly isReady = computed(() => this._status() === 'ready');
  readonly totalProgress = computed(() => this._progress().totalProgress);
  readonly currentFile = computed(() => this._progress().currentFile);

  // Convenience checks for chat component
  readonly isLLMReady = computed(() => this.llmService.isReady);
  readonly isSemanticReady = computed(() => this.semanticSearch.isReady());

  /**
   * Start background downloads
   * Called when onboarding presentation starts (not during loading screen)
   * This is NON-BLOCKING - it returns immediately
   */
  startBackgroundDownload(): void {
    if (this._hasStarted()) {
      console.log('[BackgroundLoader] Already started, skipping');
      return;
    }

    this._hasStarted.set(true);
    this._status.set('downloading');
    this._downloadStartTime = performance.now();

    this.updateProgress({
      isDownloading: true,
      currentFile: 'embeddings',
      fileProgress: 0,
      totalProgress: 0,
      estimatedTimeRemaining: 'Calculando...',
      error: null
    });

    // Start downloads in background (fire and forget)
    this.executeDownloads().catch(error => {
      console.error('[BackgroundLoader] Download failed:', error);
      this._status.set('error');
      this.updateProgress({
        ...this._progress(),
        isDownloading: false,
        error: error.message || 'Error de descarga'
      });
    });
  }

  /**
   * Execute downloads sequentially
   * Embeddings first (small, fast), then LLM (large, slow)
   */
  private async executeDownloads(): Promise<void> {
    console.log('[BackgroundLoader] Starting downloads...');

    // Phase 1: Embeddings (~23MB, ~5-10s on good connection)
    // Weight: 20% of total progress
    try {
      this.updateProgress({
        ...this._progress(),
        currentFile: 'embeddings',
        fileProgress: 0
      });

      // Subscribe to semantic search progress
      const unsubscribeSemantic = this.watchSemanticProgress();

      await this.semanticSearch.initialize();

      // Clean up subscription
      unsubscribeSemantic();

      console.log('[BackgroundLoader] Embeddings complete');
    } catch (error) {
      console.warn('[BackgroundLoader] Embeddings failed, continuing with LLM:', error);
      // Don't fail completely - semantic search is optional
    }

    // Phase 2: LLM (~700MB, ~30-60s on good connection)
    // Weight: 80% of total progress (20-100%)
    try {
      this.updateProgress({
        ...this._progress(),
        currentFile: 'llm',
        fileProgress: 0,
        totalProgress: 20
      });

      // Subscribe to LLM progress
      const subscription = this.llmService.state$.subscribe(state => {
        this.ngZone.run(() => {
          const llmProgress = state.progress; // 0-100
          // Map LLM 0-100 to total 20-100
          const totalProgress = 20 + (llmProgress * 0.8);

          this.updateProgress({
            ...this._progress(),
            fileProgress: llmProgress,
            totalProgress: Math.round(totalProgress),
            estimatedTimeRemaining: this.calculateETA(totalProgress)
          });
        });
      });

      await this.llmService.initialize();

      subscription.unsubscribe();
      console.log('[BackgroundLoader] LLM complete');

    } catch (error) {
      console.warn('[BackgroundLoader] LLM failed:', error);
      // If LLM fails, we can still function without it (fallback mode)
    }

    // All done!
    this._status.set('ready');
    this.updateProgress({
      isDownloading: false,
      currentFile: 'complete',
      fileProgress: 100,
      totalProgress: 100,
      estimatedTimeRemaining: null,
      error: null
    });

    console.log('[BackgroundLoader] All downloads complete!');
  }

  /**
   * Watch semantic search progress
   * Returns cleanup function
   */
  private watchSemanticProgress(): () => void {
    const interval = setInterval(() => {
      const progress = this.semanticSearch.progress();
      // Map semantic 0-100 to total 0-20
      const totalProgress = progress * 0.2;

      this.updateProgress({
        ...this._progress(),
        fileProgress: progress,
        totalProgress: Math.round(totalProgress),
        estimatedTimeRemaining: this.calculateETA(totalProgress)
      });
    }, 100);

    return () => clearInterval(interval);
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(currentProgress: number): string | null {
    if (!this._downloadStartTime || currentProgress <= 0) {
      return null;
    }

    const elapsed = (performance.now() - this._downloadStartTime) / 1000; // seconds
    const rate = currentProgress / elapsed; // progress per second
    const remaining = (100 - currentProgress) / rate;

    if (remaining < 5) return 'Casi listo...';
    if (remaining < 10) return '~10 segundos';
    if (remaining < 30) return '~30 segundos';
    if (remaining < 60) return '~1 minuto';
    if (remaining < 120) return '~2 minutos';
    return '~' + Math.round(remaining / 60) + ' minutos';
  }

  /**
   * Update progress state
   */
  private updateProgress(progress: DownloadProgress): void {
    this._progress.set(progress);
  }

  /**
   * Wait for LLM to be ready
   * Used by chat component when user tries to chat before ready
   */
  async waitForLLM(): Promise<boolean> {
    // If already ready, return immediately
    if (this.llmService.isReady) {
      return true;
    }

    // If not started, start now
    if (!this._hasStarted()) {
      this.startBackgroundDownload();
    }

    // Wait for LLM to become ready
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.llmService.isReady) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (this._status() === 'error') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Get human-readable status message
   * v7.1: More descriptive messages with progress
   */
  getStatusMessage(): string {
    const progress = this._progress();

    if (progress.error) {
      return `Error: ${progress.error}`;
    }

    // v7.1: Only show "complete" when BOTH currentFile is complete AND totalProgress is 100
    if (progress.currentFile === 'complete' && progress.totalProgress >= 100) {
      return '¡IA lista para chatear!';
    }

    switch (progress.currentFile) {
      case 'none':
        return 'Preparando descarga...';
      case 'embeddings':
        return `Cargando búsqueda inteligente (${progress.totalProgress}%)`;
      case 'llm':
        const eta = progress.estimatedTimeRemaining;
        if (eta) {
          return `Descargando modelo de IA (${progress.totalProgress}%) - ${eta}`;
        }
        return `Descargando modelo de IA (${progress.totalProgress}%)`;
      case 'complete':
        // v7.1: Fallback - shouldn't reach here normally
        return progress.totalProgress >= 100 ? '¡IA lista para chatear!' : `Finalizando (${progress.totalProgress}%)`;
      default:
        return `Cargando IA... (${progress.totalProgress}%)`;
    }
  }

  /**
   * Check if downloads have been started
   */
  hasStarted(): boolean {
    return this._hasStarted();
  }

  /**
   * Reset service (for testing)
   */
  reset(): void {
    this._hasStarted.set(false);
    this._status.set('idle');
    this._downloadStartTime = null;
    this.updateProgress({
      isDownloading: false,
      currentFile: 'none',
      fileProgress: 0,
      totalProgress: 0,
      estimatedTimeRemaining: null,
      error: null
    });
  }
}
