#!/usr/bin/env node
import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import { execa } from 'execa';

// Helper to get the latest version of a package from NPM registry
async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'version']);
    return stdout.trim();
  } catch (error) {
    console.error(chalk.red(`Error fetching latest version for ${packageName}:`), error);
    return 'latest'; // Fallback
  }
}

interface PromptResponses {
  flavor: 'tanstack-start' | 'tanstack-router-spa' | 'vite-minimal' | 'electron';
  style: 'none' | 'tailwindcss' | 'tailwindcss-shadcn';
  db: ('none' | 'neon' | 'drizzle' | 'convex' | 'dexie' | 'sqlite')[];
  optionals: ('better-auth' | 'zod' | 'vitest' | 'tanstack-query' | 'tanstack-table' | 'tanstack-form' | 'tanstack-devtools' | 'tanstack-virtual' | 'tanstack-store' | 'tanstack-db' | 'tanstack-ranger' | 'tanstack-pacer')[];
  pages: boolean;
  deploy: boolean;
}

const program = new Command();
program
  .name('create-iydheko-stack')
  .description('A quick template starter by Iydheko')
  .argument('[projectName]', 'name of the project')
  .action(async (projectNameFromArgs: string) => {
    const logo = `
      _     
  ___| |___ 
 / __| / __|
| (__| \\__ \\
 \\___|_|___/
     |_|    

create-iydheko-stack
`;
    console.log(chalk.blue(logo));
    try {
      // --- PACKAGE MANAGER DETECTION ---
      const userAgent = process.env.npm_config_user_agent;
      const pm = userAgent?.split('/')[0] || 'npm';
      // console.log(prefix, chalk.cyan(`Detected package manager: ${pm}`));

      let execCmd: string;
      if (pm === 'bun') execCmd = 'bunx';
      else if (pm === 'pnpm') execCmd = 'pnpm dlx';
      else if (pm === 'yarn') execCmd = 'yarn dlx';
      else execCmd = 'npx';
      // --- END DETECTION ---

      let projectName = projectNameFromArgs;

      if (!projectName) {
        const res = await prompts(
          {
            type: 'text',
            name: 'name',
            message: 'What is the name of your project?',
            initial: 'my-project',
          },
          {
            onCancel: () => {
              console.log(chalk.yellow('[◉] Cancelled?? okay, fine!'));
              process.exit(0);
            },
          },
        );
        if (!res.name) {
          console.log(chalk.red('[◉] Project name cannot be empty.'));
          process.exit(1);
        }
        projectName = res.name;
      }

      const responses: PromptResponses = await prompts(
        [
          {           
            type: 'select',
            name: 'flavor',
            message: 'What kind of project do you want to build?',
            choices: [
              { title: 'TanStack Start (Full-stack SSR Framework)', value: 'tanstack-start' },
              { title: 'Vite + TanStack Router (Client-side SPA)', value: 'tanstack-router-spa' },
              { title: 'Vite Project (Minimal)', value: 'vite-minimal' },
              { title: 'Electron App (Desktop Application)', value: 'electron' },
            ],
          },
          {
            type: 'select',
            name: 'style',
            message: 'Wanna use these?',
            choices: [
              { title: 'No', value: 'none' },
              { title: 'Tailwind CSS', value: 'tailwindcss' },
              { title: 'Tailwind CSS + shadcn', value: 'tailwindcss-shadcn' },
            ],
          },
          {
            type: 'multiselect',
            name: 'db',
            message: 'Wanna use database?',
            choices: [
              { title: 'Neon', value: 'neon' },
              { title: 'Drizzle ORM', value: 'drizzle' },
              { title: 'Convex', value: 'convex' },
              { title: 'Dexie.js', value: 'dexie' },
              { title: 'sqlite', value: 'sqlite' },
            ],
          },
          {
            type: 'multiselect',
            name: 'optionals',
            message: 'Optionals?',
            choices: (prev, values) => {
              const choices = [
                { title: 'Better Auth', value: 'better-auth' },
                { title: 'Zod', value: 'zod' },
                { title: 'Vitest', value: 'vitest' },
                { title: 'Tanstack Query', value: 'tanstack-query' },
                { title: 'Tanstack Table', value: 'tanstack-table' },
                { title: 'Tanstack Form', value: 'tanstack-form' },
                { title: 'Tanstack Devtools', value: 'tanstack-devtools' },
                { title: 'Tanstack Virtual', value: 'tanstack-virtual' },
                { title: 'Tanstack Store', value: 'tanstack-store' },
                { title: 'Tanstack DB', value: 'tanstack-db' },
                { title: 'Tanstack Ranger', value: 'tanstack-ranger' },
                { title: 'Tanstack Pacer', value: 'tanstack-pacer' },
              ];
              if (values.flavor === 'tanstack-start') {
                return choices.filter(choice => choice.value !== 'tanstack-query');
              }
              return choices;
            },
          },
          {
            type: 'toggle',
            name: 'pages',
            message: 'Wanna add pages template example?',
            initial: true,
            active: 'Yes',
            inactive: 'No',
          },
          {
            type: 'toggle',
            name: 'deploy',
            message: 'Wanna deploy to Cloudflare?',
            initial: false,
            active: 'Yes',
            inactive: 'No',
          },
        ],
        {
          onCancel: () => {
            console.log(chalk.yellow('[◉] Cancelled?? okay, fine!'));
            process.exit(0);
          },
        },
      );

      const { flavor, style, db, optionals } = responses;
      const root = path.join(process.cwd(), projectName);

      console.log();
      console.log(chalk.blue(`[◉] Scaffolding project with flavor: ${flavor} using ${pm}...`));

      // 1. Delegate scaffolding to official CLIs
      if (flavor === 'tanstack-start') {
        console.log(chalk.yellow('[◉] Initializing TanStack Start...'));
        console.log(chalk.gray('┌' + '─'.repeat(50)));
        await execa(pm, ['create', '@tanstack/start', projectName], { stdio: 'inherit' });
        console.log(chalk.gray('└' + '─'.repeat(50)));
      } else if (flavor === 'tanstack-router-spa' || flavor === 'vite-minimal') {
        console.log(chalk.yellow('[◉] Initializing Vite...'));
        console.log(chalk.gray('┌' + '─'.repeat(50)));
        const vitePkg = pm === 'npm' ? 'vite@latest' : 'vite';
        await execa(pm, ['create', vitePkg, projectName, '--template', 'react-ts'], { stdio: 'inherit' });
        console.log(chalk.gray('└' + '─'.repeat(50)));
      } else if (flavor === 'electron') {
        console.log(chalk.yellow('[◉] Initializing Electron + Vite...'));
        console.log(chalk.gray('┌' + '─'.repeat(50)));
        const electronVitePkg = pm === 'npm' ? '@electron-vite/app@latest' : '@electron-vite/app';
        await execa(pm, ['create', electronVitePkg, projectName], { stdio: 'inherit' });
        console.log(chalk.gray('└' + '─'.repeat(50)));
      }

      console.log();
      console.log(chalk.blue(`[◉] Project scaffolded. Now adding Iydheko Stack extras...`));

      // 2. Read the generated package.json
      const pkgPath = path.join(root, 'package.json');
      const pkgContent = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      pkg.dependencies = pkg.dependencies || {};
      pkg.devDependencies = pkg.devDependencies || {};

      // 3. Overwrite/update specific dependencies to their latest versions
      if (style === 'tailwindcss' || style === 'tailwindcss-shadcn') {
        console.log(chalk.blue('[◉] Adding Tailwind CSS v4 dependencies...'));
        const latestTailwind = await getLatestVersion('tailwindcss');
        if (pkg.dependencies['tailwindcss']) delete pkg.dependencies['tailwindcss'];
        pkg.devDependencies['tailwindcss'] = `^${latestTailwind}`;

        // Remove postcss and autoprefixer if they exist, as they are not needed for v4 with Vite
        if (pkg.dependencies['postcss']) delete pkg.dependencies['postcss'];
        if (pkg.devDependencies['postcss']) delete pkg.devDependencies['postcss'];
        if (pkg.dependencies['autoprefixer']) delete pkg.dependencies['autoprefixer'];
        if (pkg.devDependencies['autoprefixer']) delete pkg.devDependencies['autoprefixer'];

        const isViteProject = flavor === 'tanstack-start' || flavor === 'tanstack-router-spa' || flavor === 'vite-minimal';

        if (isViteProject) {
          const latestVitePlugin = await getLatestVersion('@tailwindcss/vite');
          if (pkg.dependencies['@tailwindcss/vite']) delete pkg.dependencies['@tailwindcss/vite'];
          pkg.devDependencies['@tailwindcss/vite'] = `^${latestVitePlugin}`;
        } else {
          // For non-Vite projects like Electron, we might still need postcss
          const latestPostcssPlugin = await getLatestVersion('@tailwindcss/postcss');
          if (pkg.dependencies['@tailwindcss/postcss']) delete pkg.dependencies['@tailwindcss/postcss'];
          pkg.devDependencies['@tailwindcss/postcss'] = `^${latestPostcssPlugin}`;
        }
      }

      // 4. Prepare a list of OTHER additional dependencies
      const depsToAdd: { name: string; isDev: boolean }[] = [];
      
      if (db.includes('neon') || db.includes('drizzle')) {
        depsToAdd.push({ name: 'drizzle-orm', isDev: false });
        depsToAdd.push({ name: 'drizzle-kit', isDev: true });
      }
      if (db.includes('neon')) {
        depsToAdd.push({ name: '@neondatabase/serverless', isDev: false });
      }
      if (db.includes('convex')) {
        depsToAdd.push({ name: 'convex', isDev: false });
        pkg.scripts['convex:dev'] = 'npx convex dev';
      }
      if (optionals.includes('tanstack-query')) depsToAdd.push({ name: '@tanstack/react-query', isDev: false });
      if (optionals.includes('zod')) depsToAdd.push({ name: 'zod', isDev: false });
      if (optionals.includes('better-auth')) depsToAdd.push({ name: 'better-auth', isDev: false });
      if (optionals.includes('vitest')) depsToAdd.push({ name: 'vitest', isDev: true });

      // 5. Fetch latest versions for these other dependencies and add to pkg object
      if (depsToAdd.length > 0) {
        console.log(chalk.blue('[◉] Fetching latest versions for additional dependencies...'));
        await Promise.all(
          depsToAdd.map(async (dep) => {
            const version = await getLatestVersion(dep.name);
            console.log(`  - Adding ${dep.name}@${version}`);
            if (dep.isDev) {
              pkg.devDependencies[dep.name] = `^${version}`;
            } else {
              pkg.dependencies[dep.name] = `^${version}`;
            }
          })
        );
      }

      // 6. Write the updated package.json back
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      
      // 7. Add config files and templates
      console.log(chalk.blue('[◉] Adding config files and templates...'));
      
      if (db.includes('neon') || db.includes('drizzle')) {
        const drizzleConfig = `import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: { connectionString: process.env.DATABASE_URL! }
} satisfies Config;`;
        await fs.writeFile(path.join(root, 'drizzle.config.ts'), drizzleConfig);
        
        const dbDir = path.join(root, 'src', 'db');
        await fs.mkdir(dbDir, { recursive: true });
        const schema = `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});`;
        await fs.writeFile(path.join(dbDir, 'schema.ts'), schema);
      }

      // 8. Run final commands
      console.log();
      console.log(chalk.blue(`[◉] Initializing git and installing all dependencies using ${pm}...`));
      console.log(chalk.gray('┌' + '─'.repeat(50)));
      await execa('git', ['init'], { cwd: root });
      await execa(pm, ['install'], { cwd: root, stdio: 'inherit' });
      console.log(chalk.gray('└' + '─'.repeat(50)));

      if (style === 'tailwindcss' || style === 'tailwindcss-shadcn') {
        const isViteProject = flavor === 'tanstack-start' || flavor === 'tanstack-router-spa' || flavor === 'vite-minimal';

        if (isViteProject) {
          console.log(chalk.blue('[◉] Configuring Tailwind CSS for Vite...'));
          const viteConfigPath = path.join(root, 'vite.config.ts');
          try {
            let viteConfigContent = await fs.readFile(viteConfigPath, 'utf-8');

            if (!viteConfigContent.includes('@tailwindcss/vite')) {
              viteConfigContent = `import tailwindcss from '@tailwindcss/vite';\n${viteConfigContent}`;
              viteConfigContent = viteConfigContent.replace(
                /plugins: \[(.*)\]/s,
                (match, p1) => `plugins: [tailwindcss(), ${p1}]`
              );
              await fs.writeFile(viteConfigPath, viteConfigContent);
            }
          } catch (e) {
            console.error(chalk.red('[◉] Failed to configure vite.config.ts for Tailwind CSS.'), e);
          }

          const cssFilePaths = [
            path.join(root, 'src', 'styles.css'),
            path.join(root, 'src', 'index.css'),
            path.join(root, 'src', 'app.css'),
          ];
          let cssFileConfigured = false;
          for (const cssPath of cssFilePaths) {
            try {
              let cssContent = await fs.readFile(cssPath, 'utf-8');
              if (!cssContent.startsWith('@import "tailwindcss"')) {
                cssContent = `@import "tailwindcss";\n${cssContent}`;
                await fs.writeFile(cssPath, cssContent);
              }
              cssFileConfigured = true;
              break;
            } catch (e) {}
          }
          if (!cssFileConfigured) {
            console.error(chalk.red('[◉] Could not find a CSS file (styles.css, index.css, or app.css) in src/ to add Tailwind import.'));
          }

        } else {
          console.log(chalk.blue('[◉] Configuring Tailwind CSS for PostCSS...'));
          const postcssConfig = `module.exports = {\n  plugins: {\n    '@tailwindcss/postcss': {},\n  },\n};`;
          await fs.writeFile(path.join(root, 'postcss.config.js'), postcssConfig);
          
          const cssFilePath = path.join(root, 'src', 'index.css');
           try {
              let cssContent = await fs.readFile(cssFilePath, 'utf-8');
              if (!cssContent.startsWith('@import "tailwindcss"')) {
                cssContent = `@import "tailwindcss";\n${cssContent}`;
                await fs.writeFile(cssFilePath, cssContent);
              }
            } catch (e) {
                console.error(chalk.red('[◉] Failed to add @import "tailwindcss" to CSS file.'), e);
            }
        }
      }
      if (style === 'tailwindcss-shadcn') {
        console.log(chalk.yellow('[◉] Initializing shadcn/ui...'));
        console.log(chalk.gray('┌' + '─'.repeat(50)));
        await execa(execCmd, ['shadcn@latest', 'init'], { cwd: root, stdio: 'inherit' });
        console.log(chalk.gray('└' + '─'.repeat(50)));
      }
      if (flavor === 'tanstack-router-spa' || flavor === 'tanstack-start') {
        // TanStack Router is usually added by the starter, but init can be useful
        // await execa(execCmd, ['@tanstack/router-cli@latest', 'init'], { cwd: root, stdio: 'inherit' });
      }

      console.log();
      console.log(chalk.green(`[◉] Yeay! ${projectName} siap dengan Iydheko Stack.`));
      console.log(chalk.blue(`[◉] Sekarang, ketik: cd ${projectName} && ${pm} run dev`));
      if (db.length > 0 && db[0] !== 'none') console.log(chalk.yellow('[◉] DB setup: Jangan lupa atur .env dengan DATABASE_URL lo.'));

    } catch (error) {
      console.log();
      console.error(chalk.red(`[◉] An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

program.parse();