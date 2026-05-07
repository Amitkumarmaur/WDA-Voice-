/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Optional: org `public_slug` for voice demo when user is not signed in (main app only). */
  readonly VITE_PUBLIC_DEMO_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
