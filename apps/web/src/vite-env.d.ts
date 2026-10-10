/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the backend runs; defaults to http://127.0.0.1:3000 (see .env.example). */
  readonly VITE_API_URL?: string;
}
