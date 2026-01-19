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

// Dynamic imports for the AI libraries
type Pipeline = any;
type PipelineType = string;

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

  // Actual loaded pipeline/engine
  private _currentPipeline: Pipeline | null = null;
  private _currentEngine: any = null;

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
      if (filter.category !== 'all' && model.category !== filter.category) {
        return false;
      }
      if (filter.framework !== 'all' && model.framework !== filter.framework) {
        return false;
      }
      if (model.rank < filter.minRank || model.rank > filter.maxRank) {
        return false;
      }
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

  getCategoryMeta(category: ModelCategory) {
    return MODEL_CATEGORIES[category];
  }

  getFrameworkMeta(framework: ModelFramework) {
    return FRAMEWORKS[framework];
  }

  setFilter(partial: Partial<ModelFilter>): void {
    this._filter.update(current => ({ ...current, ...partial }));
  }

  resetFilter(): void {
    this._filter.set({
      category: 'all',
      framework: 'all',
      search: '',
      minRank: 1,
      maxRank: 100
    });
  }

  selectModel(model: ModelConfig | null): void {
    this._selectedModel.set(model);
    this._demoResult.set(null);
  }

  // Clear model from memory and cache
  async clearModelCache(): Promise<void> {
    // Dispose current pipeline/engine
    if (this._currentPipeline) {
      try {
        if (this._currentPipeline.dispose) {
          await this._currentPipeline.dispose();
        }
      } catch (e) {
        console.warn('Error disposing pipeline:', e);
      }
      this._currentPipeline = null;
    }

    if (this._currentEngine) {
      try {
        if (this._currentEngine.unload) {
          await this._currentEngine.unload();
        }
      } catch (e) {
        console.warn('Error unloading engine:', e);
      }
      this._currentEngine = null;
    }

    // Clear browser caches
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes('transformers') || name.includes('onnx') || name.includes('webllm') || name.includes('huggingface')) {
            await caches.delete(name);
            console.log(`Cleared cache: ${name}`);
          }
        }
      } catch (e) {
        console.warn('Error clearing caches:', e);
      }
    }

    // Clear IndexedDB
    if ('indexedDB' in window) {
      try {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name && (
            db.name.includes('transformers') ||
            db.name.includes('webllm') ||
            db.name.includes('onnx') ||
            db.name.includes('huggingface')
          )) {
            indexedDB.deleteDatabase(db.name);
            console.log(`Deleted IndexedDB: ${db.name}`);
          }
        }
      } catch (e) {
        console.warn('Error clearing IndexedDB:', e);
      }
    }

    this._loadedModelId.set(null);
    this._loadingState.set('idle');
    this._loadingProgress.set(0);
    this._loadingMessage.set('Cache cleared');
  }

  // Load a real model
  async loadModel(model: ModelConfig): Promise<void> {
    // Clear previous model first (only 1 at a time)
    if (this._loadedModelId() && this._loadedModelId() !== model.id) {
      this._loadingMessage.set('Clearing previous model...');
      await this.clearModelCache();
      await this.delay(500);
    }

    // If already loaded, skip
    if (this._loadedModelId() === model.id && this._currentPipeline) {
      this._loadingState.set('ready');
      return;
    }

    this._loadingState.set('loading');
    this._loadingProgress.set(0);
    this._loadingMessage.set(`Initializing ${model.name}...`);

    try {
      if (model.framework === 'Transformers.js') {
        await this.loadTransformersModel(model);
      } else if (model.framework === 'WebLLM') {
        await this.loadWebLLMModel(model);
      } else {
        // ONNX Runtime - show instructions
        this._loadingMessage.set('ONNX Runtime requires manual setup. See code example.');
        this._loadingProgress.set(100);
        this._loadingState.set('ready');
        this._loadedModelId.set(model.id);
      }
    } catch (error: any) {
      console.error('Error loading model:', error);
      this._loadingState.set('error');
      this._loadingMessage.set(`Error: ${error.message || 'Failed to load model'}`);
      throw error;
    }
  }

  // Load model using Transformers.js
  private async loadTransformersModel(model: ModelConfig): Promise<void> {
    this._loadingMessage.set('Loading Transformers.js library...');
    this._loadingProgress.set(5);

    // Dynamic import of transformers
    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure for browser
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    this._loadingMessage.set('Downloading model weights...');
    this._loadingProgress.set(10);

    // Determine pipeline type based on model
    const pipelineType = this.getPipelineType(model);

    // Progress callback
    const progressCallback = (progress: any) => {
      if (progress.status === 'download') {
        const pct = progress.progress || 0;
        this._loadingProgress.set(10 + Math.floor(pct * 0.8));
        this._loadingMessage.set(`Downloading: ${Math.floor(pct * 100)}%`);
      } else if (progress.status === 'init') {
        this._loadingProgress.set(90);
        this._loadingMessage.set('Initializing model...');
      } else if (progress.status === 'ready') {
        this._loadingProgress.set(100);
        this._loadingMessage.set('Model ready!');
      }
    };

    // Create pipeline with WebGPU if available
    const device = await this.getOptimalDevice();

    // Cast to any to satisfy TypeScript - pipelineType is dynamically determined
    this._currentPipeline = await pipeline(pipelineType as any, model.modelId, {
      device,
      progress_callback: progressCallback,
    });

    this._loadingProgress.set(100);
    this._loadingMessage.set('Model ready!');
    this._loadedModelId.set(model.id);
    this._loadingState.set('ready');
  }

  // Load model using WebLLM (MLC)
  private async loadWebLLMModel(model: ModelConfig): Promise<void> {
    this._loadingMessage.set('Loading WebLLM library...');
    this._loadingProgress.set(5);

    // Dynamic import of web-llm
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    this._loadingMessage.set('Downloading model...');

    // Progress callback
    const initProgressCallback = (progress: any) => {
      if (typeof progress === 'object') {
        const pct = progress.progress || 0;
        this._loadingProgress.set(Math.floor(pct * 100));
        this._loadingMessage.set(progress.text || `Loading: ${Math.floor(pct * 100)}%`);
      }
    };

    this._currentEngine = await CreateMLCEngine(model.modelId, {
      initProgressCallback,
    });

    this._loadingProgress.set(100);
    this._loadingMessage.set('Model ready!');
    this._loadedModelId.set(model.id);
    this._loadingState.set('ready');
  }

  // Get optimal device (WebGPU > WASM)
  private async getOptimalDevice(): Promise<'webgpu' | 'wasm'> {
    if ('gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          return 'webgpu';
        }
      } catch (e) {
        console.warn('WebGPU not available, falling back to WASM');
      }
    }
    return 'wasm';
  }

  // Determine pipeline type from model config
  private getPipelineType(model: ModelConfig): PipelineType {
    // Map demo types to pipeline types
    const typeMap: Record<string, string> = {
      'text': 'text-generation',
      'embedding': 'feature-extraction',
      'image': 'image-classification',
      'audio': 'automatic-speech-recognition',
      'multimodal': 'image-to-text',
    };

    // Special cases based on model ID
    if (model.modelId.includes('whisper')) return 'automatic-speech-recognition';
    if (model.modelId.includes('embed') || model.modelId.includes('MiniLM') || model.modelId.includes('bge') || model.modelId.includes('gte')) return 'feature-extraction';
    if (model.modelId.includes('detr') || model.modelId.includes('yolo')) return 'object-detection';
    if (model.modelId.includes('depth')) return 'depth-estimation';
    if (model.modelId.includes('segment') || model.modelId.includes('sam')) return 'image-segmentation';
    if (model.modelId.includes('classification') || model.modelId.includes('sentiment') || model.modelId.includes('emotion') || model.modelId.includes('toxic')) return 'text-classification';
    if (model.modelId.includes('ner') || model.modelId.includes('NER')) return 'token-classification';
    if (model.modelId.includes('fill-mask') || model.modelId.includes('bert-base-uncased')) return 'fill-mask';
    if (model.modelId.includes('summarization') || model.modelId.includes('bart-large-cnn')) return 'summarization';
    if (model.modelId.includes('translation') || model.modelId.includes('opus-mt') || model.modelId.includes('nllb') || model.modelId.includes('m2m') || model.modelId.includes('mt5')) return 'translation';
    if (model.modelId.includes('t5') || model.modelId.includes('flan')) return 'text2text-generation';
    if (model.modelId.includes('tts') || model.modelId.includes('speecht5')) return 'text-to-speech';
    if (model.modelId.includes('zero-shot')) return 'zero-shot-classification';
    if (model.modelId.includes('question-answering') || model.modelId.includes('deberta')) return 'question-answering';
    if (model.modelId.includes('vit') || model.modelId.includes('mobilenet') || model.modelId.includes('efficientnet') || model.modelId.includes('convnext') || model.modelId.includes('swin') || model.modelId.includes('hiera')) return 'image-classification';
    if (model.modelId.includes('clip') || model.modelId.includes('siglip')) return 'zero-shot-image-classification';
    if (model.modelId.includes('dino')) return 'image-feature-extraction';
    if (model.modelId.includes('musicgen')) return 'text-to-audio';
    if (model.modelId.includes('trocr')) return 'image-to-text';
    if (model.modelId.includes('wav2vec') || model.modelId.includes('wavlm') || model.modelId.includes('unispeech')) return 'automatic-speech-recognition';
    if (model.modelId.includes('clap')) return 'zero-shot-audio-classification';
    if (model.modelId.includes('florence') || model.modelId.includes('SmolVLM') || model.modelId.includes('moondream') || model.modelId.includes('Qwen2-VL') || model.modelId.includes('llava')) return 'image-to-text';

    return typeMap[model.demoType] || 'text-generation';
  }

  // Run demo with loaded model
  async runDemo(input: string, imageInput?: File | Blob): Promise<string> {
    const model = this._selectedModel();
    if (!model) {
      throw new Error('No model selected');
    }

    if (this._loadedModelId() !== model.id) {
      throw new Error('Model not loaded. Please load the model first.');
    }

    this._loadingMessage.set('Processing...');
    let result: string;

    try {
      if (model.framework === 'WebLLM' && this._currentEngine) {
        result = await this.runWebLLMDemo(input);
      } else if (model.framework === 'Transformers.js' && this._currentPipeline) {
        result = await this.runTransformersDemo(model, input, imageInput);
      } else {
        result = 'Model not properly loaded. Please reload.';
      }
    } catch (error: any) {
      console.error('Demo error:', error);
      result = `Error: ${error.message || 'Failed to run demo'}`;
    }

    this._demoResult.set(result);
    this._loadingMessage.set('Done!');
    return result;
  }

  // Run demo with WebLLM engine
  private async runWebLLMDemo(input: string): Promise<string> {
    const response = await this._currentEngine.chat.completions.create({
      messages: [{ role: 'user', content: input }],
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'No response generated';
  }

  // Run demo with Transformers.js pipeline
  private async runTransformersDemo(model: ModelConfig, input: string, imageInput?: File | Blob): Promise<string> {
    const pipelineType = this.getPipelineType(model);

    switch (pipelineType) {
      case 'text-generation':
        const textResult = await this._currentPipeline(input, {
          max_new_tokens: 200,
          temperature: 0.7,
        });
        return Array.isArray(textResult)
          ? textResult[0]?.generated_text || JSON.stringify(textResult)
          : textResult?.generated_text || JSON.stringify(textResult);

      case 'feature-extraction':
        const embedResult = await this._currentPipeline(input, { pooling: 'mean', normalize: true });
        const embedArray = Array.from(embedResult.data || embedResult[0]?.data || []).slice(0, 10);
        return `Embedding generated (${embedResult.dims?.[1] || 'N/A'} dimensions)\n\nFirst 10 values:\n[${embedArray.map((v: any) => v.toFixed(4)).join(', ')}...]`;

      case 'text-classification':
        const classResult = await this._currentPipeline(input);
        return `Classification Result:\n\n${JSON.stringify(classResult, null, 2)}`;

      case 'token-classification':
        const nerResult = await this._currentPipeline(input);
        return `Named Entities:\n\n${JSON.stringify(nerResult, null, 2)}`;

      case 'fill-mask':
        const maskResult = await this._currentPipeline(input);
        return `Fill Mask Results:\n\n${JSON.stringify(maskResult.slice(0, 5), null, 2)}`;

      case 'summarization':
        const summaryResult = await this._currentPipeline(input, { max_length: 130, min_length: 30 });
        return `Summary:\n\n${summaryResult[0]?.summary_text || JSON.stringify(summaryResult)}`;

      case 'translation':
        const transResult = await this._currentPipeline(input);
        return `Translation:\n\n${transResult[0]?.translation_text || JSON.stringify(transResult)}`;

      case 'text2text-generation':
        const t2tResult = await this._currentPipeline(input, { max_new_tokens: 200 });
        return `Result:\n\n${t2tResult[0]?.generated_text || JSON.stringify(t2tResult)}`;

      case 'question-answering':
        // For QA, we need context and question
        const qaResult = await this._currentPipeline({
          question: input,
          context: 'Please provide context in the input field. Format: "Question: ... Context: ..."'
        });
        return `Answer:\n\n${JSON.stringify(qaResult, null, 2)}`;

      case 'zero-shot-classification':
        const labels = ['positive', 'negative', 'neutral', 'question', 'statement'];
        const zeroResult = await this._currentPipeline(input, { candidate_labels: labels });
        return `Zero-Shot Classification:\n\n${JSON.stringify(zeroResult, null, 2)}`;

      case 'automatic-speech-recognition':
        if (imageInput) {
          const asrResult = await this._currentPipeline(imageInput);
          return `Transcription:\n\n${asrResult?.text || JSON.stringify(asrResult)}`;
        }
        return 'Please provide an audio file for transcription.';

      case 'image-classification':
        if (imageInput) {
          const imgClassResult = await this._currentPipeline(imageInput);
          return `Image Classification:\n\n${JSON.stringify(imgClassResult, null, 2)}`;
        }
        return 'Please provide an image for classification.';

      case 'object-detection':
        if (imageInput) {
          const detectResult = await this._currentPipeline(imageInput);
          return `Detected Objects:\n\n${JSON.stringify(detectResult, null, 2)}`;
        }
        return 'Please provide an image for object detection.';

      case 'image-to-text':
        if (imageInput) {
          const captionResult = await this._currentPipeline(imageInput);
          return `Image Description:\n\n${captionResult[0]?.generated_text || JSON.stringify(captionResult)}`;
        }
        return 'Please provide an image for analysis.';

      case 'depth-estimation':
        if (imageInput) {
          const depthResult = await this._currentPipeline(imageInput);
          return `Depth Estimation Complete!\n\nDepth map generated. In a real app, this would display as a grayscale depth image.`;
        }
        return 'Please provide an image for depth estimation.';

      case 'image-segmentation':
        if (imageInput) {
          const segResult = await this._currentPipeline(imageInput);
          return `Segmentation:\n\n${JSON.stringify(segResult, null, 2)}`;
        }
        return 'Please provide an image for segmentation.';

      case 'zero-shot-image-classification':
        if (imageInput) {
          const clipLabels = input.split(',').map(l => l.trim()).filter(l => l);
          const clipResult = await this._currentPipeline(imageInput, clipLabels.length ? clipLabels : ['photo', 'drawing', 'painting']);
          return `Image Classification:\n\n${JSON.stringify(clipResult, null, 2)}`;
        }
        return 'Please provide an image. You can also enter comma-separated labels to classify against.';

      case 'image-feature-extraction':
        if (imageInput) {
          const imgFeatResult = await this._currentPipeline(imageInput);
          const imgFeatArray = Array.from(imgFeatResult.data || []).slice(0, 10);
          return `Image Features (${imgFeatResult.dims?.[1] || 'N/A'} dimensions)\n\nFirst 10 values:\n[${imgFeatArray.map((v: any) => v.toFixed(4)).join(', ')}...]`;
        }
        return 'Please provide an image for feature extraction.';

      case 'text-to-audio':
        const audioResult = await this._currentPipeline(input, { max_new_tokens: 500 });
        return `Audio Generated!\n\nIn a full implementation, this would return playable audio data.\nPrompt: "${input}"`;

      case 'text-to-speech':
        const ttsResult = await this._currentPipeline(input);
        return `Speech Generated!\n\nIn a full implementation, this would return playable audio.\nText: "${input}"`;

      case 'zero-shot-audio-classification':
        if (imageInput) {
          const audioLabels = input.split(',').map(l => l.trim()).filter(l => l);
          const audioClassResult = await this._currentPipeline(imageInput, audioLabels.length ? audioLabels : ['music', 'speech', 'noise']);
          return `Audio Classification:\n\n${JSON.stringify(audioClassResult, null, 2)}`;
        }
        return 'Please provide an audio file. You can also enter comma-separated labels.';

      default:
        // Generic attempt
        try {
          const genericResult = await this._currentPipeline(input);
          return `Result:\n\n${JSON.stringify(genericResult, null, 2)}`;
        } catch {
          return `Pipeline type "${pipelineType}" executed. Check console for detailed output.`;
        }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
