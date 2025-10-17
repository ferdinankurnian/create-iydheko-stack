export interface PromptResponses {
  flavor: 'tanstack-start' | 'vite-minimal' | 'electron-tanstack-start' | 'electron-minimal';
  style: 'none' | 'tailwindcss' | 'tailwindcss-shadcn';
  db: ('none' | 'neon' | 'drizzle' | 'convex' | 'dexie' | 'sqlite')[];
  optionals: ('better-auth' | 'zod' | 'vitest' | 'tanstack-query' | 'tanstack-table' | 'tanstack-form' | 'tanstack-devtools' | 'tanstack-virtual' | 'tanstack-store' | 'tanstack-db' | 'tanstack-ranger' | 'tanstack-pacer')[];
  pages: boolean;
  deploy: boolean;
}