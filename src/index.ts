import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import prompts from 'prompts';
import { styleText } from 'util';
import {
  AuthOption,
  CliOptions,
  DatabaseOption,
  DeployOption,
  Framework,
  LibraryOption,
  PackageJson,
  ScaffolderAnswers,
  ShadcnBase,
  ShadcnUse,
  Toolchain,
} from './types';

const FRAMEWORK_CHOICES: { title: string; value: Framework }[] = [
  { title: 'Vite Vanilla', value: 'vite-vanilla' },
  { title: 'Vite + React', value: 'vite-react' },
  { title: 'Vite + React + TanStack Router', value: 'vite-react-tanstack-router' },
  { title: 'Vite + React + React Router', value: 'vite-react-react-router' },
  { title: 'TanStack Start', value: 'tanstack-start' },
  { title: 'NextJS', value: 'nextjs' },
  { title: 'Hono', value: 'hono' },
  { title: 'Hono + Cloudflare Workers', value: 'hono-cloudflare-workers' },
  { title: 'Vite + Electron', value: 'vite-electron' },
];

const REACT_BASED_FRAMEWORKS = new Set<Framework>([
  'vite-react',
  'vite-react-tanstack-router',
  'vite-react-react-router',
  'tanstack-start',
  'nextjs',
  'vite-electron',
]);

const VITE_BASED_FRAMEWORKS = new Set<Framework>([
  'vite-vanilla',
  'vite-react',
  'vite-react-tanstack-router',
  'vite-react-react-router',
  'vite-electron',
]);

const TOOLCHAIN_MANUAL_FRAMEWORKS = new Set<Framework>([
  'vite-vanilla',
  'vite-react',
  'vite-react-tanstack-router',
  'vite-react-react-router',
  'hono',
  'hono-cloudflare-workers',
  'vite-electron',
]);

const LIBRARY_DEPENDENCIES: Record<LibraryOption, string> = {
  zod: 'zod',
  'tanstack-query': '@tanstack/react-query',
  'tanstack-table': '@tanstack/react-table',
  'tanstack-form': '@tanstack/react-form',
  'tanstack-virtual': '@tanstack/react-virtual',
  'tanstack-hotkeys': '@tanstack/react-hotkeys',
};

const DATABASE_DEPENDENCIES: Record<DatabaseOption, { name: string; dev?: boolean }[]> = {
  neon: [{ name: '@neondatabase/serverless' }],
  drizzle: [{ name: 'drizzle-orm' }, { name: 'drizzle-kit', dev: true }],
  convex: [{ name: 'convex' }],
  dexie: [{ name: 'dexie' }],
  supabase: [{ name: '@supabase/supabase-js' }],
};

const AUTH_DEPENDENCIES: Record<AuthOption, string> = {
  clerk: '@clerk/clerk-js',
  'better-auth': 'better-auth',
  workos: '@workos-inc/node',
};

const SHADCN_PRESET_CHOICES = [
  { title: 'Nova', value: 'nova' },
  { title: 'Vega', value: 'vega' },
  { title: 'Maia', value: 'maia' },
  { title: 'Lyra', value: 'lyra' },
  { title: 'Mira', value: 'mira' },
  { title: 'Luma', value: 'luma' },
  { title: 'Sera', value: 'sera' },
  { title: 'Custom', value: 'custom' },
] as const;

const PROMPT_OPTIONS = {
  onCancel: () => {
    console.log(styleText('yellow', 'Cancelled.'));
    process.exit(0);
  },
};

interface RunCommandOptions {
  cwd?: string;
  input?: string;
  allowFailure?: boolean;
}

function isHonoFramework(framework: Framework): boolean {
  return framework === 'hono' || framework === 'hono-cloudflare-workers';
}

function supportsDatabases(framework: Framework): boolean {
  return framework !== 'vite-vanilla' && framework !== 'vite-electron';
}

function supportsAuth(framework: Framework): boolean {
  return framework !== 'vite-vanilla' && framework !== 'vite-electron';
}

function supportsDeploy(framework: Framework): boolean {
  return framework !== 'vite-electron';
}

function supportsShadcn(framework: Framework): boolean {
  return (
    framework === 'vite-react' ||
    framework === 'vite-react-tanstack-router' ||
    framework === 'vite-react-react-router' ||
    framework === 'tanstack-start' ||
    framework === 'nextjs' ||
    framework === 'vite-electron'
  );
}

function ensureObject(value: unknown): Record<string, string> {
  if (value && typeof value === 'object') {
    return value as Record<string, string>;
  }
  return {};
}

function validateProjectName(projectName: string): string {
  const normalized = projectName.trim();
  if (!normalized) {
    throw new Error('Project name cannot be empty.');
  }

  if (normalized.startsWith('-')) {
    throw new Error('Project name cannot start with "-".');
  }

  if (normalized === '.' || normalized === '..') {
    throw new Error('Project name cannot be "." or "..".');
  }

  if (normalized.includes('/') || normalized.includes('\\')) {
    throw new Error('Project name must be a single folder name, not a path.');
  }

  return normalized;
}

async function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: process.env,
    });

    if (options.input) {
      child.stdin?.write(options.input);
    }
    child.stdin?.end();

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || options.allowFailure) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureTargetDirectoryAvailable(root: string): Promise<void> {
  if (await fileExists(root)) {
    throw new Error(`Directory already exists: ${path.basename(root)}`);
  }
}

async function removePaths(root: string, relativePaths: string[]): Promise<void> {
  await Promise.all(
    relativePaths.map(async (relativePath) => {
      const target = path.join(root, relativePath);
      await fs.rm(target, { recursive: true, force: true });
    }),
  );
}

async function writeProjectFile(root: string, relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content);
}

async function readPackageJson(root: string): Promise<PackageJson> {
  const pkgPath = path.join(root, 'package.json');
  const content = await fs.readFile(pkgPath, 'utf-8');
  return JSON.parse(content) as PackageJson;
}

async function writePackageJson(root: string, pkg: PackageJson): Promise<void> {
  const pkgPath = path.join(root, 'package.json');
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function setPackageDependency(pkg: PackageJson, packageName: string, dev = false): void {
  pkg.dependencies = ensureObject(pkg.dependencies);
  pkg.devDependencies = ensureObject(pkg.devDependencies);
  if (dev) {
    delete pkg.dependencies[packageName];
    pkg.devDependencies[packageName] = 'latest';
    return;
  }

  delete pkg.devDependencies[packageName];
  pkg.dependencies[packageName] = 'latest';
}

function removePackageDependency(pkg: PackageJson, packageName: string): void {
  pkg.dependencies = ensureObject(pkg.dependencies);
  pkg.devDependencies = ensureObject(pkg.devDependencies);
  delete pkg.dependencies[packageName];
  delete pkg.devDependencies[packageName];
}

function setScript(pkg: PackageJson, scriptName: string, command: string): void {
  pkg.scripts = ensureObject(pkg.scripts);
  pkg.scripts[scriptName] = command;
}

function removeScript(pkg: PackageJson, scriptName: string): void {
  pkg.scripts = ensureObject(pkg.scripts);
  delete pkg.scripts[scriptName];
}

function buildPlainCardCss(): string {
  return `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #f3f4f6;
  background: #111827;
}

.iy-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.iy-card {
  width: min(100%, 26rem);
  border: 1px solid #374151;
  border-radius: 0.75rem;
  padding: 2rem;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  background: #1f2937;
}

.iy-card h1 {
  margin: 0;
  font-size: 1.875rem;
  line-height: 1.2;
}

.iy-card p {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}

.iy-card .iy-note {
  margin-top: 1.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
}
`;
}

function buildTailwindCardMarkupReact(): string {
  return `<main className="min-h-screen grid place-items-center p-6 dark bg-zinc-900">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-800 p-8 text-center shadow-sm dark:text-zinc-100">
        <h1 className="text-3xl font-semibold">congrats!</h1>
        <p className="mt-2 text-base">now u can code</p>
        <p className="mt-6 text-sm text-zinc-400">created with create-iydheko-stack</p>
      </div>
    </main>`;
}

function buildPlainCardMarkupReact(): string {
  return `<main className="iy-page">
      <div className="iy-card">
        <h1>congrats!</h1>
        <p>now u can code</p>
        <p className="iy-note">created with create-iydheko-stack</p>
      </div>
    </main>`;
}

function buildTailwindCardMarkupHtml(): string {
  return `<main class="min-h-screen grid place-items-center p-6 dark bg-zinc-900">
  <div class="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-800 p-8 text-center shadow-sm dark:text-zinc-100">
    <h1 class="text-3xl font-semibold">congrats!</h1>
    <p class="mt-2 text-base">now u can code</p>
    <p class="mt-6 text-sm text-zinc-400">created with create-iydheko-stack</p>
  </div>
</main>`;
}

function buildPlainCardMarkupHtml(): string {
  return `<main class="iy-page">
  <div class="iy-card">
    <h1>congrats!</h1>
    <p>now u can code</p>
    <p class="iy-note">created with create-iydheko-stack</p>
  </div>
</main>`;
}

function buildReactAppFile(useTailwind: boolean): string {
  return `function App() {
  return (
    ${useTailwind ? buildTailwindCardMarkupReact() : buildPlainCardMarkupReact()}
  )
}

export default App
`;
}

function buildViteReactConfig(useTailwind: boolean): string {
  if (useTailwind) {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
})
`;
  }

  return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`;
}

function buildViteVanillaConfig(useTailwind: boolean): string {
  if (!useTailwind) {
    return '';
  }

  return `import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
})
`;
}

function buildViteStyles(useTailwind: boolean): string {
  if (useTailwind) {
    return '@import "tailwindcss";\n';
  }
  return buildPlainCardCss();
}

type ViteReactMode = 'plain' | 'react-router' | 'tanstack-router';

function buildMainTsx(mode: ViteReactMode, useTanStackQuery: boolean): string {
  const importLines = [
    `import { StrictMode } from 'react'`,
    `import { createRoot } from 'react-dom/client'`,
    `import './index.css'`,
    `import App from './App'`,
  ];

  const bodyLines: string[] = [];

  if (mode === 'react-router') {
    importLines.push(`import { BrowserRouter, Route, Routes } from 'react-router-dom'`);
    bodyLines.push(`const routedApp = (`);
    bodyLines.push(`  <BrowserRouter>`);
    bodyLines.push(`    <Routes>`);
    bodyLines.push(`      <Route path="/" element={<App />} />`);
    bodyLines.push(`    </Routes>`);
    bodyLines.push(`  </BrowserRouter>`);
    bodyLines.push(`)`);
  } else if (mode === 'tanstack-router') {
    importLines.push(
      `import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter } from '@tanstack/react-router'`,
    );
    bodyLines.push(`const rootRoute = createRootRoute({`);
    bodyLines.push(`  component: () => <Outlet />,`);
    bodyLines.push(`})`);
    bodyLines.push('');
    bodyLines.push(`const indexRoute = createRoute({`);
    bodyLines.push(`  getParentRoute: () => rootRoute,`);
    bodyLines.push(`  path: '/',`);
    bodyLines.push(`  component: App,`);
    bodyLines.push(`})`);
    bodyLines.push('');
    bodyLines.push(`const routeTree = rootRoute.addChildren([indexRoute])`);
    bodyLines.push(`const router = createRouter({ routeTree })`);
    bodyLines.push('');
    bodyLines.push(`declare module '@tanstack/react-router' {`);
    bodyLines.push(`  interface Register {`);
    bodyLines.push(`    router: typeof router`);
    bodyLines.push(`  }`);
    bodyLines.push(`}`);
    bodyLines.push('');
    bodyLines.push(`const routedApp = <RouterProvider router={router} />`);
  } else {
    bodyLines.push(`const routedApp = <App />`);
  }

  if (useTanStackQuery) {
    importLines.push(`import { QueryClient, QueryClientProvider } from '@tanstack/react-query'`);
    bodyLines.push('');
    bodyLines.push('const queryClient = new QueryClient()');
    bodyLines.push('');
    bodyLines.push(`const app = (`);
    bodyLines.push(`  <StrictMode>`);
    bodyLines.push(`    <QueryClientProvider client={queryClient}>{routedApp}</QueryClientProvider>`);
    bodyLines.push(`  </StrictMode>`);
    bodyLines.push(`)`);
  } else {
    bodyLines.push('');
    bodyLines.push(`const app = (`);
    bodyLines.push(`  <StrictMode>`);
    bodyLines.push(`    {routedApp}`);
    bodyLines.push(`  </StrictMode>`);
    bodyLines.push(`)`);
  }

  bodyLines.push('');
  bodyLines.push(`createRoot(document.getElementById('root')!).render(app)`);

  return `${importLines.join('\n')}\n\n${bodyLines.join('\n')}\n`;
}

function buildViteVanillaMain(useTailwind: boolean): string {
  return `import './index.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Missing #app root element')
}

app.innerHTML = \`${useTailwind ? buildTailwindCardMarkupHtml() : buildPlainCardMarkupHtml()}\`
`;
}

function buildStartRootRoute(useTanStackQuery: boolean): string {
  const queryImports = useTanStackQuery
    ? `\nimport { QueryClient, QueryClientProvider } from '@tanstack/react-query'`
    : '';
  const queryClient = useTanStackQuery ? `\nconst queryClient = new QueryClient()\n` : '\n';
  const bodyContent = useTanStackQuery
    ? `<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>`
    : `{children}`;

  return `import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'${queryImports}${queryClient}
export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'create-iydheko-stack',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>${bodyContent}
        <Scripts />
      </body>
    </html>
  )
}
`;
}

function buildStartIndexRoute(useTailwind: boolean): string {
  if (useTailwind) {
    return `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold">congrats!</h1>
        <p className="mt-2 text-base">now u can code</p>
        <p className="mt-6 text-sm text-neutral-500">created with create-iydheko-stack</p>
      </div>
    </main>
  )
}
`;
  }

  return `import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="iy-page">
      <div className="iy-card">
        <h1>congrats!</h1>
        <p>now u can code</p>
        <p className="iy-note">created with create-iydheko-stack</p>
      </div>
    </main>
  )
}
`;
}

function buildStartViteConfig(useTailwind: boolean): string {
  if (useTailwind) {
    return `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
})
`;
  }

  return `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact()],
})
`;
}

function buildNextPage(useTailwind: boolean): string {
  if (useTailwind) {
    return `export default function Home() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 p-8 text-center shadow-sm">
        <h1 className="text-3xl font-semibold">congrats!</h1>
        <p className="mt-2 text-base">now u can code</p>
        <p className="mt-6 text-sm text-neutral-500">created with create-iydheko-stack</p>
      </div>
    </main>
  )
}
`;
  }

  return `const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1.5rem',
  },
  card: {
    width: 'min(100%, 26rem)',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    padding: '2rem',
    textAlign: 'center' as const,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  },
  title: {
    margin: 0,
    fontSize: '1.875rem',
    lineHeight: 1.2,
  },
  subtitle: {
    margin: '0.5rem 0 0',
    fontSize: '1rem',
  },
  note: {
    marginTop: '1.5rem',
    color: '#6b7280',
    fontSize: '0.875rem',
  },
}

export default function Home() {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>congrats!</h1>
        <p style={styles.subtitle}>now u can code</p>
        <p style={styles.note}>created with create-iydheko-stack</p>
      </div>
    </main>
  )
}
`;
}

function buildNextLayout(useTailwind: boolean, useTanStackQuery: boolean): string {
  const imports = [
    `import type { Metadata } from 'next'`,
    useTailwind ? `import './globals.css'` : '',
    useTanStackQuery ? `import { Providers } from './providers'` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const children = useTanStackQuery ? '<Providers>{children}</Providers>' : '{children}';

  return `${imports}

export const metadata: Metadata = {
  title: 'create-iydheko-stack',
  description: 'Minimal project scaffold',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>${children}</body>
    </html>
  )
}
`;
}

function buildNextQueryProviders(): string {
  return `'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
`;
}

function buildElectronMainFile(): string {
  return `import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    return;
  }

  mainWindow.loadFile(join(__dirname, '../dist/index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
`;
}

function buildElectronPreloadFile(): string {
  return `import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electron', {})
`;
}

function removeEslintDependencies(pkg: PackageJson): void {
  [
    'eslint',
    '@eslint/js',
    'eslint-config-next',
    'eslint-plugin-react-hooks',
    'eslint-plugin-react-refresh',
    'globals',
    'typescript-eslint',
  ].forEach((dependency) => removePackageDependency(pkg, dependency));
}

function removeBiomeDependencies(pkg: PackageJson): void {
  removePackageDependency(pkg, '@biomejs/biome');
}

async function removeToolchainFiles(root: string): Promise<void> {
  await removePaths(root, [
    'eslint.config.js',
    'eslint.config.mjs',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    'biome.json',
    'biome.jsonc',
  ]);
}

function buildReactEslintConfig(browser: boolean): string {
  const globalsTarget = browser ? 'globals.browser' : 'globals.node';
  return `import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', '.next', '.output'] },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: ${globalsTarget},
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
`;
}

function buildBaseEslintConfig(browser: boolean): string {
  const globalsTarget = browser ? 'globals.browser' : 'globals.node';
  return `import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', '.next', '.output'] },
  {
    files: ['**/*.{ts,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: ${globalsTarget},
    },
  },
)
`;
}

function isBrowserProject(framework: Framework): boolean {
  return (
    framework === 'vite-vanilla' ||
    framework === 'vite-react' ||
    framework === 'vite-react-tanstack-router' ||
    framework === 'vite-react-react-router' ||
    framework === 'vite-electron'
  );
}

async function applyToolchain(root: string, pkg: PackageJson, toolchain: Toolchain, framework: Framework): Promise<void> {
  await removeToolchainFiles(root);

  if (toolchain === 'none') {
    removeEslintDependencies(pkg);
    removeBiomeDependencies(pkg);
    removeScript(pkg, 'lint');
    removeScript(pkg, 'format');
    return;
  }

  if (toolchain === 'biome') {
    removeEslintDependencies(pkg);
    removeBiomeDependencies(pkg);
    setPackageDependency(pkg, '@biomejs/biome', true);
    setScript(pkg, 'lint', 'biome check .');
    setScript(pkg, 'format', 'biome format --write .');
    await writeProjectFile(
      root,
      'biome.json',
      `{
  "$schema": "https://biomejs.dev/schemas/2.0.5/schema.json",
  "formatter": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
`,
    );
    return;
  }

  removeBiomeDependencies(pkg);
  setPackageDependency(pkg, 'eslint', true);
  setPackageDependency(pkg, '@eslint/js', true);
  setPackageDependency(pkg, 'globals', true);
  setPackageDependency(pkg, 'typescript-eslint', true);
  removeScript(pkg, 'format');
  setScript(pkg, 'lint', 'eslint .');

  const isReactProject = REACT_BASED_FRAMEWORKS.has(framework);
  if (isReactProject) {
    setPackageDependency(pkg, 'eslint-plugin-react-hooks', true);
    setPackageDependency(pkg, 'eslint-plugin-react-refresh', true);
    await writeProjectFile(root, 'eslint.config.js', buildReactEslintConfig(isBrowserProject(framework)));
    return;
  }

  await writeProjectFile(root, 'eslint.config.js', buildBaseEslintConfig(isBrowserProject(framework)));
}

async function scaffoldBaseProject(answers: ScaffolderAnswers): Promise<void> {
  switch (answers.framework) {
    case 'vite-vanilla':
      await runCommand('bun', [
        'create',
        'vite',
        answers.projectName,
        '--template',
        'vanilla-ts',
        '--no-interactive',
      ]);
      return;
    case 'vite-react':
    case 'vite-react-tanstack-router':
    case 'vite-react-react-router':
    case 'vite-electron':
      await runCommand('bun', [
        'create',
        'vite',
        answers.projectName,
        '--template',
        'react-ts',
        '--no-interactive',
      ]);
      return;
    case 'tanstack-start': {
      const toolchainArgs =
        answers.toolchain === 'none' ? ['--no-toolchain'] : ['--toolchain', answers.toolchain];
      await runCommand('bunx', [
        '@tanstack/cli@latest',
        'create',
        answers.projectName,
        '--package-manager',
        'bun',
        '--no-install',
        '--no-git',
        '--no-intent',
        '--no-examples',
        '--non-interactive',
        ...toolchainArgs,
      ]);
      return;
    }
    case 'nextjs': {
      const toolchainArgs =
        answers.toolchain === 'none'
          ? ['--no-linter']
          : answers.toolchain === 'biome'
            ? ['--biome']
            : ['--eslint'];
      const tailwindArgs = answers.useTailwind ? ['--tailwind'] : ['--no-tailwind'];
      await runCommand('bunx', [
        'create-next-app@latest',
        answers.projectName,
        '--ts',
        '--yes',
        '--use-bun',
        '--empty',
        '--skip-install',
        '--disable-git',
        '--app',
        ...toolchainArgs,
        ...tailwindArgs,
      ]);
      return;
    }
    case 'hono':
      await runCommand('bun', ['create', 'hono@latest', answers.projectName, '--template', 'nodejs'], {
        input: 'n\n',
      });
      return;
    case 'hono-cloudflare-workers':
      await runCommand(
        'bun',
        ['create', 'hono@latest', answers.projectName, '--template', 'cloudflare-workers'],
        {
          input: 'n\n',
        },
      );
      return;
  }
}

async function prepareViteVanilla(root: string, useTailwind: boolean): Promise<void> {
  await removePaths(root, [
    'README.md',
    'public/favicon.svg',
    'public/icons.svg',
    'src/assets',
    'src/counter.ts',
    'src/style.css',
  ]);

  await writeProjectFile(root, 'src/index.css', buildViteStyles(useTailwind));
  await writeProjectFile(root, 'src/main.ts', buildViteVanillaMain(useTailwind));

  const viteConfig = buildViteVanillaConfig(useTailwind);
  if (viteConfig) {
    await writeProjectFile(root, 'vite.config.ts', viteConfig);
    return;
  }
  await removePaths(root, ['vite.config.ts']);
}

async function prepareViteReact(
  root: string,
  mode: ViteReactMode,
  useTailwind: boolean,
  useTanStackQuery: boolean,
): Promise<void> {
  await removePaths(root, [
    'README.md',
    'public/favicon.svg',
    'public/icons.svg',
    'src/assets',
    'src/App.css',
    'src/index.css',
  ]);

  await writeProjectFile(root, 'src/App.tsx', buildReactAppFile(useTailwind));
  await writeProjectFile(root, 'src/index.css', buildViteStyles(useTailwind));
  await writeProjectFile(root, 'src/main.tsx', buildMainTsx(mode, useTanStackQuery));
  await writeProjectFile(root, 'vite.config.ts', buildViteReactConfig(useTailwind));
}

async function prepareTanStackStart(root: string, useTailwind: boolean, useTanStackQuery: boolean): Promise<void> {
  await removePaths(root, [
    'README.md',
    '.cta.json',
    '.vscode',
    'AGENTS.md',
    'CLAUDE.md',
    'public/logo192.png',
    'public/logo512.png',
    'public/manifest.json',
    'public/robots.txt',
  ]);

  const styles = useTailwind
    ? '@import "tailwindcss";\n\nbody {\n  margin: 0;\n}\n'
    : buildPlainCardCss();

  await writeProjectFile(root, 'src/styles.css', styles);
  await writeProjectFile(root, 'src/routes/__root.tsx', buildStartRootRoute(useTanStackQuery));
  await writeProjectFile(root, 'src/routes/index.tsx', buildStartIndexRoute(useTailwind));
  await writeProjectFile(root, 'vite.config.ts', buildStartViteConfig(useTailwind));
}

async function prepareNext(root: string, useTailwind: boolean, useTanStackQuery: boolean): Promise<void> {
  await removePaths(root, ['README.md', 'AGENTS.md', 'CLAUDE.md']);

  if (useTailwind) {
    await writeProjectFile(root, 'app/globals.css', '@import "tailwindcss";\n');
  } else {
    await removePaths(root, ['app/globals.css']);
  }

  await writeProjectFile(root, 'app/page.tsx', buildNextPage(useTailwind));
  await writeProjectFile(root, 'app/layout.tsx', buildNextLayout(useTailwind, useTanStackQuery));

  if (useTanStackQuery) {
    await writeProjectFile(root, 'app/providers.tsx', buildNextQueryProviders());
    return;
  }

  await removePaths(root, ['app/providers.tsx']);
}

async function prepareHonoNode(root: string): Promise<void> {
  await removePaths(root, ['README.md']);
  await writeProjectFile(
    root,
    'src/index.ts',
    `import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('project created')
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(\`Server is running on http://localhost:\${info.port}\`)
  },
)
`,
  );
}

async function prepareHonoCloudflare(root: string): Promise<void> {
  await removePaths(root, ['README.md']);
  await writeProjectFile(
    root,
    'src/index.ts',
    `import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('project created')
})

export default app
`,
  );
}

async function prepareElectron(root: string, pkg: PackageJson): Promise<void> {
  await writeProjectFile(root, 'electron/main.js', buildElectronMainFile());
  await writeProjectFile(root, 'electron/preload.js', buildElectronPreloadFile());

  pkg.main = 'electron/main.js';
  setPackageDependency(pkg, 'electron', true);
  setPackageDependency(pkg, 'concurrently', true);
  setPackageDependency(pkg, 'wait-on', true);
  setScript(pkg, 'dev:web', 'vite');
  setScript(pkg, 'dev:electron', 'wait-on tcp:5173 && electron .');
  setScript(pkg, 'dev', 'concurrently -k "bun run dev:web" "bun run dev:electron"');
}

function applyFeatureDependencies(answers: ScaffolderAnswers, pkg: PackageJson): void {
  answers.libraries.forEach((library) => {
    setPackageDependency(pkg, LIBRARY_DEPENDENCIES[library]);
  });

  answers.databases.forEach((database) => {
    DATABASE_DEPENDENCIES[database].forEach((dependency) => {
      setPackageDependency(pkg, dependency.name, Boolean(dependency.dev));
    });
  });

  if (answers.databases.includes('drizzle')) {
    setScript(pkg, 'db:generate', 'drizzle-kit generate');
  }

  if (answers.databases.includes('convex')) {
    setScript(pkg, 'convex:dev', 'bunx convex dev');
  }

  answers.auth.forEach((authOption) => {
    setPackageDependency(pkg, AUTH_DEPENDENCIES[authOption]);
  });
}

function applyDeployChoice(answers: ScaffolderAnswers, pkg: PackageJson): void {
  if (answers.deploy === 'none') {
    removeScript(pkg, 'deploy');
    return;
  }

  if (answers.deploy === 'cloudflare') {
    setPackageDependency(pkg, 'wrangler', true);
    if (answers.framework === 'hono-cloudflare-workers') {
      setScript(pkg, 'deploy', 'wrangler deploy --minify');
      return;
    }

    if (
      answers.framework === 'vite-vanilla' ||
      answers.framework === 'vite-react' ||
      answers.framework === 'vite-react-tanstack-router' ||
      answers.framework === 'vite-react-react-router' ||
      answers.framework === 'vite-electron'
    ) {
      setScript(pkg, 'deploy', 'bun run build && wrangler pages deploy dist');
      return;
    }

    setScript(pkg, 'deploy', 'wrangler deploy');
    return;
  }

  if (answers.deploy === 'vercel') {
    setPackageDependency(pkg, 'vercel', true);
    setScript(pkg, 'deploy', 'vercel --prod');
    return;
  }

  setPackageDependency(pkg, 'netlify-cli', true);
  setScript(pkg, 'deploy', 'netlify deploy --prod');
}

function getShadcnTemplate(framework: Framework): 'vite' | 'start' | 'next' | null {
  if (
    framework === 'vite-react' ||
    framework === 'vite-react-tanstack-router' ||
    framework === 'vite-react-react-router' ||
    framework === 'vite-electron'
  ) {
    return 'vite';
  }

  if (framework === 'tanstack-start') {
    return 'start';
  }

  if (framework === 'nextjs') {
    return 'next';
  }

  return null;
}

async function setupShadcn(answers: ScaffolderAnswers): Promise<void> {
  if (!answers.useTailwind || answers.shadcnUse === 'no') {
    return;
  }

  const template = getShadcnTemplate(answers.framework);
  if (!template) {
    return;
  }

  const args = ['shadcn@latest', 'init', '-y', '-t', template, '-c', '.'];
  args.push('-b', answers.shadcnBase ?? 'radix');
  if (answers.shadcnPreset) {
    args.push('--preset', answers.shadcnPreset);
  }
  await runCommand('bunx', args, { cwd: answers.root });
}

async function initializeGit(root: string): Promise<void> {
  try {
    await runCommand('git', ['init', '-b', 'main'], { cwd: root });
  } catch {
    await runCommand('git', ['init'], { cwd: root });
  }
}

async function configureProject(answers: ScaffolderAnswers): Promise<void> {
  await ensureTargetDirectoryAvailable(answers.root);
  await scaffoldBaseProject(answers);

  const pkg = await readPackageJson(answers.root);
  pkg.packageManager = 'bun@1';

  const hasQuery = answers.libraries.includes('tanstack-query');

  switch (answers.framework) {
    case 'vite-vanilla':
      await prepareViteVanilla(answers.root, answers.useTailwind);
      break;
    case 'vite-react':
      await prepareViteReact(answers.root, 'plain', answers.useTailwind, hasQuery);
      break;
    case 'vite-react-tanstack-router':
      await prepareViteReact(answers.root, 'tanstack-router', answers.useTailwind, hasQuery);
      setPackageDependency(pkg, '@tanstack/react-router');
      break;
    case 'vite-react-react-router':
      await prepareViteReact(answers.root, 'react-router', answers.useTailwind, hasQuery);
      setPackageDependency(pkg, 'react-router-dom');
      break;
    case 'tanstack-start':
      await prepareTanStackStart(answers.root, answers.useTailwind, hasQuery);
      removeScript(pkg, 'test');
      removePackageDependency(pkg, '@tanstack/react-devtools');
      removePackageDependency(pkg, '@tanstack/react-router-devtools');
      removePackageDependency(pkg, '@tanstack/devtools-vite');
      removePackageDependency(pkg, '@tailwindcss/typography');
      removePackageDependency(pkg, '@testing-library/dom');
      removePackageDependency(pkg, '@testing-library/react');
      removePackageDependency(pkg, 'jsdom');
      removePackageDependency(pkg, 'vitest');
      if (!answers.useTailwind) {
        removePackageDependency(pkg, '@tailwindcss/vite');
        removePackageDependency(pkg, 'tailwindcss');
      }
      break;
    case 'nextjs':
      await prepareNext(answers.root, answers.useTailwind, hasQuery);
      break;
    case 'hono':
      await prepareHonoNode(answers.root);
      break;
    case 'hono-cloudflare-workers':
      await prepareHonoCloudflare(answers.root);
      break;
    case 'vite-electron':
      await prepareViteReact(answers.root, 'plain', answers.useTailwind, hasQuery);
      await prepareElectron(answers.root, pkg);
      break;
  }

  if (VITE_BASED_FRAMEWORKS.has(answers.framework)) {
    if (answers.useTailwind) {
      setPackageDependency(pkg, 'tailwindcss', true);
      setPackageDependency(pkg, '@tailwindcss/vite', true);
    } else {
      removePackageDependency(pkg, 'tailwindcss');
      removePackageDependency(pkg, '@tailwindcss/vite');
    }
  }

  applyFeatureDependencies(answers, pkg);
  applyDeployChoice(answers, pkg);

  if (TOOLCHAIN_MANUAL_FRAMEWORKS.has(answers.framework)) {
    await applyToolchain(answers.root, pkg, answers.toolchain, answers.framework);
  } else if (answers.toolchain === 'none') {
    await removeToolchainFiles(answers.root);
    removeEslintDependencies(pkg);
    removeBiomeDependencies(pkg);
    removeScript(pkg, 'lint');
    removeScript(pkg, 'format');
  }

  await writePackageJson(answers.root, pkg);
  await setupShadcn(answers);
  await initializeGit(answers.root);

  if (answers.installDependencies) {
    await runCommand('bun', ['install'], { cwd: answers.root });
  }
}

async function askText(message: string, initial: string): Promise<string> {
  const response = (await prompts(
    {
      type: 'text',
      name: 'value',
      message,
      initial,
    },
    PROMPT_OPTIONS,
  )) as { value?: string };

  return String(response.value ?? '').trim();
}

async function askToggle(message: string, initial = true): Promise<boolean> {
  const response = (await prompts(
    {
      type: 'toggle',
      name: 'value',
      message,
      active: 'Yes',
      inactive: 'No',
      initial,
    },
    PROMPT_OPTIONS,
  )) as { value?: boolean };

  return Boolean(response.value);
}

async function askSelect<T extends string>(
  message: string,
  choices: { title: string; value: T }[],
  initial = 0,
): Promise<T> {
  const response = (await prompts(
    {
      type: 'select',
      name: 'value',
      message,
      choices,
      initial,
    },
    PROMPT_OPTIONS,
  )) as { value?: T };

  if (!response.value) {
    throw new Error(`No value selected for: ${message}`);
  }
  return response.value;
}

async function askMulti<T extends string>(
  message: string,
  choices: { title: string; value: T }[],
): Promise<T[]> {
  const response = (await prompts(
    {
      type: 'multiselect',
      name: 'value',
      message,
      hint: '- Space to select. Enter to continue',
      instructions: false,
      choices,
    },
    PROMPT_OPTIONS,
  )) as { value?: T[] };

  return response.value ?? [];
}

export async function run(projectNameFromArgs?: string, cliOptions: CliOptions = {}): Promise<void> {
  console.log(styleText('blue', 'create-iydheko-stack'));

  try {
    const simple = Boolean(cliOptions.simple);
    const presetFromFlag = String(cliOptions.preset ?? '').trim();

    let projectName = (projectNameFromArgs ?? '').trim();
    if (!projectName) {
      projectName = await askText('Name project', 'my-project');
    }
    projectName = validateProjectName(projectName);

    const framework = await askSelect('Select Framework', FRAMEWORK_CHOICES);

    let useTailwind = false;
    let shadcnUse: ShadcnUse = 'no';
    let shadcnBase: ShadcnBase = 'radix';
    let shadcnPreset = '';

    if (!isHonoFramework(framework)) {
      useTailwind = await askToggle('Use Tailwind CSS?', true);
      if (useTailwind) {
        shadcnUse = await askSelect<ShadcnUse>('Use Shadcn?', [
          { title: 'yes', value: 'yes' },
          { title: 'no', value: 'no' },
        ]);

        if (shadcnUse === 'yes') {
          shadcnBase = await askSelect<ShadcnBase>('Shadcn component library?', [
            { title: 'Radix', value: 'radix' },
            { title: 'Base', value: 'base' },
          ]);

          shadcnPreset = presetFromFlag;
          if (!shadcnPreset) {
            const selectedPreset = await askSelect<'nova' | 'vega' | 'maia' | 'lyra' | 'mira' | 'luma' | 'sera' | 'custom'>(
              'Shadcn preset?',
              SHADCN_PRESET_CHOICES.map((choice) => ({ title: choice.title, value: choice.value })),
              0,
            );
            if (selectedPreset === 'custom') {
              shadcnPreset = await askText('Enter shadcn preset', 'nova');
            } else {
              shadcnPreset = selectedPreset;
            }
          }
          if (!shadcnPreset) {
            throw new Error('Shadcn preset cannot be empty when Shadcn is enabled.');
          }
          shadcnPreset = shadcnPreset.trim().toLowerCase();
        }
      }
    }

    const toolchain = await askSelect<Toolchain>('Toolchain?', [
      { title: 'No', value: 'none' },
      { title: 'Biome', value: 'biome' },
      { title: 'ESLint', value: 'eslint' },
    ]);

    let libraries: LibraryOption[] = [];
    if (!simple && REACT_BASED_FRAMEWORKS.has(framework)) {
      libraries = await askMulti<LibraryOption>('Wants Libraries?', [
        { title: 'Zod', value: 'zod' },
        { title: 'TanStack Query', value: 'tanstack-query' },
        { title: 'TanStack Table', value: 'tanstack-table' },
        { title: 'TanStack Form', value: 'tanstack-form' },
        { title: 'TanStack Virtual', value: 'tanstack-virtual' },
        { title: 'TanStack Hotkeys', value: 'tanstack-hotkeys' },
      ]);
    }

    let databases: DatabaseOption[] = [];
    if (!simple && supportsDatabases(framework)) {
      const databaseChoices: { title: string; value: DatabaseOption }[] = [
        { title: 'Neon', value: 'neon' },
        { title: 'Drizzle ORM', value: 'drizzle' },
        { title: 'Convex', value: 'convex' },
        { title: 'Dexie.js', value: 'dexie' },
        { title: 'Supabase', value: 'supabase' },
      ];

      databases = await askMulti<DatabaseOption>(
        'Wants Databases?',
        databaseChoices.filter((choice) => {
          if (isHonoFramework(framework) && (choice.value === 'convex' || choice.value === 'dexie')) {
            return false;
          }
          return true;
        }),
      );
    }

    let auth: AuthOption[] = [];
    if (!simple && supportsAuth(framework)) {
      auth = await askMulti<AuthOption>('Wants Auth?', [
        { title: 'Clerk', value: 'clerk' },
        { title: 'Better Auth', value: 'better-auth' },
        { title: 'WorkOS', value: 'workos' },
      ]);
    }

    let deploy: DeployOption = 'none';
    if (!simple && supportsDeploy(framework)) {
      deploy = await askSelect<DeployOption>(
        'Deploy?',
        [
          { title: 'No', value: 'none' },
          { title: 'Cloudflare', value: 'cloudflare' },
          { title: 'Vercel', value: 'vercel' },
          { title: 'Netlify', value: 'netlify' },
        ],
        framework === 'hono-cloudflare-workers' ? 1 : 0,
      );
    }

    const installDependencies = await askToggle('Install dependencies?', true);

    const answers: ScaffolderAnswers = {
      projectName,
      root: path.resolve(process.cwd(), projectName),
      framework,
      useTailwind,
      shadcnUse: supportsShadcn(framework) ? shadcnUse : 'no',
      shadcnBase: supportsShadcn(framework) && shadcnUse !== 'no' ? shadcnBase : undefined,
      shadcnPreset: supportsShadcn(framework) ? shadcnPreset : undefined,
      toolchain,
      libraries,
      databases,
      auth,
      deploy,
      installDependencies,
      simple,
    };

    console.log(styleText('blue', 'Loading...'));
    await configureProject(answers);
    console.log(styleText('green', 'Project successfully created!'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(styleText('red', message));
    process.exit(1);
  }
}
