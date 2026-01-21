/**
 * Script de Auditoría de Modelos - Verificación HTTP
 * 
 * Este script verifica si los modelos de Hugging Face son accesibles
 * haciendo un HEAD request a cada repositorio.
 * 
 * Ejecutar con: npx ts-node scripts/audit-models.ts
 */

import { ALL_MODELS } from '../src/app/config/model-research.config';

interface AuditResult {
    id: string;
    name: string;
    modelId: string;
    framework: string;
    status: 'accessible' | 'unauthorized' | 'not_found' | 'error' | 'skip';
    httpStatus?: number;
    error?: string;
}

async function checkModelAccess(modelId: string, framework: string): Promise<{ status: string; httpStatus?: number; error?: string }> {
    // WebLLM models use a different URL structure
    if (framework === 'WebLLM') {
        // WebLLM models are pre-compiled, we can't easily verify them via HTTP
        // They should work if the WebLLM library supports them
        return { status: 'skip' };
    }

    // ONNX Runtime models often require manual setup
    if (framework === 'ONNX Runtime Web') {
        return { status: 'skip' };
    }

    // For Transformers.js models, check Hugging Face
    let url: string;
    if (modelId.includes('/')) {
        // Full path like "Xenova/whisper-tiny" or "onnx-community/model"
        url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    } else {
        // Just model name, assume it's in a known org
        url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
    }

    try {
        const response = await fetch(url, { method: 'HEAD' });

        if (response.ok) {
            return { status: 'accessible', httpStatus: response.status };
        } else if (response.status === 401 || response.status === 403) {
            return { status: 'unauthorized', httpStatus: response.status };
        } else if (response.status === 404) {
            return { status: 'not_found', httpStatus: response.status };
        } else {
            return { status: 'error', httpStatus: response.status };
        }
    } catch (error: any) {
        return { status: 'error', error: error.message };
    }
}

async function auditAllModels(): Promise<void> {
    console.log('🔍 Iniciando auditoría de modelos...\n');
    console.log(`Total de modelos a verificar: ${ALL_MODELS.length}\n`);

    const results: AuditResult[] = [];

    for (const model of ALL_MODELS) {
        // Skip already marked broken models
        if (model.status === 'broken') {
            console.log(`⏭️  #${model.rank} ${model.name} - Ya marcado como BROKEN`);
            results.push({
                id: model.id,
                name: model.name,
                modelId: model.modelId,
                framework: model.framework,
                status: 'skip',
            });
            continue;
        }

        process.stdout.write(`🔄 #${model.rank} ${model.name}... `);

        const check = await checkModelAccess(model.modelId, model.framework);

        const result: AuditResult = {
            id: model.id,
            name: model.name,
            modelId: model.modelId,
            framework: model.framework,
            status: check.status as AuditResult['status'],
            httpStatus: check.httpStatus,
            error: check.error,
        };

        results.push(result);

        switch (check.status) {
            case 'accessible':
                console.log('✅ OK');
                break;
            case 'unauthorized':
                console.log(`❌ BROKEN (${check.httpStatus})`);
                break;
            case 'not_found':
                console.log(`❌ NOT FOUND (${check.httpStatus})`);
                break;
            case 'skip':
                console.log('⏭️  SKIP (WebLLM/ONNX)');
                break;
            default:
                console.log(`⚠️  ERROR: ${check.error || check.httpStatus}`);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE AUDITORÍA');
    console.log('='.repeat(60));

    const accessible = results.filter(r => r.status === 'accessible');
    const unauthorized = results.filter(r => r.status === 'unauthorized');
    const notFound = results.filter(r => r.status === 'not_found');
    const skipped = results.filter(r => r.status === 'skip');
    const errors = results.filter(r => r.status === 'error');

    console.log(`✅ Accesibles: ${accessible.length}`);
    console.log(`❌ Sin autorización (401/403): ${unauthorized.length}`);
    console.log(`❌ No encontrados (404): ${notFound.length}`);
    console.log(`⏭️  Omitidos (WebLLM/ONNX): ${skipped.length}`);
    console.log(`⚠️  Errores: ${errors.length}`);

    // List broken models
    if (unauthorized.length > 0 || notFound.length > 0) {
        console.log('\n❌ MODELOS PARA MARCAR COMO BROKEN:');
        [...unauthorized, ...notFound].forEach(r => {
            console.log(`  - ${r.id} (${r.modelId}) → ${r.httpStatus}`);
        });
    }

    // Output code to update config
    const brokenModels = [...unauthorized, ...notFound];
    if (brokenModels.length > 0) {
        console.log('\n📝 CÓDIGO PARA ACTUALIZAR model-research.config.ts:');
        brokenModels.forEach(r => {
            console.log(`
// Model: ${r.name} (${r.id})
status: 'broken',
errorMessage: 'HTTP ${r.httpStatus}: ${r.status === 'unauthorized' ? 'Repositorio requiere autenticación' : 'Modelo no encontrado'}'`);
        });
    }
}

// Run the audit
auditAllModels().catch(console.error);
