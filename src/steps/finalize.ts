import chalk from 'chalk';
import { execa } from 'execa';
import { PromptResponses } from '../types';

export async function finalize(root: string, pm: string, flavor: PromptResponses['flavor']) {
  console.log();
  console.log(chalk.blue(`[◉] Initializing git and installing all dependencies using ${pm}...`));
  console.log(chalk.gray('┌' + '─'.repeat(50)));
  console.log();
  if (flavor.includes('tanstack')) {
    await execa('git', ['branch', '-M', 'main'], { cwd: root });
  } else {
    await execa('git', ['init', '-b', 'main'], { cwd: root });
  }
  await execa(pm, ['install'], { cwd: root, stdio: 'inherit' });
  console.log();
  console.log(chalk.gray('└' + '─'.repeat(50)));
  console.log();
}