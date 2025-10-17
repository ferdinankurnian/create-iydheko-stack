import chalk from 'chalk';
import { getLatestVersion } from '../utils/get-latest-version';
import { PromptResponses } from '../types';

export async function addDeps(
  pkg: any,
  depsToAddFromDb: { name: string; isDev: boolean }[],
  optionals: PromptResponses['optionals']
) {
  const depsToAdd: { name: string; isDev: boolean }[] = [...depsToAddFromDb];

  if (optionals.includes('tanstack-query')) depsToAdd.push({ name: '@tanstack/react-query', isDev: false });
  if (optionals.includes('tanstack-table')) depsToAdd.push({ name: '@tanstack/react-table', isDev: false });
  if (optionals.includes('tanstack-form')) depsToAdd.push({ name: '@tanstack/react-form', isDev: false });
  if (optionals.includes('tanstack-devtools')) depsToAdd.push({ name: '@tanstack/react-query-devtools', isDev: false });
  if (optionals.includes('tanstack-virtual')) depsToAdd.push({ name: '@tanstack/react-virtual', isDev: false });
  if (optionals.includes('tanstack-store')) depsToAdd.push({ name: '@tanstack/react-store', isDev: false });
  if (optionals.includes('tanstack-db')) depsToAdd.push({ name: '@tanstack/db', isDev: false });
  if (optionals.includes('tanstack-ranger')) depsToAdd.push({ name: '@tanstack/ranger', isDev: false });
  if (optionals.includes('tanstack-pacer')) depsToAdd.push({ name: '@tanstack/pacer', isDev: false });
  if (optionals.includes('zod')) depsToAdd.push({ name: 'zod', isDev: false });
  if (optionals.includes('better-auth')) depsToAdd.push({ name: 'better-auth', isDev: false });
  if (optionals.includes('vitest')) depsToAdd.push({ name: 'vitest', isDev: true });

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

  return pkg;
}
