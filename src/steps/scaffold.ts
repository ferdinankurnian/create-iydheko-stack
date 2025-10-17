import { execa } from 'execa';
import chalk from 'chalk';
import { PromptResponses } from '../types';

export async function scaffold(
  projectName: string,
  flavor: PromptResponses['flavor'],
  pm: string
) {
  console.log();
  console.log(chalk.blue(`[◉] Scaffolding project with flavor: ${flavor} using ${pm}...`));

  if (flavor === 'tanstack-start' || flavor === 'electron-tanstack-start') {
    console.log();
    console.log(chalk.yellow('[◉] Initializing TanStack Start...'));
    console.log(chalk.gray('┌' + '─'.repeat(50)));
    console.log();
    await execa(pm, ['create', '@tanstack/start', projectName], { stdio: 'inherit' });
    console.log();
    console.log(chalk.gray('└' + '─'.repeat(50)));
    console.log();
  } else if (flavor === 'vite-minimal' || flavor === 'electron-minimal') {
    console.log();
    console.log(chalk.yellow('[◉] Initializing Vite...'));
    console.log(chalk.gray('┌' + '─'.repeat(50)));
    console.log();
    const vitePkg = pm === 'npm' ? 'vite@latest' : 'vite';
    await execa(pm, ['create', vitePkg, projectName, '--template', 'react-ts'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      input: 'n\nn\n',
    });
    console.log();
    console.log(chalk.gray('└' + '─'.repeat(50)));
    console.log();
  }

  console.log(chalk.blue(`[◉] Project scaffolded. Now adding extras...`));
}
