/// <reference types="@angular/core" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly BUILD_HASH: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};
