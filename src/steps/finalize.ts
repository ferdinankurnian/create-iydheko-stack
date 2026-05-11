import { styleText } from 'util';
import { spawn } from 'child_process';
import { PromptResponses } from '../types';

function spawnSync(command: string, args: string[], options: any = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio || 'pipe', ...options });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`Command failed with code ${code}`));
      else resolve();
    });
  });
}

export async function finalize(root: string, pm: string, flavor: PromptResponses['flavor']) {
  console.log();
  console.log(styleText('blue', `[◉] Initializing git and installing all dependencies using ${pm}...`));
  console.log(styleText('gray', '┌' + '─'.repeat(50)));
  console.log();
  if (flavor.includes('tanstack')) {
    await spawnSync('git', ['branch', '-M', 'main'], { cwd: root });
  } else {
    await spawnSync('git', ['init', '-b', 'main'], { cwd: root });
  }
  await spawnSync(pm, ['install'], { cwd: root, stdio: 'inherit' });
  console.log();
  console.log(styleText('gray', '└' + '─'.repeat(50)));
  console.log();
}