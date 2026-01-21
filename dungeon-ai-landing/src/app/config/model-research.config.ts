/**
 * Model Research Platform Configuration
 * Top 100+ AI Models for WebLLM/WebGPU - Ranking by Innovation
 *
 * Categories:
 * - llm: Language Models for text generation
 * - vision: Vision/Image models
 * - audio: Speech/Audio models
 * - embedding: Embedding models for RAG/Search
 * - multimodal: Vision-Language models
 * - generation: Image/Audio generation
 */

export type ModelCategory = 'llm' | 'vision' | 'audio' | 'embedding' | 'multimodal' | 'generation';
export type ModelFramework = 'WebLLM' | 'Transformers.js' | 'ONNX Runtime Web';

export interface ModelConfig {
  id: string;
  name: string;
  rank: number;
  category: ModelCategory;
  size: string;
  vram: string;
  framework: ModelFramework;
  innovationScore: 1 | 2 | 3 | 4 | 5;
  description: string;
  whyTop: string;
  useCases: string[];
  codeExample: string;
  modelId: string; // For actual loading
  docsUrl?: string;
  demoType: 'text' | 'image' | 'audio' | 'embedding' | 'multimodal';
  status?: 'active' | 'broken';
  errorMessage?: string;
}

// Top 10 Models - Maximum Innovation
export const TOP_10_MODELS: ModelConfig[] = [
  {
    id: 'deepseek-r1-qwen',
    name: 'DeepSeek-R1-Distill-Qwen-1.5B',
    rank: 1,
    category: 'llm',
    size: '~1.5B parámetros',
    vram: '~2GB (quantizado)',
    framework: 'Transformers.js',
    innovationScore: 5,
    description: 'Primer modelo de razonamiento avanzado "think step-by-step" que corre completamente en el navegador con WebGPU.',
    whyTop: 'Permite crear aplicaciones de resolución de problemas complejos, tutores de matemáticas, y asistentes de código que funcionan 100% offline. ~60 tokens/segundo.',
    useCases: ['Tutores de matemáticas', 'Asistentes de código', 'Resolución de problemas', 'Razonamiento lógico'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text-generation",
  "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B",
  { device: "webgpu" }
);

const result = await generator(
  "Explain step by step how to solve: 2x + 5 = 13",
  { max_new_tokens: 200 }
);`,
    modelId: 'onnx-community/DeepSeek-R1-Distill-Qwen-1.5B',
    docsUrl: 'https://huggingface.co/onnx-community/DeepSeek-R1-Distill-Qwen-1.5B',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'Inaccesible: El repositorio onnx-community requiere autenticación o es privado. (Error 401)'
  },
  {
    id: 'smolvlm',
    name: 'SmolVLM (256M / 500M)',
    rank: 2,
    category: 'multimodal',
    size: '256M / 500M parámetros',
    vram: '~500MB - 1GB',
    framework: 'Transformers.js',
    innovationScore: 5,
    description: 'El modelo multimodal más pequeño y eficiente para navegador. Analiza imágenes en tiempo real.',
    whyTop: 'Permite crear apps que "ven" y describen imágenes, hacen OCR, responden preguntas sobre fotos - todo sin enviar datos a servidores. Ideal para privacidad.',
    useCases: ['Descripción de imágenes', 'OCR', 'Visual Q&A', 'Accesibilidad'],
    codeExample: `import { SmolVLMForConditionalGeneration } from "@huggingface/transformers";

const model = await SmolVLMForConditionalGeneration.from_pretrained(
  "onnx-community/SmolVLM-500M-Instruct",
  { dtype: "q4", device: "webgpu" }
);

// Analizar una imagen
const result = await model.generate({
  image: imageElement,
  prompt: "Describe what you see in this image"
});`,
    modelId: 'onnx-community/SmolVLM-500M-Instruct',
    docsUrl: 'https://huggingface.co/onnx-community/SmolVLM-500M-Instruct',
    demoType: 'multimodal',
    status: 'broken',
    errorMessage: 'Inaccesible: El repositorio onnx-community requiere autenticación o es privado. (Error 401)'
  },
  {
    id: 'whisper',
    name: 'Whisper (tiny/base/small)',
    rank: 3,
    category: 'audio',
    size: '39M - 244M parámetros',
    vram: '~150MB - 1GB',
    framework: 'Transformers.js',
    innovationScore: 5,
    description: 'Revoluciona las aplicaciones web con entrada de voz. Transcripción en tiempo real sin servidores.',
    whyTop: 'Soporte multilingüe, funciona offline. Habilita dictado, subtítulos en vivo, comandos de voz.',
    useCases: ['Transcripción de audio', 'Subtítulos en vivo', 'Comandos de voz', 'Dictado'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-tiny.en",
  { device: "webgpu" }
);

// Transcribir audio
const result = await transcriber(audioBlob);
console.log(result.text);`,
    modelId: 'onnx-community/whisper-tiny.en',
    docsUrl: 'https://huggingface.co/onnx-community/whisper-tiny.en',
    demoType: 'audio'
  },
  {
    id: 'qwen2-5',
    name: 'Qwen2.5-0.5B/1.5B-Instruct',
    rank: 4,
    category: 'llm',
    size: '500M - 1.5B parámetros',
    vram: '944MB - 2GB',
    framework: 'WebLLM',
    innovationScore: 5,
    description: 'Mejor relación calidad/tamaño para chat en navegador. Los modelos pequeños rivalizan con modelos 10x más grandes.',
    whyTop: 'La familia Qwen2.5 ofrece la mejor calidad por parámetro. Excelente para chatbots, asistentes, y cualquier tarea de texto que requiera inteligencia sin sacrificar velocidad.',
    useCases: ['Chatbots', 'Asistentes virtuales', 'Generación de texto', 'Respuestas a preguntas'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  { initProgressCallback: (p) => console.log(p) }
);

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Hola! Explícame qué es WebGPU" }],
  stream: true
});`,
    modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct',
    demoType: 'text'
  },
  {
    id: 'florence-2',
    name: 'Florence-2',
    rank: 5,
    category: 'vision',
    size: '232M parámetros (base)',
    vram: '~500MB - 1GB',
    framework: 'Transformers.js',
    innovationScore: 5,
    description: 'La "navaja suiza" de la visión computacional en el navegador.',
    whyTop: 'Un solo modelo hace: OCR, detección de objetos, segmentación, captioning, visual Q&A. Perfecto para herramientas de accesibilidad y procesamiento de documentos.',
    useCases: ['OCR', 'Detección de objetos', 'Segmentación', 'Captioning', 'Visual Q&A'],
    codeExample: `import { Florence2ForConditionalGeneration } from "@huggingface/transformers";

const model = await Florence2ForConditionalGeneration.from_pretrained(
  "onnx-community/Florence-2-base-ft",
  {
    dtype: { vision_encoder: "fp16", encoder_model: "q4" },
    device: "webgpu"
  }
);

// Múltiples tareas con el mismo modelo
const caption = await model.caption(image);
const objects = await model.detect(image);
const ocr = await model.ocr(image);`,
    modelId: 'onnx-community/Florence-2-base-ft',
    docsUrl: 'https://huggingface.co/onnx-community/Florence-2-base-ft',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'Error de librería: La versión actual de Transformers.js no soporta Florence-2.'
  },
  {
    id: 'moondream2',
    name: 'Moondream2',
    rank: 6,
    category: 'multimodal',
    size: '~1.9B parámetros',
    vram: '~2GB',
    framework: 'Transformers.js',
    innovationScore: 5,
    description: 'Especializado en tareas de visión únicas: gaze tracking, UI understanding, OCR mejorado.',
    whyTop: 'Detecta hacia dónde mira una persona, entiende interfaces de usuario (ideal para testing automatizado), OCR de documentos complejos. Output estructurado en JSON/XML.',
    useCases: ['Gaze tracking', 'UI Understanding', 'Testing automatizado', 'OCR avanzado'],
    codeExample: `import { Moondream } from "@huggingface/transformers";

const model = await Moondream.from_pretrained(
  "onnx-community/moondream2",
  { device: "webgpu" }
);

// Detección de objetos
const objects = model.detect(image, "face")["objects"];

// Gaze detection - hacia dónde mira la persona
const gaze = model.point(image, "person")["points"];

// OCR
const text = await model.ocr(image);`,
    modelId: 'onnx-community/moondream2',
    docsUrl: 'https://huggingface.co/vikhyatk/moondream2',
    demoType: 'multimodal',
    status: 'broken',
    errorMessage: 'Error 401: El repositorio onnx-community/moondream2 requiere autenticación o es privado.'
  },
  {
    id: 'phi-3-mini',
    name: 'Phi-3/Phi-3.5-mini (4K/128K)',
    rank: 7,
    category: 'llm',
    size: '3.8B parámetros',
    vram: '~2.1GB',
    framework: 'WebLLM',
    innovationScore: 5,
    description: 'Microsoft optimizó Phi para edge/browser. Calidad comparable a modelos 10x más grandes.',
    whyTop: 'Contexto de 128K tokens permite procesar documentos largos. Excelente para RAG en el navegador.',
    useCases: ['Procesamiento de documentos', 'RAG', 'Contexto largo', 'Asistentes inteligentes'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "Phi-3.5-mini-instruct-q4f16_1-MLC"
);

// Contexto largo - hasta 128K tokens
const reply = await engine.chat.completions.create({
  messages: [
    {
      role: "user",
      content: \`Analiza este documento largo: \${longDocument}\`
    }
  ]
});`,
    modelId: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/microsoft/Phi-3.5-mini-instruct',
    demoType: 'text'
  },
  {
    id: 'sd-turbo',
    name: 'Stable Diffusion Turbo (ONNX)',
    rank: 8,
    category: 'generation',
    size: '~250MB - 1GB (quantizado)',
    vram: '~2-4GB',
    framework: 'ONNX Runtime Web',
    innovationScore: 5,
    description: 'Generación de imágenes directamente en el navegador sin servidores.',
    whyTop: 'Con quantización a 6/8 bits cabe en ~250MB. Permite apps de creatividad, diseño, y generación de assets 100% privadas. Genera en <1 segundo.',
    useCases: ['Generación de imágenes', 'Diseño creativo', 'Assets de juegos', 'Arte digital'],
    codeExample: `import * as ort from 'onnxruntime-web/webgpu';

// Cargar modelo SD Turbo quantizado
const session = await ort.InferenceSession.create(
  'sd-turbo-q8.onnx',
  { executionProviders: ['webgpu'] }
);

// Generar imagen desde texto
const prompt = "A cyberpunk city at night, neon lights";
const result = await session.run({
  prompt: encodePrompt(prompt),
  steps: 1, // SD Turbo solo necesita 1 paso
  guidance_scale: 0
});`,
    modelId: 'stable-diffusion-turbo-onnx',
    docsUrl: 'https://huggingface.co/stabilityai/sd-turbo',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'ONNX Runtime: Requiere configuración manual. Demo no disponible en la plataforma.'
  },
  {
    id: 'llama-3-2',
    name: 'Llama-3.2-1B/3B-Instruct',
    rank: 9,
    category: 'llm',
    size: '1B / 3B parámetros',
    vram: '~1.2GB / 2.9GB',
    framework: 'WebLLM',
    innovationScore: 5,
    description: 'Los modelos más pequeños de Llama 3.2 son perfectos para navegador.',
    whyTop: '128K tokens de contexto, excelente para seguir instrucciones, y la comunidad más grande de fine-tunes. Licencia permisiva.',
    useCases: ['Chat general', 'Seguimiento de instrucciones', 'Fine-tuning', 'Asistentes'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine(
  "Llama-3.2-1B-Instruct-q4f32_1-MLC"
);

const reply = await engine.chat.completions.create({
  messages: [
    { role: "system", content: "Eres un asistente útil." },
    { role: "user", content: "¿Qué es machine learning?" }
  ],
  max_tokens: 500,
  stream: true
});

// Stream de respuesta
for await (const chunk of reply) {
  console.log(chunk.choices[0].delta.content);
}`,
    modelId: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    docsUrl: 'https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct',
    demoType: 'text'
  },
  {
    id: 'minithinky',
    name: 'MiniThinky-v2 (1B)',
    rank: 10,
    category: 'llm',
    size: '1B parámetros',
    vram: '~1GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Optimizado específicamente para inferencia en navegador. ~60 tokens/segundo.',
    whyTop: 'Puede realizar tareas de razonamiento y leer/manipular páginas web, habilitando asistentes de navegador avanzados.',
    useCases: ['Asistentes de navegador', 'Razonamiento lógico', 'Automatización web', 'Procesamiento rápido'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text-generation",
  "onnx-community/MiniThinky-v2-1B",
  { device: "webgpu" }
);

const result = await generator(
  "Think step by step: If I have 3 apples and buy 5 more, how many do I have?",
  { max_new_tokens: 150 }
);`,
    modelId: 'onnx-community/MiniThinky-v2-1B',
    docsUrl: 'https://huggingface.co/onnx-community/MiniThinky-v2-1B',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  }
];

// Models 11-20 - Alta Innovación
export const MODELS_11_20: ModelConfig[] = [
  {
    id: 'jina-embeddings',
    name: 'Jina-Embeddings-v2-base-en',
    rank: 11,
    category: 'embedding',
    size: '~137M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Habilita búsqueda semántica sin servidores.',
    whyTop: 'Perfecto para crear sistemas RAG en el navegador donde los documentos nunca salen del dispositivo del usuario.',
    useCases: ['RAG', 'Búsqueda semántica', 'Retrieval', 'Privacidad'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/jina-embeddings-v2-base-en',
  { dtype: "fp32" }
);

const embeddings = await extractor(
  ['texto para buscar'],
  { pooling: 'mean' }
);`,
    modelId: 'Xenova/jina-embeddings-v2-base-en',
    docsUrl: 'https://huggingface.co/Xenova/jina-embeddings-v2-base-en',
    demoType: 'embedding'
  },
  {
    id: 'nomic-embed',
    name: 'Nomic-Embed-Text-v1.5',
    rank: 12,
    category: 'embedding',
    size: '~137M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Embeddings redimensionables (Matryoshka).',
    whyTop: 'Puedes elegir entre 64 y 768 dimensiones según necesites velocidad vs calidad. Ideal para optimizar storage y búsqueda.',
    useCases: ['Embeddings flexibles', 'Optimización de storage', 'Búsqueda eficiente', 'RAG'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/nomic-embed-text-v1.5'
);

// Elegir dimensiones: 64, 128, 256, 512, 768
const embeddings = await extractor(
  ['texto'],
  { pooling: 'mean', normalize: true }
);

// Reducir a 256 dimensiones
const reduced = embeddings[0].slice(0, 256);`,
    modelId: 'Xenova/nomic-embed-text-v1.5',
    docsUrl: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5',
    demoType: 'embedding',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'all-minilm',
    name: 'All-MiniLM-L6-v2',
    rank: 13,
    category: 'embedding',
    size: '22M parámetros',
    vram: '~50MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'El modelo de embeddings más ligero y rápido.',
    whyTop: 'Perfecto cuando necesitas búsqueda semántica pero con recursos mínimos. Solo 384 dimensiones pero sorprendentemente efectivo.',
    useCases: ['Embeddings ultra-ligeros', 'Dispositivos limitados', 'Búsqueda rápida', 'Clasificación'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2'
);

const embeddings = await extractor('texto', { pooling: 'mean' });
// Solo 384 dimensiones - muy eficiente`,
    modelId: 'Xenova/all-MiniLM-L6-v2',
    docsUrl: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2',
    demoType: 'embedding'
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma-2-2b-it',
    rank: 14,
    category: 'llm',
    size: '2B parámetros',
    vram: '~1.9GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'La tecnología de Gemini de Google comprimida.',
    whyTop: 'Excelente seguimiento de instrucciones, multilingüe, y muy bien entrenado para ser seguro y útil.',
    useCases: ['Chat multilingüe', 'Instrucciones seguras', 'Asistentes', 'Traducción'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("gemma-2-2b-it-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Explain quantum computing" }]
});`,
    modelId: 'gemma-2-2b-it-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/google/gemma-2-2b-it',
    demoType: 'text'
  },
  {
    id: 'sam',
    name: 'Segment Anything (SAM)',
    rank: 15,
    category: 'vision',
    size: 'Variable (encoder + decoder)',
    vram: '~1-2GB',
    framework: 'ONNX Runtime Web',
    innovationScore: 4,
    description: 'Segmentación interactiva en el navegador.',
    whyTop: 'Meta\'s SAM permite a usuarios seleccionar y segmentar cualquier objeto en una imagen con clics. Revoluciona herramientas de edición de fotos. WebGPU acelera 19x vs CPU.',
    useCases: ['Edición de fotos', 'Selección de objetos', 'Recorte inteligente', 'Máscaras'],
    codeExample: `import * as ort from 'onnxruntime-web/webgpu';

// Cargar SAM encoder y decoder
const encoder = await ort.InferenceSession.create('sam_encoder.onnx');
const decoder = await ort.InferenceSession.create('sam_decoder.onnx');

// Codificar imagen una vez
const imageEmbed = await encoder.run({ image: imageData });

// Decodificar con puntos de click
const mask = await decoder.run({
  image_embeddings: imageEmbed,
  point_coords: [[x, y]], // Click del usuario
  point_labels: [1] // 1 = incluir, 0 = excluir
});`,
    modelId: 'segment-anything-onnx',
    docsUrl: 'https://segment-anything.com/',
    demoType: 'image'
  },
  {
    id: 'musicgen',
    name: 'MusicGen',
    rank: 16,
    category: 'generation',
    size: '300M - 1.5B parámetros',
    vram: '~1-3GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Genera música original basada en prompts de texto.',
    whyTop: 'Habilita aplicaciones de creatividad musical, generación de soundtracks, y herramientas para creadores de contenido.',
    useCases: ['Generación de música', 'Soundtracks', 'Creatividad', 'Background music'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const musicGen = await pipeline(
  'text-to-audio',
  'Xenova/musicgen-small'
);

const audio = await musicGen(
  "upbeat electronic dance music with synths",
  { max_new_tokens: 500 }
);

// Reproducir audio generado
const audioBlob = new Blob([audio], { type: 'audio/wav' });
const audioUrl = URL.createObjectURL(audioBlob);`,
    modelId: 'Xenova/musicgen-small',
    docsUrl: 'https://huggingface.co/facebook/musicgen-small',
    demoType: 'audio'
  },
  {
    id: 'smollm2',
    name: 'SmolLM2-135M/360M',
    rank: 17,
    category: 'llm',
    size: '135M / 360M parámetros',
    vram: '~300MB - 700MB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Increíblemente pequeño pero sorprendentemente capaz.',
    whyTop: 'Ideal para dispositivos con recursos muy limitados o cuando necesitas respuestas instantáneas sin importar que sean menos sofisticadas.',
    useCases: ['Dispositivos limitados', 'Respuestas rápidas', 'IoT', 'Edge computing'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("SmolLM2-360M-Instruct-q4f16_1-MLC");

// Ultra rápido - ideal para autocompletado
const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Complete: The weather is" }],
  max_tokens: 20
});`,
    modelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct',
    demoType: 'text'
  },
  {
    id: 'trocr',
    name: 'TrOCR',
    rank: 18,
    category: 'vision',
    size: '~334M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Microsoft\'s transformer-based OCR.',
    whyTop: 'Superior a OCR tradicional especialmente para textos manuscritos y documentos complejos. Funciona completamente en el navegador.',
    useCases: ['OCR manuscrito', 'Documentos', 'Formularios', 'Digitalización'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const ocr = await pipeline(
  'image-to-text',
  'Xenova/trocr-base-handwritten'
);

// OCR de texto manuscrito
const result = await ocr(handwrittenImage);
console.log(result[0].generated_text);`,
    modelId: 'Xenova/trocr-base-handwritten',
    docsUrl: 'https://huggingface.co/microsoft/trocr-base-handwritten',
    demoType: 'image'
  },
  {
    id: 'depth-pro',
    name: 'Depth Pro',
    rank: 19,
    category: 'vision',
    size: '~300M parámetros',
    vram: '~600MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Apple\'s modelo de estimación de profundidad.',
    whyTop: 'Convierte cualquier imagen 2D en un mapa de profundidad 3D en <1 segundo. Habilita efectos de blur de retrato, AR sin sensores especiales.',
    useCases: ['Estimación de profundidad', 'Blur de retrato', 'AR', 'Efectos 3D'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const depthEstimator = await pipeline(
  'depth-estimation',
  'Xenova/depth-pro',
  { device: "webgpu" }
);

const depth = await depthEstimator(image);
// depth.depth contiene el mapa de profundidad`,
    modelId: 'Xenova/depth-pro',
    docsUrl: 'https://huggingface.co/apple/depth-pro',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'Inaccesible: Error 401 Unauthorized al descargar config.json (Xenova/depth-pro).'
  },
  {
    id: 'detr',
    name: 'DETR / RT-DETR',
    rank: 20,
    category: 'vision',
    size: '41M - 100M parámetros',
    vram: '~200MB - 500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Detection Transformer de Facebook.',
    whyTop: 'Detecta y localiza objetos en imágenes con bounding boxes. RT-DETR es la versión en tiempo real. Ideal para apps de inventario, seguridad, etc.',
    useCases: ['Detección de objetos', 'Inventario', 'Seguridad', 'Análisis de imágenes'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const detector = await pipeline(
  'object-detection',
  'Xenova/detr-resnet-50',
  { device: "webgpu" }
);

const objects = await detector(image);
// objects contiene: [{ label, score, box: {xmin, ymin, xmax, ymax} }]`,
    modelId: 'Xenova/detr-resnet-50',
    docsUrl: 'https://huggingface.co/facebook/detr-resnet-50',
    demoType: 'image'
  }
];

// Models 21-30 - High Innovation LLMs
export const MODELS_21_30: ModelConfig[] = [
  {
    id: 'hermes-3-llama',
    name: 'Hermes-3-Llama-3.2-3B',
    rank: 21,
    category: 'llm',
    size: '3B parámetros',
    vram: '~2.9GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo optimizado para function calling y structured output.',
    whyTop: 'Excelente para crear agentes que necesitan llamar APIs, generar JSON estructurado, y seguir instrucciones complejas.',
    useCases: ['Function calling', 'JSON mode', 'Agentes AI', 'APIs'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Hermes-3-Llama-3.2-3B-q4f16_1-MLC");

// Function calling
const tools = [{
  type: "function",
  function: {
    name: "get_weather",
    parameters: { type: "object", properties: { city: { type: "string" } } }
  }
}];

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "What's the weather in Madrid?" }],
  tools
});`,
    modelId: 'Hermes-3-Llama-3.2-3B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.2-3B',
    demoType: 'text'
  },
  {
    id: 'mistral-7b',
    name: 'Mistral-7B-v0.3',
    rank: 22,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo general de alto rendimiento de Mistral AI.',
    whyTop: 'Balance perfecto entre calidad y velocidad. Requiere GPU potente pero ofrece respuestas de alta calidad para tareas generales.',
    useCases: ['Chat general', 'Escritura creativa', 'Análisis', 'Resumen'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Mistral-7B-Instruct-v0.3-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Write a haiku about coding" }],
  temperature: 0.7
});`,
    modelId: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.3',
    demoType: 'text'
  },
  {
    id: 'qwen2-5-3b',
    name: 'Qwen2.5-3B-Instruct',
    rank: 23,
    category: 'llm',
    size: '3B parámetros',
    vram: '~2.5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo multilingüe con excelente soporte para chino e inglés.',
    whyTop: 'El mejor modelo para aplicaciones multilingües, especialmente chino. Calidad comparable a modelos más grandes.',
    useCases: ['Multilingüe', 'Chino-Inglés', 'Traducción', 'Chat'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Qwen2.5-3B-Instruct-q4f16_1-MLC");

// Multilingüe
const reply = await engine.chat.completions.create({
  messages: [
    { role: "user", content: "Translate to Chinese: Hello, how are you?" }
  ]
});`,
    modelId: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct',
    demoType: 'text'
  },
  {
    id: 'phi-4-mini',
    name: 'Phi-4-mini-reasoning',
    rank: 24,
    category: 'llm',
    size: '3.8B parámetros',
    vram: '~2GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Modelo de razonamiento sintético de Microsoft.',
    whyTop: 'Entrenado con datos sintéticos de alta calidad para tareas de razonamiento. Excelente para matemáticas y lógica.',
    useCases: ['Razonamiento', 'Matemáticas', 'Lógica', 'Problemas'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text-generation",
  "onnx-community/Phi-4-mini-reasoning",
  { device: "webgpu" }
);

const result = await generator(
  "Solve: A train travels 120km in 2 hours. What is its speed?",
  { max_new_tokens: 200 }
);`,
    modelId: 'onnx-community/Phi-4-mini-reasoning',
    docsUrl: 'https://huggingface.co/microsoft/Phi-4-mini-instruct',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'deepseek-r1-llama-8b',
    name: 'DeepSeek-R1-Distill-Llama-8B',
    rank: 25,
    category: 'llm',
    size: '8B parámetros',
    vram: '~5-6GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Versión más grande del modelo de razonamiento DeepSeek.',
    whyTop: 'Razonamiento avanzado con mayor capacidad. Requiere GPU potente pero ofrece pensamiento más profundo.',
    useCases: ['Razonamiento complejo', 'Análisis', 'Problemas difíciles', 'Código'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Think step by step: If 5 machines can make 5 widgets in 5 minutes..."
  }]
});`,
    modelId: 'DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
    demoType: 'text'
  },
  {
    id: 'hermes-2-pro',
    name: 'Hermes-2-Pro-Llama-3-8B',
    rank: 26,
    category: 'llm',
    size: '8B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo avanzado para tool use y agentes.',
    whyTop: 'Especializado en uso de herramientas con formato estructurado. Ideal para construir agentes AI complejos.',
    useCases: ['Tool use', 'Agentes', 'Automatización', 'Multi-step tasks'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC");

// Tool use avanzado
const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Search for flights and book the cheapest one" }],
  tools: [/* flight tools definition */]
});`,
    modelId: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/NousResearch/Hermes-2-Pro-Llama-3-8B',
    demoType: 'text'
  },
  {
    id: 'neuralhermes',
    name: 'NeuralHermes-2.5-Mistral-7B',
    rank: 27,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Fine-tune creativo de Mistral para escritura.',
    whyTop: 'Optimizado para generación creativa y storytelling. Excelente para escritura de ficción y contenido.',
    useCases: ['Escritura creativa', 'Storytelling', 'Ficción', 'Contenido'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Write a short story about a robot learning to paint"
  }],
  temperature: 0.9
});`,
    modelId: 'NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/mlabonne/NeuralHermes-2.5-Mistral-7B',
    demoType: 'text'
  },
  {
    id: 'openhermes',
    name: 'OpenHermes-2.5-Mistral-7B',
    rank: 28,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Modelo general entrenado con datos curados.',
    whyTop: 'Entrenado con dataset curado de alta calidad. Bueno para instrucciones generales y tareas variadas.',
    useCases: ['Instrucciones', 'General purpose', 'Q&A', 'Asistente'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("OpenHermes-2.5-Mistral-7B-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Explain photosynthesis simply" }]
});`,
    modelId: 'OpenHermes-2.5-Mistral-7B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/teknium/OpenHermes-2.5-Mistral-7B',
    demoType: 'text'
  },
  {
    id: 'gemma-2-9b',
    name: 'Gemma-2-9b-it',
    rank: 29,
    category: 'llm',
    size: '9B parámetros',
    vram: '~6.4GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo grande de Google con calidad Gemini.',
    whyTop: 'La mejor calidad de la familia Gemma. Requiere más VRAM pero ofrece respuestas más sofisticadas.',
    useCases: ['Alta calidad', 'Análisis complejo', 'Escritura', 'Razonamiento'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("gemma-2-9b-it-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Analyze the pros and cons of remote work"
  }]
});`,
    modelId: 'gemma-2-9b-it-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/google/gemma-2-9b-it',
    demoType: 'text'
  },
  {
    id: 'llama-3-1-8b',
    name: 'Llama-3.1-8B-Instruct',
    rank: 30,
    category: 'llm',
    size: '8B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo con contexto 128K y tool use nativo.',
    whyTop: 'Contexto ultra largo de 128K tokens. Ideal para RAG con documentos extensos y conversaciones largas.',
    useCases: ['Contexto largo', 'RAG', 'Documentos', 'Tool use'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Llama-3.1-8B-Instruct-q4f16_1-MLC");

// Contexto largo - hasta 128K tokens
const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: \`Summarize this long document: \${longDocument}\`
  }]
});`,
    modelId: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct',
    demoType: 'text'
  }
];

// Models 31-40 - Vision Models
export const MODELS_31_40: ModelConfig[] = [
  {
    id: 'clip',
    name: 'CLIP (OpenAI)',
    rank: 31,
    category: 'multimodal',
    size: '428M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Embeddings imagen-texto de OpenAI.',
    whyTop: 'Revolucionó la conexión entre imágenes y texto. Permite búsqueda de imágenes por texto y clasificación zero-shot.',
    useCases: ['Image search', 'Zero-shot classification', 'Embeddings multimodal', 'Similarity'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "zero-shot-image-classification",
  "Xenova/clip-vit-base-patch32"
);

const result = await classifier(image, ["a cat", "a dog", "a bird"]);
// Returns probabilities for each label`,
    modelId: 'Xenova/clip-vit-base-patch32',
    docsUrl: 'https://huggingface.co/openai/clip-vit-base-patch32',
    demoType: 'multimodal'
  },
  {
    id: 'siglip',
    name: 'SigLIP',
    rank: 32,
    category: 'multimodal',
    size: '400M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Versión mejorada de CLIP por Google.',
    whyTop: 'Mejor que CLIP original en tareas de clasificación y retrieval. Función sigmoid en lugar de softmax.',
    useCases: ['Image classification', 'Retrieval mejorado', 'Zero-shot', 'Fine-tuning'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "zero-shot-image-classification",
  "Xenova/siglip-base-patch16-224"
);

const result = await classifier(image, ["photo", "drawing", "painting"]);`,
    modelId: 'Xenova/siglip-base-patch16-224',
    docsUrl: 'https://huggingface.co/google/siglip-base-patch16-224',
    demoType: 'multimodal'
  },
  {
    id: 'dinov2',
    name: 'DINOv2',
    rank: 33,
    category: 'vision',
    size: '300M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Feature extraction visual self-supervised de Meta.',
    whyTop: 'Extrae features visuales universales sin necesidad de texto. Ideal para clustering de imágenes y similitud visual.',
    useCases: ['Feature extraction', 'Image clustering', 'Visual similarity', 'Transfer learning'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "image-feature-extraction",
  "Xenova/dinov2-small"
);

const features = await extractor(image);
// 384-dimensional feature vector`,
    modelId: 'Xenova/dinov2-small',
    docsUrl: 'https://huggingface.co/facebook/dinov2-small',
    demoType: 'image'
  },
  {
    id: 'qwen2-vl-2b',
    name: 'Qwen2-VL-2B',
    rank: 34,
    category: 'multimodal',
    size: '2B parámetros',
    vram: '~2GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Modelo vision-language multilingüe de Alibaba.',
    whyTop: 'VQA multilingüe con soporte nativo para chino. Entiende imágenes y responde preguntas en múltiples idiomas.',
    useCases: ['VQA multilingüe', 'Descripción de imágenes', 'OCR', 'Análisis visual'],
    codeExample: `import { Qwen2VLForConditionalGeneration } from "@huggingface/transformers";

const model = await Qwen2VLForConditionalGeneration.from_pretrained(
  "onnx-community/Qwen2-VL-2B-Instruct",
  { device: "webgpu" }
);

const result = await model.generate({
  image: imageElement,
  prompt: "Describe esta imagen en español"
});`,
    modelId: 'onnx-community/Qwen2-VL-2B-Instruct',
    docsUrl: 'https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct',
    demoType: 'multimodal'
  },
  {
    id: 'llava',
    name: 'LLaVA',
    rank: 35,
    category: 'multimodal',
    size: '7B+ parámetros',
    vram: '~5GB+',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Vision-language model completo con capacidad de chat.',
    whyTop: 'Combina visión y lenguaje para conversaciones sobre imágenes. Requiere GPU potente pero muy capaz.',
    useCases: ['Visual chat', 'Image understanding', 'Multi-turn VQA', 'Analysis'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("llava-1.5-7b-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: [
      { type: "image", image: imageBase64 },
      { type: "text", text: "What's happening in this image?" }
    ]
  }]
});`,
    modelId: 'llava-1.5-7b-q4f16_1-MLC',
    docsUrl: 'https://llava-vl.github.io/',
    demoType: 'multimodal'
  },
  {
    id: 'mobilenetv4',
    name: 'MobileNetV4',
    rank: 36,
    category: 'vision',
    size: '6M parámetros',
    vram: '~50MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Clasificación de imágenes ultra-rápida.',
    whyTop: 'El modelo más rápido para clasificación. Ideal para aplicaciones móviles y en tiempo real.',
    useCases: ['Clasificación rápida', 'Mobile apps', 'Real-time', 'Edge devices'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "onnx-community/mobilenetv4_conv_small.e2400_r224_in1k",
  { device: "webgpu" }
);

const result = await classifier(image);
// [{ label: "cat", score: 0.95 }, ...]`,
    modelId: 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k',
    docsUrl: 'https://huggingface.co/timm/mobilenetv4_conv_small.e2400_r224_in1k',
    demoType: 'image'
  },
  {
    id: 'efficientnet',
    name: 'EfficientNet',
    rank: 37,
    category: 'vision',
    size: '5-66M parámetros',
    vram: '~50-200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Clasificación eficiente con buen balance.',
    whyTop: 'Familia de modelos con diferentes tamaños. Elige según tus recursos: B0 para velocidad, B7 para precisión.',
    useCases: ['Clasificación eficiente', 'Scalable', 'Production', 'Fine-tuning'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/efficientnet-b0"
);

const result = await classifier(image);`,
    modelId: 'Xenova/efficientnet-b0',
    docsUrl: 'https://huggingface.co/google/efficientnet-b0',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'vit',
    name: 'ViT (Vision Transformer)',
    rank: 38,
    category: 'vision',
    size: '86M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'El transformer original para visión.',
    whyTop: 'Pionero en aplicar transformers a imágenes. Buen baseline para muchas tareas de visión.',
    useCases: ['Clasificación base', 'Transfer learning', 'Feature extraction', 'Fine-tuning'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/vit-base-patch16-224"
);

const result = await classifier(image);`,
    modelId: 'Xenova/vit-base-patch16-224',
    docsUrl: 'https://huggingface.co/google/vit-base-patch16-224',
    demoType: 'image'
  },
  {
    id: 'fastvit',
    name: 'FastViT',
    rank: 39,
    category: 'vision',
    size: '50M parámetros',
    vram: '~100MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'ViT optimizado para velocidad.',
    whyTop: 'Combina la calidad de ViT con velocidad de MobileNet. Buen compromiso para producción.',
    useCases: ['Fast inference', 'Production', 'Mobile', 'Real-time'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/fastvit-t8"
);

const result = await classifier(image);`,
    modelId: 'Xenova/fastvit-t8',
    docsUrl: 'https://huggingface.co/apple/fastvit-t8',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'hiera',
    name: 'Hiera',
    rank: 40,
    category: 'vision',
    size: '100M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Visión jerárquica de Meta.',
    whyTop: 'Procesa imágenes de forma jerárquica para mejor eficiencia. Bueno para múltiples escalas.',
    useCases: ['Multi-scale vision', 'Hierarchical features', 'Efficient processing', 'Research'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/hiera-small-224"
);

const result = await classifier(image);`,
    modelId: 'Xenova/hiera-small-224',
    docsUrl: 'https://huggingface.co/facebook/hiera-small-224',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  }
];

// Models 41-50 - Audio Models
export const MODELS_41_50: ModelConfig[] = [
  {
    id: 'whisper-medium',
    name: 'Whisper-medium',
    rank: 41,
    category: 'audio',
    size: '769M parámetros',
    vram: '~1.5GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Transcripción de alta calidad con mejor precisión.',
    whyTop: 'Balance perfecto entre calidad y velocidad. Mejor que tiny/base para audio difícil o acentos.',
    useCases: ['Transcripción precisa', 'Acentos', 'Audio difícil', 'Multiidioma'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-medium",
  { device: "webgpu" }
);

const result = await transcriber(audioBlob, {
  language: "spanish",
  task: "transcribe"
});`,
    modelId: 'onnx-community/whisper-medium',
    docsUrl: 'https://huggingface.co/openai/whisper-medium',
    demoType: 'audio',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'whisper-large-v3',
    name: 'Whisper-large-v3',
    rank: 42,
    category: 'audio',
    size: '1.5B parámetros',
    vram: '~3GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Máxima calidad de transcripción de OpenAI.',
    whyTop: 'El mejor modelo de transcripción disponible. Requiere más recursos pero ofrece precisión profesional.',
    useCases: ['Máxima precisión', 'Profesional', '100+ idiomas', 'Subtítulos'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/whisper-large-v3",
  { device: "webgpu" }
);

const result = await transcriber(audioBlob);`,
    modelId: 'onnx-community/whisper-large-v3',
    docsUrl: 'https://huggingface.co/openai/whisper-large-v3',
    demoType: 'audio',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'moonshine',
    name: 'Moonshine',
    rank: 43,
    category: 'audio',
    size: '130M parámetros',
    vram: '~300MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Transcripción en vivo ultra-rápida.',
    whyTop: 'Optimizado para streaming en tiempo real. 5x más rápido que Whisper con calidad comparable.',
    useCases: ['Streaming', 'Tiempo real', 'Baja latencia', 'Live captions'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "onnx-community/moonshine-base",
  { device: "webgpu" }
);

// Real-time streaming
const stream = await transcriber.transcribe(audioStream, {
  return_timestamps: true
});`,
    modelId: 'onnx-community/moonshine-base',
    docsUrl: 'https://huggingface.co/UsefulSensors/moonshine',
    demoType: 'audio',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'voxtral-mini',
    name: 'Voxtral-Mini-3B',
    rank: 44,
    category: 'audio',
    size: '3B parámetros',
    vram: '~2GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Audio understanding + transcripción de Mistral.',
    whyTop: 'No solo transcribe, entiende el contenido del audio. Puede responder preguntas sobre lo que escucha.',
    useCases: ['Audio understanding', 'Audio Q&A', 'Análisis de podcasts', 'Meeting summaries'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const audioModel = await pipeline(
  "audio-text",
  "onnx-community/voxtral-mini-3b"
);

const result = await audioModel({
  audio: audioBlob,
  prompt: "Summarize the main points discussed"
});`,
    modelId: 'onnx-community/voxtral-mini-3b',
    docsUrl: 'https://huggingface.co/mistralai/Voxtral-Mini-3B',
    demoType: 'audio',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'clap',
    name: 'CLAP',
    rank: 45,
    category: 'audio',
    size: '200M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Embeddings texto-audio como CLIP para imágenes.',
    whyTop: 'Permite buscar audio por texto y clasificar sonidos zero-shot. Como CLIP pero para audio.',
    useCases: ['Audio search', 'Sound classification', 'Audio-text matching', 'Zero-shot audio'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "zero-shot-audio-classification",
  "Xenova/clap-htsat-unfused"
);

const result = await classifier(audio, ["music", "speech", "noise"]);`,
    modelId: 'Xenova/clap-htsat-unfused',
    docsUrl: 'https://huggingface.co/laion/clap-htsat-unfused',
    demoType: 'audio'
  },
  {
    id: 'wavlm',
    name: 'WavLM',
    rank: 46,
    category: 'audio',
    size: '95M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Extracción de features de voz de Microsoft.',
    whyTop: 'Features de alta calidad para downstream tasks. Bueno para speaker verification y emotion detection.',
    useCases: ['Speech features', 'Speaker ID', 'Emotion detection', 'Voice cloning prep'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/wavlm-base"
);

const features = await extractor(audio);`,
    modelId: 'Xenova/wavlm-base',
    docsUrl: 'https://huggingface.co/microsoft/wavlm-base',
    demoType: 'audio'
  },
  {
    id: 'wav2vec2',
    name: 'Wav2Vec2',
    rank: 47,
    category: 'audio',
    size: '95M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'ASR y representación de voz de Meta.',
    whyTop: 'Modelo base para muchas tareas de voz. Puede fine-tunearse para diferentes idiomas.',
    useCases: ['ASR base', 'Speech representation', 'Fine-tuning', 'Multilingual ASR'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const transcriber = await pipeline(
  "automatic-speech-recognition",
  "Xenova/wav2vec2-base-960h"
);

const result = await transcriber(audio);`,
    modelId: 'Xenova/wav2vec2-base-960h',
    docsUrl: 'https://huggingface.co/facebook/wav2vec2-base-960h',
    demoType: 'audio'
  },
  {
    id: 'speecht5',
    name: 'SpeechT5',
    rank: 48,
    category: 'audio',
    size: '144M parámetros',
    vram: '~300MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Modelo unificado para TTS y más.',
    whyTop: 'Un solo modelo para text-to-speech, speech-to-text, y voice conversion. Muy versátil.',
    useCases: ['Text-to-speech', 'Voice conversion', 'Speech enhancement', 'TTS apps'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const synthesizer = await pipeline(
  "text-to-speech",
  "Xenova/speecht5_tts"
);

const audio = await synthesizer("Hello, this is a test.");
// Returns audio waveform`,
    modelId: 'Xenova/speecht5_tts',
    docsUrl: 'https://huggingface.co/microsoft/speecht5_tts',
    demoType: 'audio'
  },
  {
    id: 'pyannote',
    name: 'PyAnnote (Speaker Diarization)',
    rank: 49,
    category: 'audio',
    size: '100M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Identifica quién habla en audio.',
    whyTop: 'Segmenta audio por hablante. Esencial para transcripciones de reuniones y podcasts.',
    useCases: ['Speaker diarization', 'Meeting transcription', 'Podcasts', 'Multi-speaker'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const diarizer = await pipeline(
  "automatic-speech-recognition",
  "Xenova/pyannote-speaker-diarization"
);

const result = await diarizer(audio);
// Returns: [{ speaker: "SPEAKER_1", start: 0, end: 2.5 }, ...]`,
    modelId: 'Xenova/pyannote-speaker-diarization',
    docsUrl: 'https://huggingface.co/pyannote/speaker-diarization',
    demoType: 'audio',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'unispeech',
    name: 'UniSpeech',
    rank: 50,
    category: 'audio',
    size: '95M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Representación universal de voz.',
    whyTop: 'Pre-entrenado para múltiples tareas de voz. Buen punto de partida para proyectos de audio.',
    useCases: ['Speech representation', 'Pre-training', 'Transfer learning', 'Audio tasks'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/unispeech-sat-base"
);

const features = await extractor(audio);`,
    modelId: 'Xenova/unispeech-sat-base',
    docsUrl: 'https://huggingface.co/microsoft/unispeech-sat-base',
    demoType: 'audio'
  }
];

// Models 51-60 - Specialized NLP Models
export const MODELS_51_60: ModelConfig[] = [
  {
    id: 'bge-base',
    name: 'BGE-base-en-v1.5',
    rank: 51,
    category: 'embedding',
    size: '109M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Embeddings optimizados para retrieval.',
    whyTop: 'BAAI General Embedding - top performer en benchmarks de retrieval. Ideal para RAG.',
    useCases: ['RAG', 'Document retrieval', 'Semantic search', 'Question answering'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/bge-base-en-v1.5"
);

// Para queries, añadir prefijo
const queryEmbed = await extractor("Represent this query: " + query);
const docEmbed = await extractor(document);`,
    modelId: 'Xenova/bge-base-en-v1.5',
    docsUrl: 'https://huggingface.co/BAAI/bge-base-en-v1.5',
    demoType: 'embedding'
  },
  {
    id: 'e5-large',
    name: 'E5-large',
    rank: 52,
    category: 'embedding',
    size: '335M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Embeddings multilingües de Microsoft.',
    whyTop: 'Excelente para búsqueda multilingüe. Soporta 100+ idiomas con alta calidad.',
    useCases: ['Multilingual search', 'Cross-lingual retrieval', 'International apps', 'Translation search'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/multilingual-e5-large"
);

// Funciona con múltiples idiomas
const embed = await extractor("query: buscar documentos");`,
    modelId: 'Xenova/multilingual-e5-large',
    docsUrl: 'https://huggingface.co/intfloat/multilingual-e5-large',
    demoType: 'embedding'
  },
  {
    id: 'gte-large',
    name: 'GTE-large',
    rank: 53,
    category: 'embedding',
    size: '335M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'General Text Embeddings de Alibaba.',
    whyTop: 'Alto rendimiento en múltiples benchmarks. Buena alternativa a BGE y E5.',
    useCases: ['General embeddings', 'Text similarity', 'Clustering', 'Classification'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/gte-large"
);

const embedding = await extractor(text, { pooling: "mean" });`,
    modelId: 'Xenova/gte-large',
    docsUrl: 'https://huggingface.co/thenlper/gte-large',
    demoType: 'embedding'
  },
  {
    id: 'mxbai-embed',
    name: 'mxbai-embed-xsmall-v1',
    rank: 54,
    category: 'embedding',
    size: '22M parámetros',
    vram: '~50MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Embeddings ultra-pequeños.',
    whyTop: 'El más pequeño de alta calidad. Para cuando cada MB cuenta.',
    useCases: ['Ultra-light apps', 'Mobile', 'Edge devices', 'Fast embeddings'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/mxbai-embed-xsmall-v1"
);

const embed = await extractor(text);`,
    modelId: 'Xenova/mxbai-embed-xsmall-v1',
    docsUrl: 'https://huggingface.co/mixedbread-ai/mxbai-embed-xsmall-v1',
    demoType: 'embedding',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'distilbert',
    name: 'DistilBERT',
    rank: 55,
    category: 'embedding',
    size: '66M parámetros',
    vram: '~150MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'BERT destilado para clasificación.',
    whyTop: '60% más rápido que BERT con 97% de su rendimiento. Ideal para clasificación de texto.',
    useCases: ['Text classification', 'Sentiment', 'NLU', 'Fast inference'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
);

const result = await classifier("I love this product!");
// { label: "POSITIVE", score: 0.99 }`,
    modelId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    docsUrl: 'https://huggingface.co/distilbert-base-uncased',
    demoType: 'text'
  },
  {
    id: 'roberta',
    name: 'RoBERTa',
    rank: 56,
    category: 'embedding',
    size: '125M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'BERT optimizado para NLU.',
    whyTop: 'Mejor entrenamiento que BERT original. Standard para muchas tareas de NLU.',
    useCases: ['NLU', 'Text understanding', 'Fine-tuning', 'Classification'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/roberta-base"
);

const result = await classifier(text);`,
    modelId: 'Xenova/roberta-base',
    docsUrl: 'https://huggingface.co/roberta-base',
    demoType: 'text'
  },
  {
    id: 'bert-base',
    name: 'BERT-base',
    rank: 57,
    category: 'embedding',
    size: '110M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'El modelo NLU clásico.',
    whyTop: 'El que empezó todo. Sigue siendo útil como baseline y para tareas específicas.',
    useCases: ['NLU baseline', 'Fine-tuning', 'Education', 'Comparison'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const fillMask = await pipeline(
  "fill-mask",
  "Xenova/bert-base-uncased"
);

const result = await fillMask("Paris is the [MASK] of France.");
// [{ token_str: "capital", score: 0.99 }, ...]`,
    modelId: 'Xenova/bert-base-uncased',
    docsUrl: 'https://huggingface.co/bert-base-uncased',
    demoType: 'text'
  },
  {
    id: 'xlm-roberta',
    name: 'XLM-RoBERTa',
    rank: 58,
    category: 'embedding',
    size: '278M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'RoBERTa multilingüe.',
    whyTop: 'El estándar para NLU multilingüe. Soporta 100+ idiomas.',
    useCases: ['Multilingual NLU', 'Cross-lingual', 'International apps', 'Translation'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/xlm-roberta-base"
);

// Funciona con cualquier idioma
const result = await classifier("Este producto es excelente");`,
    modelId: 'Xenova/xlm-roberta-base',
    docsUrl: 'https://huggingface.co/xlm-roberta-base',
    demoType: 'text'
  },
  {
    id: 'deberta',
    name: 'DeBERTa',
    rank: 59,
    category: 'embedding',
    size: '184M parámetros',
    vram: '~350MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'BERT mejorado de Microsoft.',
    whyTop: 'Mejor que BERT y RoBERTa en muchos benchmarks. Atención mejorada.',
    useCases: ['Advanced NLU', 'Question answering', 'NLI', 'High-accuracy tasks'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const qa = await pipeline(
  "question-answering",
  "Xenova/deberta-v3-base"
);

const result = await qa({
  question: "What is the capital?",
  context: "Paris is the capital of France."
});`,
    modelId: 'Xenova/deberta-v3-base',
    docsUrl: 'https://huggingface.co/microsoft/deberta-v3-base',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'electra',
    name: 'ELECTRA',
    rank: 60,
    category: 'embedding',
    size: '14M-335M parámetros',
    vram: '~50-500MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Detección de tokens reemplazados.',
    whyTop: 'Entrenamiento más eficiente que BERT. Buenos resultados con menos compute.',
    useCases: ['Efficient NLU', 'Token detection', 'Pre-training', 'Research'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/electra-small-discriminator"
);

const result = await classifier(text);`,
    modelId: 'Xenova/electra-small-discriminator',
    docsUrl: 'https://huggingface.co/google/electra-small-discriminator',
    demoType: 'text'
  }
];

// Models 61-70 - Code Models
export const MODELS_61_70: ModelConfig[] = [
  {
    id: 'codellama-7b',
    name: 'CodeLlama-7B',
    rank: 61,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo especializado en generación de código de Meta.',
    whyTop: 'El estándar para generación de código en local. Soporta múltiples lenguajes y completado de código.',
    useCases: ['Code generation', 'Code completion', 'Debugging', 'Refactoring'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("CodeLlama-7b-hf-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Write a Python function to find prime numbers"
  }]
});`,
    modelId: 'CodeLlama-7b-hf-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/codellama/CodeLlama-7b-hf',
    demoType: 'text'
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek-Coder-1.3B',
    rank: 62,
    category: 'llm',
    size: '1.3B parámetros',
    vram: '~1.2GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo de código ligero y potente.',
    whyTop: 'Excelente relación calidad/tamaño para código. Puede correr en GPUs modestas.',
    useCases: ['Lightweight code', 'Fast completion', 'Edge coding', 'Mobile dev'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("DeepSeek-Coder-1.3B-Instruct-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Implement a binary search in JavaScript"
  }]
});`,
    modelId: 'DeepSeek-Coder-1.3B-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/deepseek-ai/deepseek-coder-1.3b-instruct',
    demoType: 'text'
  },
  {
    id: 'starcoder-1b',
    name: 'StarCoder-1B',
    rank: 63,
    category: 'llm',
    size: '1B parámetros',
    vram: '~1GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Modelo de código base de BigCode.',
    whyTop: 'Entrenado con The Stack - código open source. Bueno para autocompletado.',
    useCases: ['Code completion', 'Infill', 'Auto-complete', 'IDE integration'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("StarCoder-1B-q4f16_1-MLC");

// Completado de código
const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "def fibonacci(n):"
  }]
});`,
    modelId: 'StarCoder-1B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/bigcode/starcoder',
    demoType: 'text'
  },
  {
    id: 'codestral-mini',
    name: 'Codestral-mini',
    rank: 64,
    category: 'llm',
    size: '3B parámetros',
    vram: '~2.5GB',
    framework: 'WebLLM',
    innovationScore: 4,
    description: 'Modelo de código de Mistral AI.',
    whyTop: 'Balance entre tamaño y calidad de Mistral. Bueno para generación y explicación de código.',
    useCases: ['Code generation', 'Code explanation', 'Documentation', 'Reviews'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Codestral-mini-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{
    role: "user",
    content: "Explain this code and suggest improvements: ..."
  }]
});`,
    modelId: 'Codestral-mini-q4f16_1-MLC',
    docsUrl: 'https://mistral.ai/news/codestral/',
    demoType: 'text'
  },
  {
    id: 'granite-code',
    name: 'Granite-code-3b',
    rank: 65,
    category: 'llm',
    size: '3B parámetros',
    vram: '~2.5GB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Modelo de código de IBM.',
    whyTop: 'Entrenado con enfoque enterprise. Bueno para código de producción.',
    useCases: ['Enterprise code', 'Production code', 'Best practices', 'Security'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text-generation",
  "onnx-community/granite-3b-code-instruct",
  { device: "webgpu" }
);

const result = await generator(
  "Write a secure authentication function"
);`,
    modelId: 'onnx-community/granite-3b-code-instruct',
    docsUrl: 'https://huggingface.co/ibm-granite/granite-3b-code-instruct',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Repositorio onnx-community requiere autenticación'
  },
  {
    id: 'clipseg',
    name: 'CLIPSeg',
    rank: 66,
    category: 'vision',
    size: '200M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Segmentación guiada por texto.',
    whyTop: 'Segmenta imágenes usando prompts de texto. "Segmenta el gato" y lo hace.',
    useCases: ['Text-guided segmentation', 'Interactive editing', 'Object isolation', 'Creative tools'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const segmenter = await pipeline(
  "image-segmentation",
  "Xenova/clipseg-rd64-refined"
);

const result = await segmenter(image, {
  candidate_labels: ["cat", "dog", "background"]
});`,
    modelId: 'Xenova/clipseg-rd64-refined',
    docsUrl: 'https://huggingface.co/CIDAS/clipseg-rd64-refined',
    demoType: 'image'
  },
  {
    id: 'sapiens',
    name: 'Sapiens (Body Estimation)',
    rank: 67,
    category: 'vision',
    size: '300M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Estimación de pose y parsing corporal de Meta.',
    whyTop: 'Modelo avanzado para análisis corporal: pose, depth, normal maps, segmentación de partes.',
    useCases: ['Pose estimation', 'Body parsing', 'Fitness apps', 'AR/VR'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const poseEstimator = await pipeline(
  "image-to-image",
  "Xenova/sapiens-pose-1b"
);

const pose = await poseEstimator(image);
// Returns keypoints and body parts`,
    modelId: 'Xenova/sapiens-pose-1b',
    docsUrl: 'https://huggingface.co/facebook/sapiens',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'depth-anything',
    name: 'DepthAnything',
    rank: 68,
    category: 'vision',
    size: '300M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Estimación de profundidad robusta.',
    whyTop: 'Funciona bien en cualquier tipo de imagen. Más robusto que Depth Pro en escenas diversas.',
    useCases: ['Depth estimation', 'Robustness', 'Diverse scenes', '3D reconstruction'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const depthEstimator = await pipeline(
  "depth-estimation",
  "Xenova/depth-anything-small-hf"
);

const depth = await depthEstimator(image);`,
    modelId: 'Xenova/depth-anything-small-hf',
    docsUrl: 'https://huggingface.co/LiheYoung/depth-anything-small-hf',
    demoType: 'image'
  },
  {
    id: 'segformer',
    name: 'SegFormer',
    rank: 69,
    category: 'vision',
    size: '47M parámetros',
    vram: '~100MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Segmentación semántica eficiente.',
    whyTop: 'Modelo ligero para segmentación. Bueno para aplicaciones en tiempo real.',
    useCases: ['Semantic segmentation', 'Scene parsing', 'Real-time', 'Autonomous driving'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const segmenter = await pipeline(
  "image-segmentation",
  "Xenova/segformer-b0-finetuned-ade-512-512"
);

const segments = await segmenter(image);`,
    modelId: 'Xenova/segformer-b0-finetuned-ade-512-512',
    docsUrl: 'https://huggingface.co/nvidia/segformer-b0-finetuned-ade-512-512',
    demoType: 'image'
  },
  {
    id: 'yolos',
    name: 'YOLOS',
    rank: 70,
    category: 'vision',
    size: '86M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'YOLO con arquitectura transformer.',
    whyTop: 'Combina la velocidad de YOLO con transformers. Bueno para detección en tiempo real.',
    useCases: ['Object detection', 'Real-time', 'Surveillance', 'Counting'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const detector = await pipeline(
  "object-detection",
  "Xenova/yolos-tiny"
);

const objects = await detector(image);`,
    modelId: 'Xenova/yolos-tiny',
    docsUrl: 'https://huggingface.co/hustvl/yolos-tiny',
    demoType: 'image'
  }
];

// Models 71-80 - Advanced Vision Models
export const MODELS_71_80: ModelConfig[] = [
  {
    id: 'owlvit',
    name: 'OwlViT',
    rank: 71,
    category: 'vision',
    size: '428M parámetros',
    vram: '~600MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Detección zero-shot con texto.',
    whyTop: 'Detecta objetos solo describiendo qué buscar. No necesita entrenar en clases específicas.',
    useCases: ['Zero-shot detection', 'Open vocabulary', 'Custom objects', 'Flexible detection'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const detector = await pipeline(
  "zero-shot-object-detection",
  "Xenova/owlvit-base-patch32"
);

// Detecta cualquier cosa que describas
const result = await detector(image, {
  candidate_labels: ["a red car", "a person walking", "traffic sign"]
});`,
    modelId: 'Xenova/owlvit-base-patch32',
    docsUrl: 'https://huggingface.co/google/owlvit-base-patch32',
    demoType: 'image'
  },
  {
    id: 'grounding-dino',
    name: 'Grounding DINO',
    rank: 72,
    category: 'vision',
    size: '200M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Detección con grounding de texto.',
    whyTop: 'Combina DINO con grounding textual. Puede encontrar y localizar basado en descripciones.',
    useCases: ['Grounded detection', 'Visual grounding', 'Referring expressions', 'Interactive'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const detector = await pipeline(
  "zero-shot-object-detection",
  "Xenova/grounding-dino-tiny"
);

const result = await detector(image, {
  candidate_labels: ["the largest dog", "person on the left"]
});`,
    modelId: 'Xenova/grounding-dino-tiny',
    docsUrl: 'https://github.com/IDEA-Research/GroundingDINO',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'vitmae',
    name: 'ViTMAE',
    rank: 73,
    category: 'vision',
    size: '86M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Vision Transformer auto-supervisado.',
    whyTop: 'Pre-entrenado con masked autoencoding. Buenas representaciones visuales sin etiquetas.',
    useCases: ['Self-supervised', 'Feature learning', 'Pre-training', 'Transfer learning'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "image-feature-extraction",
  "Xenova/vit-mae-base"
);

const features = await extractor(image);`,
    modelId: 'Xenova/vit-mae-base',
    docsUrl: 'https://huggingface.co/facebook/vit-mae-base',
    demoType: 'image',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'swin',
    name: 'Swin Transformer',
    rank: 74,
    category: 'vision',
    size: '88M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Vision transformer con ventanas deslizantes.',
    whyTop: 'Eficiente para imágenes grandes. Buen baseline para muchas tareas de visión.',
    useCases: ['Classification', 'Detection backbone', 'Segmentation', 'Large images'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/swin-tiny-patch4-window7-224"
);

const result = await classifier(image);`,
    modelId: 'Xenova/swin-tiny-patch4-window7-224',
    docsUrl: 'https://huggingface.co/microsoft/swin-tiny-patch4-window7-224',
    demoType: 'image'
  },
  {
    id: 'convnext',
    name: 'ConvNeXt',
    rank: 75,
    category: 'vision',
    size: '88M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'CNN moderna que compite con transformers.',
    whyTop: 'Demuestra que CNNs bien diseñadas pueden igualar a ViT. Más eficiente en algunos casos.',
    useCases: ['Modern CNN', 'Efficient inference', 'Classification', 'Feature extraction'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "image-classification",
  "Xenova/convnext-tiny-224"
);

const result = await classifier(image);`,
    modelId: 'Xenova/convnext-tiny-224',
    docsUrl: 'https://huggingface.co/facebook/convnext-tiny-224',
    demoType: 'image'
  },
  {
    id: 'redpajama',
    name: 'RedPajama-3B',
    rank: 76,
    category: 'llm',
    size: '3B parámetros',
    vram: '~2.5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Reproducción open source de LLaMA.',
    whyTop: 'Completamente abierto y reproducible. Bueno para investigación y experimentación.',
    useCases: ['Open research', 'Reproducibility', 'Experimentation', 'Fine-tuning base'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Hello!" }]
});`,
    modelId: 'RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/togethercomputer/RedPajama-INCITE-Chat-3B-v1',
    demoType: 'text'
  },
  {
    id: 'pythia',
    name: 'Pythia-1.4B',
    rank: 77,
    category: 'llm',
    size: '1.4B parámetros',
    vram: '~1.5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Suite de modelos de EleutherAI.',
    whyTop: 'Diseñado para investigación de scaling. Checkpoints disponibles durante entrenamiento.',
    useCases: ['Research', 'Scaling studies', 'Interpretability', 'Academic'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Pythia-1.4B-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Explain neural networks" }]
});`,
    modelId: 'Pythia-1.4B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/EleutherAI/pythia-1.4b',
    demoType: 'text'
  },
  {
    id: 'mpt-7b',
    name: 'MPT-7B',
    rank: 78,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Modelo de MosaicML con ALiBi.',
    whyTop: 'Usa ALiBi para extrapolación de contexto. Puede manejar secuencias más largas que su entrenamiento.',
    useCases: ['Long context', 'ALiBi attention', 'Extrapolation', 'Enterprise'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("MPT-7B-Chat-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Hello" }]
});`,
    modelId: 'MPT-7B-Chat-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/mosaicml/mpt-7b',
    demoType: 'text'
  },
  {
    id: 'falcon-7b',
    name: 'Falcon-7B',
    rank: 79,
    category: 'llm',
    size: '7B parámetros',
    vram: '~5GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Modelo de TII (Technology Innovation Institute).',
    whyTop: 'Entrenado con RefinedWeb. Licencia permisiva para uso comercial.',
    useCases: ['Commercial use', 'General purpose', 'Permissive license', 'Production'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("Falcon-7B-Instruct-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "What is AI?" }]
});`,
    modelId: 'Falcon-7B-Instruct-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/tiiuae/falcon-7b-instruct',
    demoType: 'text'
  },
  {
    id: 'olmo',
    name: 'OLMo-1B',
    rank: 80,
    category: 'llm',
    size: '1B parámetros',
    vram: '~1GB',
    framework: 'WebLLM',
    innovationScore: 3,
    description: 'Modelo completamente abierto de AI2.',
    whyTop: 'Todo abierto: código, datos, pesos, checkpoints. El más transparente disponible.',
    useCases: ['Full transparency', 'Reproducibility', 'Research', 'Education'],
    codeExample: `import { CreateMLCEngine } from "@mlc-ai/web-llm";

const engine = await CreateMLCEngine("OLMo-1B-q4f16_1-MLC");

const reply = await engine.chat.completions.create({
  messages: [{ role: "user", content: "Tell me about open science" }]
});`,
    modelId: 'OLMo-1B-q4f16_1-MLC',
    docsUrl: 'https://huggingface.co/allenai/OLMo-1B',
    demoType: 'text'
  }
];

// Models 81-90 - Translation & Multilingual
export const MODELS_81_90: ModelConfig[] = [
  {
    id: 'mt5-small',
    name: 'mT5-small',
    rank: 81,
    category: 'llm',
    size: '300M parámetros',
    vram: '~500MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'T5 multilingüe para traducción.',
    whyTop: 'Soporta 101 idiomas. Bueno para tareas de traducción y text-to-text multilingüe.',
    useCases: ['Translation', 'Multilingual', 'Text-to-text', 'Summarization'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const translator = await pipeline(
  "translation",
  "Xenova/mt5-small"
);

const result = await translator("Hello, how are you?", {
  src_lang: "en",
  tgt_lang: "es"
});`,
    modelId: 'Xenova/mt5-small',
    docsUrl: 'https://huggingface.co/google/mt5-small',
    demoType: 'text'
  },
  {
    id: 'nllb-200',
    name: 'NLLB-200-600M',
    rank: 82,
    category: 'llm',
    size: '600M parámetros',
    vram: '~1GB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'No Language Left Behind - 200 idiomas.',
    whyTop: 'Meta\'s modelo que traduce entre 200 idiomas, incluyendo lenguas de bajos recursos.',
    useCases: ['200 languages', 'Low-resource', 'Inclusive translation', 'Rare languages'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const translator = await pipeline(
  "translation",
  "Xenova/nllb-200-distilled-600M"
);

const result = await translator("Hello world", {
  src_lang: "eng_Latn",
  tgt_lang: "spa_Latn"
});`,
    modelId: 'Xenova/nllb-200-distilled-600M',
    docsUrl: 'https://huggingface.co/facebook/nllb-200-distilled-600M',
    demoType: 'text'
  },
  {
    id: 'marian-mt',
    name: 'MarianMT',
    rank: 83,
    category: 'llm',
    size: '298M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Traducción para pares de idiomas específicos.',
    whyTop: 'Modelos optimizados para pares específicos. Muy rápido y preciso para idiomas soportados.',
    useCases: ['Language pairs', 'Fast translation', 'Specific languages', 'Production'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

// English to Spanish
const translator = await pipeline(
  "translation",
  "Xenova/opus-mt-en-es"
);

const result = await translator("Hello, how are you?");`,
    modelId: 'Xenova/opus-mt-en-es',
    docsUrl: 'https://huggingface.co/Helsinki-NLP/opus-mt-en-es',
    demoType: 'text'
  },
  {
    id: 'm2m100',
    name: 'M2M-100-418M',
    rank: 84,
    category: 'llm',
    size: '418M parámetros',
    vram: '~700MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Many-to-many translation sin inglés como pivote.',
    whyTop: 'Traduce directamente entre cualquier par de 100 idiomas sin pasar por inglés.',
    useCases: ['Direct translation', 'No pivot', 'Many-to-many', '100 languages'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const translator = await pipeline(
  "translation",
  "Xenova/m2m100_418M"
);

// Spanish to French directly
const result = await translator("Hola mundo", {
  src_lang: "es",
  tgt_lang: "fr"
});`,
    modelId: 'Xenova/m2m100_418M',
    docsUrl: 'https://huggingface.co/facebook/m2m100_418M',
    demoType: 'text'
  },
  {
    id: 'helsinki-nlp',
    name: 'Helsinki-NLP models',
    rank: 85,
    category: 'llm',
    size: 'Variable',
    vram: '~300-500MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Colección de modelos de traducción específicos.',
    whyTop: 'Gran colección de modelos para pares de idiomas específicos. Optimizados y ligeros.',
    useCases: ['Specific pairs', 'Optimized', 'Lightweight', 'Many options'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

// Muchos pares disponibles: en-de, en-fr, en-zh, etc.
const translator = await pipeline(
  "translation",
  "Xenova/opus-mt-en-de"
);

const result = await translator("Good morning");`,
    modelId: 'Xenova/opus-mt-en-de',
    docsUrl: 'https://huggingface.co/Helsinki-NLP',
    demoType: 'text'
  },
  {
    id: 'twitter-sentiment',
    name: 'Twitter-RoBERTa-Sentiment',
    rank: 86,
    category: 'embedding',
    size: '125M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Análisis de sentimiento para redes sociales.',
    whyTop: 'Entrenado específicamente con tweets. Entiende emojis, hashtags, y jerga social.',
    useCases: ['Social media', 'Twitter analysis', 'Sentiment', 'Brand monitoring'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/twitter-roberta-base-sentiment-latest"
);

const result = await classifier("This product is amazing! #love");
// { label: "positive", score: 0.98 }`,
    modelId: 'Xenova/twitter-roberta-base-sentiment-latest',
    docsUrl: 'https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest',
    demoType: 'text'
  },
  {
    id: 'finbert',
    name: 'FinBERT',
    rank: 87,
    category: 'embedding',
    size: '110M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Sentimiento financiero especializado.',
    whyTop: 'Entrenado con textos financieros. Entiende terminología de mercados y earnings calls.',
    useCases: ['Financial sentiment', 'Stock analysis', 'Earnings calls', 'Market news'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/finbert"
);

const result = await classifier("Revenue exceeded expectations this quarter");
// { label: "positive", score: 0.95 }`,
    modelId: 'Xenova/finbert',
    docsUrl: 'https://huggingface.co/ProsusAI/finbert',
    demoType: 'text'
  },
  {
    id: 'toxic-bert',
    name: 'Toxic-BERT',
    rank: 88,
    category: 'embedding',
    size: '110M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Detección de contenido tóxico.',
    whyTop: 'Detecta toxicidad, insultos, amenazas, y contenido inapropiado en texto.',
    useCases: ['Content moderation', 'Toxicity detection', 'Safe AI', 'Community guidelines'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/toxic-bert"
);

const result = await classifier("Your message here...");
// Returns toxicity score`,
    modelId: 'Xenova/toxic-bert',
    docsUrl: 'https://huggingface.co/unitary/toxic-bert',
    demoType: 'text'
  },
  {
    id: 'emotion-roberta',
    name: 'Emotion-English-DistilRoBERTa',
    rank: 89,
    category: 'embedding',
    size: '82M parámetros',
    vram: '~200MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Detección de emociones en texto.',
    whyTop: 'Detecta 6 emociones: joy, sadness, anger, fear, surprise, disgust.',
    useCases: ['Emotion detection', 'Customer feedback', 'Mental health', 'User experience'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/emotion-english-distilroberta-base"
);

const result = await classifier("I'm so happy today!");
// { label: "joy", score: 0.97 }`,
    modelId: 'Xenova/emotion-english-distilroberta-base',
    docsUrl: 'https://huggingface.co/j-hartmann/emotion-english-distilroberta-base',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'zero-shot',
    name: 'Zero-Shot Classification',
    rank: 90,
    category: 'embedding',
    size: '407M parámetros',
    vram: '~600MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'Clasificación sin ejemplos de entrenamiento.',
    whyTop: 'Clasifica en cualquier categoría que definas sin necesidad de fine-tuning.',
    useCases: ['Zero-shot', 'Custom categories', 'Flexible classification', 'No training'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "zero-shot-classification",
  "Xenova/bart-large-mnli"
);

const result = await classifier(
  "I want to buy a new phone",
  { candidate_labels: ["shopping", "travel", "work", "health"] }
);`,
    modelId: 'Xenova/bart-large-mnli',
    docsUrl: 'https://huggingface.co/facebook/bart-large-mnli',
    demoType: 'text'
  }
];

// Models 91-100 - Summarization, Q&A & NER
export const MODELS_91_100: ModelConfig[] = [
  {
    id: 'flan-t5',
    name: 'FLAN-T5-small',
    rank: 91,
    category: 'llm',
    size: '77M parámetros',
    vram: '~150MB',
    framework: 'Transformers.js',
    innovationScore: 4,
    description: 'T5 instruction-tuned de Google.',
    whyTop: 'Excelente seguimiento de instrucciones en tamaño pequeño. Versátil para muchas tareas.',
    useCases: ['Instructions', 'Q&A', 'Summarization', 'Text tasks'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text2text-generation",
  "Xenova/flan-t5-small"
);

const result = await generator("Summarize: " + longText);`,
    modelId: 'Xenova/flan-t5-small',
    docsUrl: 'https://huggingface.co/google/flan-t5-small',
    demoType: 'text'
  },
  {
    id: 'longt5',
    name: 'LongT5',
    rank: 92,
    category: 'llm',
    size: '220M parámetros',
    vram: '~400MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'T5 para documentos largos.',
    whyTop: 'Diseñado para procesar textos largos eficientemente. Ideal para resumir documentos extensos.',
    useCases: ['Long documents', 'Book summarization', 'Research papers', 'Reports'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const summarizer = await pipeline(
  "summarization",
  "Xenova/long-t5-local-base"
);

const result = await summarizer(veryLongDocument, {
  max_length: 200
});`,
    modelId: 'Xenova/long-t5-local-base',
    docsUrl: 'https://huggingface.co/google/long-t5-local-base',
    demoType: 'text'
  },
  {
    id: 'led',
    name: 'LED (Longformer Encoder-Decoder)',
    rank: 93,
    category: 'llm',
    size: '460M parámetros',
    vram: '~700MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Encoder-decoder para contexto largo.',
    whyTop: 'Hasta 16K tokens de contexto. Bueno para resumir documentos muy largos.',
    useCases: ['Very long context', 'Document summarization', '16K tokens', 'Legal docs'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const summarizer = await pipeline(
  "summarization",
  "Xenova/led-base-16384"
);

const result = await summarizer(legalDocument);`,
    modelId: 'Xenova/led-base-16384',
    docsUrl: 'https://huggingface.co/allenai/led-base-16384',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'bart-cnn',
    name: 'BART-large-CNN',
    rank: 94,
    category: 'llm',
    size: '406M parámetros',
    vram: '~600MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Resumen de noticias estilo CNN.',
    whyTop: 'Fine-tuned para resumir artículos de noticias. Produce resúmenes concisos y coherentes.',
    useCases: ['News summarization', 'Article summary', 'Journalism', 'Content'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const summarizer = await pipeline(
  "summarization",
  "Xenova/bart-large-cnn"
);

const result = await summarizer(newsArticle, {
  max_length: 130,
  min_length: 30
});`,
    modelId: 'Xenova/bart-large-cnn',
    docsUrl: 'https://huggingface.co/facebook/bart-large-cnn',
    demoType: 'text'
  },
  {
    id: 't5-small',
    name: 'T5-small',
    rank: 95,
    category: 'llm',
    size: '60M parámetros',
    vram: '~150MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Text-to-text transfer transformer original.',
    whyTop: 'El modelo que popularizó text-to-text. Versátil para traducción, resumen, Q&A.',
    useCases: ['Text-to-text', 'Multi-task', 'Baseline', 'Education'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const generator = await pipeline(
  "text2text-generation",
  "Xenova/t5-small"
);

const result = await generator("translate English to German: Hello");`,
    modelId: 'Xenova/t5-small',
    docsUrl: 'https://huggingface.co/t5-small',
    demoType: 'text'
  },
  {
    id: 'bert-ner',
    name: 'BERT-base-NER',
    rank: 96,
    category: 'embedding',
    size: '110M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Extracción de entidades nombradas.',
    whyTop: 'Identifica personas, organizaciones, lugares, y más en texto.',
    useCases: ['NER', 'Entity extraction', 'Information extraction', 'Knowledge graphs'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const ner = await pipeline(
  "token-classification",
  "Xenova/bert-base-NER"
);

const result = await ner("Bill Gates founded Microsoft in Seattle");
// [{ entity: "PER", word: "Bill Gates" }, ...]`,
    modelId: 'Xenova/bert-base-NER',
    docsUrl: 'https://huggingface.co/dslim/bert-base-NER',
    demoType: 'text'
  },
  {
    id: 'spacy-transformers',
    name: 'SpaCy-Transformers-en',
    rank: 97,
    category: 'embedding',
    size: 'Variable',
    vram: '~300MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'NER y parsing con transformers.',
    whyTop: 'Combina la practicidad de spaCy con el poder de transformers.',
    useCases: ['NLP pipeline', 'Parsing', 'NER', 'Production NLP'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const ner = await pipeline(
  "token-classification",
  "Xenova/bert-base-NER-uncased"
);

const entities = await ner(text);`,
    modelId: 'Xenova/bert-base-NER-uncased',
    docsUrl: 'https://spacy.io/usage/embeddings-transformers',
    demoType: 'text'
  },
  {
    id: 'keyphrase',
    name: 'Keyphrase-Extraction',
    rank: 98,
    category: 'embedding',
    size: '66M parámetros',
    vram: '~150MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Extracción de keywords y frases clave.',
    whyTop: 'Extrae automáticamente las palabras clave más importantes de un texto.',
    useCases: ['Keyphrase extraction', 'SEO', 'Tagging', 'Summarization'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const extractor = await pipeline(
  "token-classification",
  "Xenova/keyphrase-extraction-kbir-inspec"
);

const keyphrases = await extractor(text);`,
    modelId: 'Xenova/keyphrase-extraction-kbir-inspec',
    docsUrl: 'https://huggingface.co/ml6team/keyphrase-extraction-kbir-inspec',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'question-gen',
    name: 'Question-Generation',
    rank: 99,
    category: 'llm',
    size: '440M parámetros',
    vram: '~650MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Genera preguntas a partir de texto.',
    whyTop: 'Útil para crear quizzes, FAQs automáticas, y sistemas de estudio.',
    useCases: ['Quiz generation', 'FAQ', 'Education', 'Study tools'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const qg = await pipeline(
  "text2text-generation",
  "Xenova/t5-base-finetuned-question-generation-ap"
);

const question = await qg("generate question: " + context);`,
    modelId: 'Xenova/t5-base-finetuned-question-generation-ap',
    docsUrl: 'https://huggingface.co/mrm8488/t5-base-finetuned-question-generation-ap',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  },
  {
    id: 'multilabel',
    name: 'Text-Classification-Multilabel',
    rank: 100,
    category: 'embedding',
    size: '125M parámetros',
    vram: '~250MB',
    framework: 'Transformers.js',
    innovationScore: 3,
    description: 'Clasificación multi-etiqueta.',
    whyTop: 'Asigna múltiples etiquetas a un texto, no solo una. Útil para categorización compleja.',
    useCases: ['Multi-label', 'Complex categorization', 'Tagging', 'Content classification'],
    codeExample: `import { pipeline } from "@huggingface/transformers";

const classifier = await pipeline(
  "text-classification",
  "Xenova/distilbert-base-uncased-go-emotions"
);

// Puede retornar múltiples emociones
const result = await classifier("I'm happy but also a bit nervous", {
  top_k: 3
});`,
    modelId: 'Xenova/distilbert-base-uncased-go-emotions',
    docsUrl: 'https://huggingface.co/SamLowe/roberta-base-go_emotions',
    demoType: 'text',
    status: 'broken',
    errorMessage: 'HTTP 401: Modelo Xenova no accesible públicamente'
  }
];

// All models combined for easy access
export const ALL_MODELS: ModelConfig[] = [
  ...TOP_10_MODELS,
  ...MODELS_11_20,
  ...MODELS_21_30,
  ...MODELS_31_40,
  ...MODELS_41_50,
  ...MODELS_51_60,
  ...MODELS_61_70,
  ...MODELS_71_80,
  ...MODELS_81_90,
  ...MODELS_91_100
];

// Category metadata
export const MODEL_CATEGORIES: Record<ModelCategory, { label: string; icon: string; color: string }> = {
  'llm': { label: 'Language Model', icon: '🧠', color: '#00ff44' },
  'vision': { label: 'Vision', icon: '👁️', color: '#00aaff' },
  'audio': { label: 'Audio', icon: '🎤', color: '#ff6600' },
  'embedding': { label: 'Embedding', icon: '🔍', color: '#aa00ff' },
  'multimodal': { label: 'Multimodal', icon: '🌐', color: '#ffaa00' },
  'generation': { label: 'Generation', icon: '🎨', color: '#ff00aa' }
};

// Framework metadata
export const FRAMEWORKS: Record<ModelFramework, { label: string; description: string; url: string }> = {
  'WebLLM': {
    label: 'WebLLM (MLC-AI)',
    description: 'Framework optimizado para LLMs con WebGPU. Soporta streaming y contexto largo.',
    url: 'https://github.com/mlc-ai/web-llm'
  },
  'Transformers.js': {
    label: 'Transformers.js (HuggingFace)',
    description: 'Port de Transformers de Python. Soporta 100+ arquitecturas y tareas.',
    url: 'https://github.com/huggingface/transformers.js'
  },
  'ONNX Runtime Web': {
    label: 'ONNX Runtime Web',
    description: 'Runtime de Microsoft para modelos ONNX. Ideal para modelos custom.',
    url: 'https://onnxruntime.ai/docs/get-started/with-javascript/web.html'
  }
};
