import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { PromptResponses } from '../types';

export async function addPages(
  projectName: string,
  flavor: PromptResponses['flavor'],
  pages: boolean
) {
  if (!pages) return;

  const projectRoot = path.join(process.cwd(), projectName);
  const templateDir = path.join(__dirname, '..', 'templates', flavor);

  try {
    await fs.access(templateDir);
    const entries = await fs.readdir(templateDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const srcPath = path.join(templateDir, entry.name);
        let destPath;

        // Determine destination based on flavor
        if (flavor === 'tanstack-start' || flavor === 'electron-tanstack-start') {
          destPath = path.join(projectRoot, 'src', 'routes', entry.name);
        } else {
          destPath = path.join(projectRoot, 'src', 'components', entry.name);
        }

        await fs.copyFile(srcPath, destPath);
        console.log(chalk.green(`[◉] Added page template: ${entry.name}`));
      }
    }
  } catch (error) {
    console.log(chalk.yellow(`[◉] No templates found for flavor: ${flavor}`));
  }
}