import path from 'path';
import { promises as fs } from 'fs';
import { addDeps } from './add-deps';
import { Ctx } from '../types';

export const setupCloudflare = async (ctx: Ctx) => {
  console.log('Setting up Cloudflare...');

  // TODO:
  // 1. Add wrangler as a dev dependency
  await addDeps(ctx, ['wrangler'], { dev: true });
  // 2. Create wrangler.toml file
  const wranglerTomlContent = `
name = "${ctx.projectName}"
compatibility_date = "${new Date().toISOString().split('T')[0]}"

[pages]
build_output_dir = "dist"
`;
  await fs.writeFile(
    path.join(ctx.projectDir, "wrangler.toml"),
    wranglerTomlContent.trim()
  );
  // 3. Add "deploy" script to package.json
  const pkgJsonPath = path.join(ctx.projectDir, "package.json");
  const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf-8"));
  pkgJson.scripts = {
    ...pkgJson.scripts,
    deploy: "bun run build && wrangler pages deploy",
  };
  await fs.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  console.log('Cloudflare setup complete!');
};
