export type Framework =
  | 'vite-vanilla'
  | 'vite-react'
  | 'vite-react-tanstack-router'
  | 'vite-react-react-router'
  | 'tanstack-start'
  | 'nextjs'
  | 'hono'
  | 'hono-cloudflare-workers'
  | 'vite-electron';

export type Toolchain = 'none' | 'biome' | 'eslint';
export type ShadcnUse = 'yes' | 'no';
export type ShadcnBase = 'radix' | 'base';

export type LibraryOption =
  | 'zod'
  | 'tanstack-query'
  | 'tanstack-table'
  | 'tanstack-form'
  | 'tanstack-virtual'
  | 'tanstack-hotkeys';

export type DatabaseOption = 'neon' | 'drizzle' | 'convex' | 'dexie' | 'supabase';
export type AuthOption = 'clerk' | 'better-auth' | 'workos';
export type DeployOption = 'none' | 'cloudflare' | 'vercel' | 'netlify';

export interface CliOptions {
  simple?: boolean;
  preset?: string;
}

export interface ScaffolderAnswers {
  projectName: string;
  root: string;
  framework: Framework;
  useTailwind: boolean;
  shadcnUse: ShadcnUse;
  shadcnBase?: ShadcnBase;
  shadcnPreset?: string;
  toolchain: Toolchain;
  libraries: LibraryOption[];
  databases: DatabaseOption[];
  auth: AuthOption[];
  deploy: DeployOption;
  installDependencies: boolean;
  simple: boolean;
}

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  main?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}
