import { promises as fs } from 'fs';
import path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import { detectPackageManager } from './utils/pm';
import { PromptResponses } from './types';
import { scaffold } from './steps/scaffold';
import { setupElectron } from './steps/setup-electron';
import { setupTailwind } from './steps/setup-tailwind';
import { setupDatabase } from './steps/setup-database';
import { addDeps } from './steps/add-deps';
import { finalize } from './steps/finalize';

export async function run(projectNameFromArgs?: string) {
  const logo = `
      _     
  ___| |___ 
 / __| / __|
| (__| \__ \
 \___|_|___/
     |_|    

create-iydheko-stack
`;
  console.log(chalk.blue(logo));

  try {
    const { pm, execCmd } = detectPackageManager();

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
        }
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
            { title: 'TanStack Start', value: 'tanstack-start' },
            { title: 'Vite Project (Minimal)', value: 'vite-minimal' },
            { title: 'Electron App + TanStack Start', value: 'electron-tanstack-start' },
            { title: 'Electron App (Minimal)', value: 'electron-minimal' },
          ],
        },
        {
          type: 'select',
          name: 'style',
          message: 'Wanna use these for styling UI?',
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
            if (values.flavor === 'tanstack-start' || values.flavor === 'electron-tanstack-start') {
              return choices.filter((choice) => choice.value !== 'vitest');
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
      }
    );

    const { flavor, style, db, optionals } = responses;
    const root = path.join(process.cwd(), projectName!);

    await scaffold(projectName!, flavor, pm);

    const pkgPath = path.join(root, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    let pkg = JSON.parse(pkgContent);

    pkg.dependencies = pkg.dependencies || {};
    pkg.devDependencies = pkg.devDependencies || {};

    if (flavor === 'electron-tanstack-start' || flavor === 'electron-minimal') {
      pkg = await setupElectron(root, pkg, projectName!);
    }

    pkg = await setupTailwind(root, pkg, flavor, style, execCmd);

    const { pkg: pkgFromDb, depsToAdd: depsToAddFromDb } = await setupDatabase(root, pkg, db, optionals);
    pkg = pkgFromDb;

    pkg = await addDeps(pkg, depsToAddFromDb, optionals);

    await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));

    await finalize(root, pm);

    console.log(chalk.green(`[◉] Congrats! ${projectName} is ready to cook!`));
    console.log(chalk.blue(`[◉] Now, type: cd ${projectName} && ${pm} run dev`));
    if (db.length > 0 && db[0] !== 'none')
      console.log(chalk.yellow('[◉] DB setup: Don\'t forget to set .env with DATABASE_URL.'));
  } catch (error) {
    console.log();
    console.error(chalk.red(`[◉] An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}
