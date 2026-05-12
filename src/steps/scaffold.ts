import { styleText } from 'util';
import { spawn } from 'child_process';

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

type Framework = 'vite-vanilla-ts' | 'vite-react';

function getTemplate(framework: Framework) {
  return framework === 'vite-react' ? 'react-ts' : 'vanilla-ts';
}

export async function scaffold(projectName: string, framework: Framework, execCmd: string) {
  console.log();
  console.log(styleText('blue', `[◉] Scaffolding ${framework === 'vite-react' ? 'Vite + React' : 'Vite Vanilla (TS)'}...`));
  console.log(styleText('gray', '┌' + '─'.repeat(50)));
  console.log();

  const [command, ...baseArgs] = execCmd.split(' ');
  if (!command) throw new Error('No package manager command found.');
  await spawnSync(command, [...baseArgs, 'create-vite', projectName, '--template', getTemplate(framework), '--no-interactive'], {
    stdio: 'inherit',
  });

  console.log();
  console.log(styleText('gray', '└' + '─'.repeat(50)));
  console.log();
  console.log(styleText('blue', '[◉] Project scaffolded. All done!'));
}
