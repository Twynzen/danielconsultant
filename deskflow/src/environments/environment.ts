/**
 * Environment configuration for development
 *
 * Variables are injected via angular.json "define" option at build time.
 * To change credentials, edit the "define" section in angular.json
 */

export const environment = {
  production: false,
  supabase: {
    // These are replaced at build time by angular.json "define"
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  },
  app: {
    name: 'MultiDesktopFlow',
    version: '1.0.0',
    // Injected at build time via angular.json `define` (see inject-env.js).
    // Used by the toolbar version chip so users can verify the browser has
    // the latest deployed bundle without opening DevTools.
    buildHash: import.meta.env.BUILD_HASH || 'dev'
  }
};
