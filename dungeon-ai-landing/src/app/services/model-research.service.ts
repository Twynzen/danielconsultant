import { Injectable, signal, computed } from '@angular/core';
import {
  ModelConfig,
  ModelCategory,
  ModelFramework,
  ALL_MODELS,
  MODEL_CATEGORIES,
  FRAMEWORKS
} from '../config/model-research.config';

export interface ModelFilter {
  category: ModelCategory | 'all';
  framework: ModelFramework | 'all';
  search: string;
  minRank: number;
  maxRank: number;
}

export type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({
  providedIn: 'root'
})
export class ModelResearchService {
  // All available models
  private readonly _models = signal<ModelConfig[]>(ALL_MODELS);

  // Current filter
  private readonly _filter = signal<ModelFilter>({
    category: 'all',
    framework: 'all',
    search: '',
    minRank: 1,
    maxRank: 100
  });

  // Currently selected model for demo
  private readonly _selectedModel = signal<ModelConfig | null>(null);

  // Loading state for model download
  private readonly _loadingState = signal<LoadingState>('idle');
  private readonly _loadingProgress = signal<number>(0);
  private readonly _loadingMessage = signal<string>('');

  // Currently loaded model ID (only one at a time)
  private readonly _loadedModelId = signal<string | null>(null);

  // Demo result
  private readonly _demoResult = signal<string | null>(null);

  // Public readonly signals
  readonly models = this._models.asReadonly();
  readonly filter = this._filter.asReadonly();
  readonly selectedModel = this._selectedModel.asReadonly();
  readonly loadingState = this._loadingState.asReadonly();
  readonly loadingProgress = this._loadingProgress.asReadonly();
  readonly loadingMessage = this._loadingMessage.asReadonly();
  readonly loadedModelId = this._loadedModelId.asReadonly();
  readonly demoResult = this._demoResult.asReadonly();

  // Computed filtered models
  readonly filteredModels = computed(() => {
    const filter = this._filter();
    const models = this._models();

    return models.filter(model => {
      // Category filter
      if (filter.category !== 'all' && model.category !== filter.category) {
        return false;
      }

      // Framework filter
      if (filter.framework !== 'all' && model.framework !== filter.framework) {
        return false;
      }

      // Rank filter
      if (model.rank < filter.minRank || model.rank > filter.maxRank) {
        return false;
      }

      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return (
          model.name.toLowerCase().includes(searchLower) ||
          model.description.toLowerCase().includes(searchLower) ||
          model.useCases.some(uc => uc.toLowerCase().includes(searchLower))
        );
      }

      return true;
    }).sort((a, b) => a.rank - b.rank);
  });

  // Computed stats
  readonly stats = computed(() => {
    const models = this._models();
    return {
      total: models.length,
      byCategory: Object.keys(MODEL_CATEGORIES).reduce((acc, cat) => {
        acc[cat as ModelCategory] = models.filter(m => m.category === cat).length;
        return acc;
      }, {} as Record<ModelCategory, number>),
      byFramework: Object.keys(FRAMEWORKS).reduce((acc, fw) => {
        acc[fw as ModelFramework] = models.filter(m => m.framework === fw).length;
        return acc;
      }, {} as Record<ModelFramework, number>)
    };
  });

  // Get category metadata
  getCategoryMeta(category: ModelCategory) {
    return MODEL_CATEGORIES[category];
  }

  // Get framework metadata
  getFrameworkMeta(framework: ModelFramework) {
    return FRAMEWORKS[framework];
  }

  // Update filter
  setFilter(partial: Partial<ModelFilter>): void {
    this._filter.update(current => ({ ...current, ...partial }));
  }

  // Reset filter
  resetFilter(): void {
    this._filter.set({
      category: 'all',
      framework: 'all',
      search: '',
      minRank: 1,
      maxRank: 100
    });
  }

  // Select model for demo
  selectModel(model: ModelConfig | null): void {
    this._selectedModel.set(model);
    this._demoResult.set(null);
  }

  // Clear previously loaded model cache
  async clearModelCache(): Promise<void> {
    const currentLoaded = this._loadedModelId();
    if (currentLoaded) {
      // Clear from cache API
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            if (name.includes('transformers') || name.includes('onnx') || name.includes('webllm')) {
              await caches.delete(name);
            }
          }
        } catch (e) {
          console.warn('Error clearing cache:', e);
        }
      }

      // Clear IndexedDB if used
      if ('indexedDB' in window) {
        try {
          const databases = await indexedDB.databases();
          for (const db of databases) {
            if (db.name && (db.name.includes('transformers') || db.name.includes('webllm'))) {
              indexedDB.deleteDatabase(db.name);
            }
          }
        } catch (e) {
          console.warn('Error clearing IndexedDB:', e);
        }
      }

      this._loadedModelId.set(null);
      this._loadingMessage.set('Cache cleared successfully');
    }
  }

  // Simulate model loading (actual implementation depends on framework)
  async loadModel(model: ModelConfig): Promise<void> {
    // Clear previous model first
    if (this._loadedModelId() && this._loadedModelId() !== model.id) {
      await this.clearModelCache();
    }

    this._loadingState.set('loading');
    this._loadingProgress.set(0);
    this._loadingMessage.set(`Initializing ${model.name}...`);

    try {
      // Simulate download progress (in real implementation, connect to actual loader)
      const steps = [
        { progress: 10, message: 'Checking cache...' },
        { progress: 30, message: 'Downloading model weights...' },
        { progress: 60, message: 'Loading into WebGPU...' },
        { progress: 80, message: 'Compiling shaders...' },
        { progress: 95, message: 'Warming up model...' },
        { progress: 100, message: 'Ready!' }
      ];

      for (const step of steps) {
        await this.delay(500 + Math.random() * 500);
        this._loadingProgress.set(step.progress);
        this._loadingMessage.set(step.message);
      }

      this._loadedModelId.set(model.id);
      this._loadingState.set('ready');
    } catch (error) {
      this._loadingState.set('error');
      this._loadingMessage.set(`Error loading model: ${error}`);
      throw error;
    }
  }

  // Run demo with loaded model
  async runDemo(input: string): Promise<string> {
    const model = this._selectedModel();
    if (!model) {
      throw new Error('No model selected');
    }

    if (this._loadedModelId() !== model.id) {
      throw new Error('Model not loaded');
    }

    // Simulate inference (in real implementation, connect to actual model)
    this._loadingMessage.set('Processing...');

    await this.delay(1000 + Math.random() * 1000);

    // Generate mock result based on model type
    let result: string;

    switch (model.demoType) {
      case 'text':
        result = this.generateMockTextResult(model, input);
        break;
      case 'embedding':
        result = this.generateMockEmbeddingResult(input);
        break;
      case 'image':
        result = this.generateMockImageResult(model, input);
        break;
      case 'audio':
        result = this.generateMockAudioResult(model, input);
        break;
      case 'multimodal':
        result = this.generateMockMultimodalResult(model, input);
        break;
      default:
        result = 'Demo not available for this model type';
    }

    this._demoResult.set(result);
    this._loadingMessage.set('Done!');
    return result;
  }

  private generateMockTextResult(model: ModelConfig, input: string): string {
    const responses: Record<string, string> = {
      'deepseek-r1-qwen': `<think>
Let me analyze this step by step...
1. First, I'll consider the main question: "${input.substring(0, 50)}..."
2. Breaking down the problem into components...
3. Applying logical reasoning...
</think>

Based on my analysis, here's my response:
This is a demonstration of the DeepSeek-R1 reasoning model running in your browser.
The model shows its thinking process before providing an answer.

In a real implementation, you would see actual AI reasoning here.`,

      'qwen2-5': `Based on your input: "${input.substring(0, 50)}..."

Here's a helpful response from Qwen2.5:
This is a demonstration of the Qwen2.5 model running locally in your browser using WebGPU acceleration.

Key features demonstrated:
- Low latency responses (~60 tokens/second)
- No data sent to external servers
- Full context understanding

In production, this would be real AI output.`,

      'phi-3-mini': `Response from Phi-3.5-mini:

Your query: "${input.substring(0, 50)}..."

This model supports up to 128K context tokens, making it ideal for:
- Processing long documents
- Maintaining extended conversations
- Complex reasoning tasks

This is a demo - actual inference would happen with the real model.`,

      'llama-3-2': `Llama-3.2-1B Response:

Input received: "${input.substring(0, 50)}..."

Meta's Llama 3.2 is running directly in your browser!
Features:
- 128K context window
- Excellent instruction following
- Large community of fine-tunes available

[Demo mode - connect actual model for real inference]`,

      'minithinky': `MiniThinky Analysis:

Thinking about: "${input.substring(0, 50)}..."

Step 1: Parsing input...
Step 2: Applying reasoning...
Step 3: Generating response...

This model is optimized for fast browser inference at ~60 tokens/second.

[Demo mode - actual model would provide real reasoning]`
    };

    return responses[model.id] || `Demo response for ${model.name}:\n\nInput: "${input}"\n\nThis is a placeholder response. In production, the actual model would generate real output.`;
  }

  private generateMockEmbeddingResult(input: string): string {
    const dims = 384;
    const embedding = Array.from({ length: 8 }, () => (Math.random() * 2 - 1).toFixed(4));

    return `Embedding generated for: "${input.substring(0, 50)}..."

Dimensions: ${dims}
First 8 values: [${embedding.join(', ')}...]

Embedding vector characteristics:
- Normalized: Yes
- Pooling: Mean
- Suitable for: Semantic search, RAG, similarity matching

[Demo mode - actual embeddings would be computed by the model]`;
  }

  private generateMockImageResult(model: ModelConfig, input: string): string {
    const results: Record<string, string> = {
      'florence-2': `Florence-2 Analysis Results:

Caption: "A scene depicting ${input || 'the uploaded image content'}"

Detected Objects:
- Object 1: person (confidence: 0.95)
- Object 2: background elements (confidence: 0.87)

OCR Text Found: [No text detected in demo]

[Demo mode - upload an image to see real analysis]`,

      'trocr': `TrOCR Recognition Results:

Extracted Text:
"${input || 'Sample handwritten text would appear here'}"

Confidence: 0.92
Language: English
Type: Handwritten

[Demo mode - upload handwritten text image for real OCR]`,

      'depth-pro': `Depth Pro Estimation:

Depth Map Generated:
- Near plane: 0.5m
- Far plane: 10.0m
- Average depth: 3.2m

The depth map shows relative distances in the scene.
Lighter areas = closer to camera
Darker areas = further away

[Demo mode - upload image to generate actual depth map]`,

      'detr': `DETR Object Detection Results:

Detected 3 objects:
1. person - 95% confidence - bbox: [100, 50, 200, 300]
2. car - 87% confidence - bbox: [250, 100, 400, 200]
3. tree - 72% confidence - bbox: [50, 0, 150, 250]

[Demo mode - upload image for real object detection]`
    };

    return results[model.id] || `Image analysis demo for ${model.name}:\n\n[Upload an image to see actual results]`;
  }

  private generateMockAudioResult(model: ModelConfig, input: string): string {
    if (model.id === 'whisper') {
      return `Whisper Transcription:

"${input || 'This is a sample transcription of spoken audio content...'}"

Language: English (detected)
Duration: 0:00 (demo mode)
Confidence: 0.94

[Demo mode - record or upload audio for real transcription]`;
    }

    if (model.id === 'musicgen') {
      return `MusicGen Output:

Generating music for prompt: "${input || 'upbeat electronic music'}"

Style: Electronic
Duration: 10 seconds
Sample rate: 32kHz

[Audio generated - demo mode]
[In production, actual audio would be playable here]`;
    }

    return `Audio demo for ${model.name}:\n\n[Provide audio input for actual results]`;
  }

  private generateMockMultimodalResult(model: ModelConfig, input: string): string {
    const results: Record<string, string> = {
      'smolvlm': `SmolVLM Analysis:

Image Description:
"The image shows ${input || 'a scene that requires an actual image to analyze'}"

Visual Elements Identified:
- Main subject: Detected
- Background: Analyzed
- Text content: None found

Q&A Mode Available - ask questions about the image!

[Demo mode - upload image for real VLM analysis]`,

      'moondream2': `Moondream2 Analysis:

Image Understanding:
"${input || 'Upload an image for detailed analysis'}"

Special Features:
- Gaze Detection: [Requires face in image]
- UI Understanding: [Requires screenshot]
- OCR: [Requires text in image]

Output Format: JSON/XML available

[Demo mode - upload image for real analysis]`
    };

    return results[model.id] || `Multimodal demo for ${model.name}:\n\n[Upload image and/or text for actual results]`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
