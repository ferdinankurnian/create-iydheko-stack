import { execFile } from 'child_process';
import { promisify } from 'util';
import { styleText } from 'util';

const execFileAsync = promisify(execFile);

export async function getLatestVersion(packageName: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('npm', ['view', packageName, 'version']);
    return stdout.trim();
  } catch (error) {
    console.error(styleText('red', `Error fetching latest version for ${packageName}:`), error);
    return 'latest'; // Fallback
  }
}
