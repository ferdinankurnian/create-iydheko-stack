import { styleText } from 'util';
import { spawn } from 'child_process';
import { PromptResponses } from '../types';

function spawnSync(command: string, args: string[], options: any = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio || 'pipe', ...options });
    if (options.input) {
      child.stdin?.write(options.input);
      child.stdin?.end();
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Command failed with code ${code}`));
      else resolve();
    });
  });
}

export async function scaffold(
  projectName: string,
  flavor: PromptResponses['flavor'],
  pm: string
) {
  console.log();
  console.log(styleText('blue', `[◉] Scaffolding project with flavor: ${flavor} using ${pm}...`));

  if (flavor === 'tanstack-start' || flavor === 'electron-tanstack-start') {
    console.log();
    console.log(styleText('yellow', '[◉] Initializing TanStack Start...'));
    console.log(styleText('gray', '┌' + '─'.repeat(50)));
    console.log();
    await spawnSync(pm, ['create', '@tanstack/start', projectName], { stdio: 'inherit' });
    console.log();
    console.log(styleText('gray', '└' + '─'.repeat(50)));
    console.log();
  } else if (flavor === 'vite-minimal' || flavor === 'electron-minimal') {
    console.log();
    console.log(styleText('yellow', '[◉] Initializing Vite...'));
    console.log(styleText('gray', '┌' + '─'.repeat(50)));
    console.log();
    const vitePkg = pm === 'npm' ? 'vite@latest' : 'vite';
    await spawnSync(pm, ['create', vitePkg, projectName, '--template', 'react-ts'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      input: 'n\nn\n',
    });
    console.log();
    console.log(styleText('gray', '└' + '─'.repeat(50)));
    console.log();
  }

  console.log(styleText('blue', `[◉] Project scaffolded. Now adding extras...`));
}
