/**
 * Script v2 para actualizar model-research.config.ts
 * Usa un approach más robusto para encontrar y marcar modelos broken
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Modelos que faltan por marcar (los otros ya están marcados)
const BROKEN_TO_ADD = [
    { id: 'phi-4-mini', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'efficientnet', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'fastvit', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'hiera', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'whisper-medium', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'whisper-large-v3', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'moonshine', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'voxtral-mini', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'pyannote', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'mxbai-embed', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'deberta', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'granite-code', error: 'HTTP 401: Repositorio onnx-community requiere autenticación' },
    { id: 'sapiens', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'grounding-dino', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'vitmae', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'emotion-roberta', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'led', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'keyphrase', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'question-gen', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
    { id: 'multilabel', error: 'HTTP 401: Modelo Xenova no accesible públicamente' },
];

function updateConfig() {
    const configPath = resolve(__dirname, '../src/app/config/model-research.config.ts');
    let content = readFileSync(configPath, 'utf-8');
    const lines = content.split('\n');

    let updatedCount = 0;

    for (const model of BROKEN_TO_ADD) {
        // Find the line with id: 'model-id'
        let idLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`id: '${model.id}'`)) {
                idLineIndex = i;
                break;
            }
        }

        if (idLineIndex === -1) {
            console.log(`⚠️  ${model.id} - No encontrado`);
            continue;
        }

        // Find the demoType line (should be within 30 lines)
        let demoTypeLineIndex = -1;
        for (let i = idLineIndex; i < Math.min(idLineIndex + 35, lines.length); i++) {
            if (lines[i].includes('demoType:')) {
                demoTypeLineIndex = i;
                break;
            }
        }

        if (demoTypeLineIndex === -1) {
            console.log(`⚠️  ${model.id} - demoType no encontrado`);
            continue;
        }

        // Check if already has status
        let hasStatus = false;
        for (let i = demoTypeLineIndex; i < Math.min(demoTypeLineIndex + 3, lines.length); i++) {
            if (lines[i].includes('status:')) {
                hasStatus = true;
                break;
            }
        }

        if (hasStatus) {
            console.log(`⏭️  ${model.id} - Ya tiene status`);
            continue;
        }

        // Add comma to demoType line if needed, then add status and errorMessage
        const demoTypeLine = lines[demoTypeLineIndex];
        if (!demoTypeLine.trim().endsWith(',')) {
            lines[demoTypeLineIndex] = demoTypeLine.replace(/('(?:text|image|audio|embedding|multimodal)')/, "$1,");
        }

        // Insert status and errorMessage after demoType
        const indent = '    ';
        const statusLine = `${indent}status: 'broken',`;
        const errorLine = `${indent}errorMessage: '${model.error}'`;

        lines.splice(demoTypeLineIndex + 1, 0, statusLine, errorLine);

        console.log(`✅ ${model.id} - Actualizado (línea ${demoTypeLineIndex + 1})`);
        updatedCount++;
    }

    // Write the updated content
    content = lines.join('\n');
    writeFileSync(configPath, content, 'utf-8');

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Resumen: ${updatedCount}/${BROKEN_TO_ADD.length} modelos actualizados`);
    console.log('='.repeat(50));
}

updateConfig();
