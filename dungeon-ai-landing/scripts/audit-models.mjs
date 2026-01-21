/**
 * Script de Auditoría de Modelos - Verificación HTTP
 * 
 * Este script verifica si los modelos de Hugging Face son accesibles
 * haciendo un HEAD request a cada repositorio.
 * 
 * Ejecutar con: node scripts/audit-models.mjs
 */

// Import models directly (we'll read the config manually)
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the config file and extract modelIds
const configPath = resolve(__dirname, '../src/app/config/model-research.config.ts');
const configContent = readFileSync(configPath, 'utf-8');

// Parse models from the config using regex
function extractModels(content) {
    const models = [];
    const modelRegex = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?name:\s*['"]([^'"]+)['"][\s\S]*?rank:\s*(\d+)[\s\S]*?framework:\s*['"]([^'"]+)['"][\s\S]*?modelId:\s*['"]([^'"]+)['"][\s\S]*?(?:status:\s*['"]([^'"]+)['"])?\s*\}/g;

    let match;
    while ((match = modelRegex.exec(content)) !== null) {
        models.push({
            id: match[1],
            name: match[2],
            rank: parseInt(match[3]),
            framework: match[4],
            modelId: match[5],
            status: match[6] || 'active'
        });
    }

    return models.sort((a, b) => a.rank - b.rank);
}

async function checkModelAccess(modelId, framework) {
    // WebLLM models use a different URL structure
    if (framework === 'WebLLM') {
        return { status: 'skip', reason: 'WebLLM (verificar manualmente)' };
    }

    // ONNX Runtime models often require manual setup
    if (framework === 'ONNX Runtime Web') {
        return { status: 'skip', reason: 'ONNX Runtime (verificar manualmente)' };
    }

    // For Transformers.js models, check Hugging Face
    let url;
    if (modelId.includes('/')) {
        url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    } else {
        url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (response.ok) {
            return { status: 'accessible', httpStatus: response.status };
        } else if (response.status === 401 || response.status === 403) {
            return { status: 'unauthorized', httpStatus: response.status };
        } else if (response.status === 404) {
            return { status: 'not_found', httpStatus: response.status };
        } else {
            return { status: 'error', httpStatus: response.status };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return { status: 'timeout', error: 'Timeout after 10s' };
        }
        return { status: 'error', error: error.message };
    }
}

async function auditAllModels() {
    console.log('🔍 Iniciando auditoría de modelos...\n');

    const models = extractModels(configContent);
    console.log(`Total de modelos encontrados: ${models.length}\n`);
    console.log('='.repeat(70));

    const results = {
        accessible: [],
        unauthorized: [],
        not_found: [],
        skip: [],
        error: [],
        already_broken: [],
        timeout: []
    };

    for (const model of models) {
        // Skip already marked broken models
        if (model.status === 'broken') {
            console.log(`⏭️  #${String(model.rank).padStart(3)} ${model.name.substring(0, 35).padEnd(35)} → Ya BROKEN`);
            results.already_broken.push(model);
            continue;
        }

        process.stdout.write(`🔄 #${String(model.rank).padStart(3)} ${model.name.substring(0, 35).padEnd(35)} → `);

        const check = await checkModelAccess(model.modelId, model.framework);

        const resultEntry = { ...model, ...check };

        switch (check.status) {
            case 'accessible':
                console.log('✅ OK');
                results.accessible.push(resultEntry);
                break;
            case 'unauthorized':
                console.log(`❌ BROKEN (HTTP ${check.httpStatus})`);
                results.unauthorized.push(resultEntry);
                break;
            case 'not_found':
                console.log(`❌ NOT FOUND (HTTP ${check.httpStatus})`);
                results.not_found.push(resultEntry);
                break;
            case 'skip':
                console.log(`⏭️  SKIP - ${check.reason}`);
                results.skip.push(resultEntry);
                break;
            case 'timeout':
                console.log(`⏱️  TIMEOUT`);
                results.timeout.push(resultEntry);
                break;
            default:
                console.log(`⚠️  ERROR: ${check.error || check.httpStatus}`);
                results.error.push(resultEntry);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN DE AUDITORÍA');
    console.log('='.repeat(70));

    console.log(`\n✅ Accesibles (funcionan):        ${results.accessible.length}`);
    console.log(`❌ Sin autorización (401/403):    ${results.unauthorized.length}`);
    console.log(`❌ No encontrados (404):          ${results.not_found.length}`);
    console.log(`⏭️  Omitidos (WebLLM/ONNX):        ${results.skip.length}`);
    console.log(`⏭️  Ya marcados BROKEN:            ${results.already_broken.length}`);
    console.log(`⏱️  Timeout:                       ${results.timeout.length}`);
    console.log(`⚠️  Otros errores:                 ${results.error.length}`);

    // List of models to mark as broken
    const newBroken = [...results.unauthorized, ...results.not_found];
    if (newBroken.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('❌ NUEVOS MODELOS PARA MARCAR COMO BROKEN:');
        console.log('='.repeat(70));
        newBroken.forEach(r => {
            console.log(`  #${r.rank} ${r.id} (${r.modelId}) → HTTP ${r.httpStatus}`);
        });
    }

    // List accessible models
    if (results.accessible.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('✅ MODELOS ACCESIBLES (Transformers.js):');
        console.log('='.repeat(70));
        results.accessible.forEach(r => {
            console.log(`  #${r.rank} ${r.id} (${r.modelId})`);
        });
    }

    // List WebLLM/ONNX models that need manual testing
    if (results.skip.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('⏭️  MODELOS QUE REQUIEREN PRUEBA MANUAL (WebLLM/ONNX):');
        console.log('='.repeat(70));
        results.skip.forEach(r => {
            console.log(`  #${r.rank} ${r.id} (${r.framework})`);
        });
    }

    console.log('\n✨ Auditoría completada!');
}

// Run the audit
auditAllModels().catch(console.error);
