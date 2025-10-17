import { execa } from 'execa';
import chalk from 'chalk';

export async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execa('npm', ['view', packageName, 'version']);
    return stdout.trim();
  } catch (error) {
    console.error(chalk.red(`Error fetching latest version for ${packageName}:`), error);
    return 'latest'; // Fallback
  }
}
