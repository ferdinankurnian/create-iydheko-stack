import chalk from 'chalk';
import { execa } from 'execa';

export async function finalize(root: string, pm: string) {
  console.log();
  console.log(chalk.blue(`[◉] Initializing git and installing all dependencies using ${pm}...`));
  console.log(chalk.gray('┌' + '─'.repeat(50)));
  console.log();
  await execa('git', ['init'], { cwd: root });
  await execa(pm, ['install'], { cwd: root, stdio: 'inherit' });
  console.log();
  console.log(chalk.gray('└' + '─'.repeat(50)));
  console.log();
}
