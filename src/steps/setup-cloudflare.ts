import path from 'path';
import { promises as fs } from 'fs';
import { addDeps } from './add-deps';
import chalk from 'chalk';

export const setupCloudflare = async ({ projectDir, projectName }: { projectDir: string, projectName: string }) => {
  console.log();
  console.log(chalk.blue('[◉] Setting up Cloudflare...'));

  // 1. Add wrangler as a dev dependency
  const pkgJsonPath = path.join(projectDir, "package.json");
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
  const newPkg = await addDeps(pkgJson, [{ name: 'wrangler', isDev: true }], []);
  await fs.writeFile(pkgJsonPath, JSON.stringify(newPkg, null, 2));

  // 2. Create wrangler.toml file
  const wranglerTomlContent = `
name = "${projectName}"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[pages]
build_output_dir = "dist"
`;
  await fs.writeFile(
    path.join(projectDir, "wrangler.toml"),
    wranglerTomlContent.trim()
  );
  // 3. Add "deploy" script to package.json
  const finalPkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
  finalPkgJson.scripts = {
    ...finalPkgJson.scripts,
    deploy: "bun run build && wrangler pages deploy",
  };
  await fs.writeFile(pkgJsonPath, JSON.stringify(finalPkgJson, null, 2));

  console.log(chalk.blue('[◉] Cloudflare setup complete!'));
};
