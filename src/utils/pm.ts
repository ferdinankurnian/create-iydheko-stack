export function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent;
  const pm = userAgent?.split('/')[0] || 'npm';

  let execCmd: string;
  if (pm === 'bun') execCmd = 'bunx';
  else if (pm === 'pnpm') execCmd = 'pnpm dlx';
  else if (pm === 'yarn') execCmd = 'yarn dlx';
  else execCmd = 'npx';

  return { pm, execCmd };
}
