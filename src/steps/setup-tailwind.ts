import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { execa } from 'execa';
import { getLatestVersion } from '../utils/get-latest-version';
import { PromptResponses } from '../types';

export async function setupTailwind(
  root: string,
  pkg: any,
  flavor: PromptResponses['flavor'],
  style: PromptResponses['style'],
  execCmd: string
) {
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

    const isViteProject = flavor === 'tanstack-start' || flavor === 'vite-minimal';

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

  // We need to write the package.json here so the tailwind config can be installed
  const pkgPath = path.join(root, 'package.json');
  await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

  if (style === 'tailwindcss' || style === 'tailwindcss-shadcn') {
    const isViteProject = flavor === 'tanstack-start' || flavor === 'vite-minimal';

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
        console.error(
          chalk.red('[◉] Could not find a CSS file (styles.css, index.css, or app.css) in src/ to add Tailwind import.')
        );
      }
    } else {
      console.log(chalk.blue('[◉] Configuring Tailwind CSS for PostCSS...'));
      const postcssConfig = `export default {\n  plugins: {\n    '@tailwindcss/postcss': {},\n  },\n};`;
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
    // Configure tsconfig.json with path aliases for shadcn
    const tsconfigPath = path.join(root, 'tsconfig.json');
    try {
      const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
      const tsconfig = JSON.parse(tsconfigContent);

      // Check if import alias already exists
      const hasImportAlias =
        tsconfig.compilerOptions?.paths && (tsconfig.compilerOptions.paths['@/*'] || tsconfig.compilerOptions.paths['@']);

      if (!hasImportAlias) {
        console.log(chalk.blue('[◉] Configuring tsconfig.json with import aliases...'));
        // Add baseUrl and paths for import aliases
        tsconfig.compilerOptions = tsconfig.compilerOptions || {};
        tsconfig.compilerOptions.baseUrl = '.';
        tsconfig.compilerOptions.paths = tsconfig.compilerOptions.paths || {};
        tsconfig.compilerOptions.paths['@/*'] = ['./src/*'];

        await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));
      } else {
        console.log(chalk.blue('[◉] Import alias already exists in tsconfig.json, skipping...'));
      }
    } catch (e) {
      console.error(chalk.red('[◉] Failed to configure tsconfig.json'), e);
    }

    // Also configure vite.config.ts to resolve the @ alias
    const viteConfigPath = path.join(root, 'vite.config.ts');
    try {
      let viteConfigContent = await fs.readFile(viteConfigPath, 'utf-8');

      // Add path import if not present
      if (!viteConfigContent.includes("import path from 'path'") && !viteConfigContent.includes('import path from "path"')) {
        viteConfigContent = `import path from 'path';\n${viteConfigContent}`;
      }

      // Add resolve.alias if not present
      if (!viteConfigContent.includes('resolve:')) {
        viteConfigContent = viteConfigContent.replace(
          /export default defineConfig\(\{/,
          `export default defineConfig({\n  resolve: {\n    alias: {\n      '@': path.resolve(__dirname, './src'),\n    },\n  },`
        );
      }

      await fs.writeFile(viteConfigPath, viteConfigContent);
    } catch (e) {
      console.error(chalk.red('[◉] Failed to configure vite.config.ts'), e);
    }

    console.log();
    console.log(chalk.yellow('[◉] Initializing shadcn/ui...'));
    console.log(chalk.gray('┌' + '─'.repeat(50)));
    console.log();
    await execa(execCmd, ['shadcn@latest', 'init'], { cwd: root, stdio: 'inherit' });
    console.log();
    console.log(chalk.gray('└' + '─'.repeat(50)));
    console.log();
  }

  return pkg;
}
