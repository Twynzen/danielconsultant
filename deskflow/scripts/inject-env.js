/**
 * Script to inject environment variables into angular.json at build time
 *
 * This allows us to:
 * - Keep credentials out of git (in .env for local dev)
 * - Use Netlify environment variables for production
 *
 * Usage: node scripts/inject-env.js
 * Called automatically before build via npm script
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists (for local development)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('[inject-env] Loaded .env file');
}

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Validate
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[inject-env] WARNING: Supabase credentials not found!');
  console.warn('[inject-env] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env or environment');
  console.warn('[inject-env] App will run in offline mode only');
}

// Read angular.json
const angularJsonPath = path.join(__dirname, '..', 'angular.json');
const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf-8'));

// Inject define section with environment variables
angularJson.projects['multidesktop-app'].architect.build.options.define = {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(SUPABASE_ANON_KEY)
};

// Write back
fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));

console.log('[inject-env] Environment variables injected into angular.json');
console.log('[inject-env] SUPABASE_URL:', SUPABASE_URL ? '***configured***' : 'NOT SET');
console.log('[inject-env] SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '***configured***' : 'NOT SET');
