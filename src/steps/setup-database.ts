import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { PromptResponses } from '../types';

export async function setupDatabase(root: string, pkg: any, db: PromptResponses['db'], optionals: PromptResponses['optionals']) {
  const depsToAdd: { name: string; isDev: boolean }[] = [];

  if (db.includes('neon') || db.includes('drizzle')) {
    depsToAdd.push({ name: 'drizzle-orm', isDev: false });
    depsToAdd.push({ name: 'drizzle-kit', isDev: true });
  }
  if (db.includes('neon')) {
    depsToAdd.push({ name: '@neondatabase/serverless', isDev: false });
  }
  if (db.includes('convex')) {
    depsToAdd.push({ name: 'convex', isDev: false });
    pkg.scripts['convex:dev'] = 'npx convex dev';
  }

  // --- Create .env and .env.example files ---
  const envVars = [];
  if (db.includes('neon') || db.includes('drizzle')) {
    envVars.push({
      key: 'DATABASE_URL',
      value: '"postgresql://user:password@host:port/db"',
      comment: '# Neon/Drizzle connection string',
    });
  }
  if (db.includes('convex')) {
    envVars.push(
      {
        key: 'CONVEX_URL',
        value: '""',
        comment: '# Populated by `npx convex dev`',
      },
      {
        key: 'CONVEX_DEPLOYMENT',
        value: '""',
        comment: '# Populated by `npx convex dev`',
      }
    );
  }
  if (optionals.includes('better-auth')) {
    envVars.push(
      {
        key: 'BETTER_AUTH_URL',
        value: '"http://localhost:3000"',
        comment: '# The base URL of your application',
      },
      {
        key: 'BETTER_AUTH_SECRET',
        value: '"replace_this_with_a_long_random_string"',
        comment: '# Generate with `npx @better-auth/cli secret`',
      }
    );
  }

  if (envVars.length > 0) {
    console.log(chalk.blue('[◉] Creating .env and .env.example files...'));

    const envExampleContent = envVars.map((v) => `${v.key}=`).join('\n');
    const envContent = envVars.map((v) => `${v.comment}\n${v.key}=${v.value}`).join('\n\n');

    await fs.writeFile(path.join(root, '.env.example'), envExampleContent);
    await fs.writeFile(path.join(root, '.env'), envContent);

    // Add .env to .gitignore
    const gitignorePath = path.join(root, '.gitignore');
    try {
      let gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('\n.env')) {
        gitignoreContent += '\n.env';
        await fs.writeFile(gitignorePath, gitignoreContent);
      }
    } catch (e) {
      // .gitignore doesn't exist, create it
      await fs.writeFile(gitignorePath, '.env');
    }
  }

  // 7. Add config files and templates
  console.log(chalk.blue('[◉] Adding config files and templates...'));

  if (db.includes('neon') || db.includes('drizzle')) {
    const drizzleConfig = `import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: { connectionString: process.env.DATABASE_URL! }
} satisfies Config;`;
    await fs.writeFile(path.join(root, 'drizzle.config.ts'), drizzleConfig);

    const dbDir = path.join(root, 'src', 'db');
    await fs.mkdir(dbDir, { recursive: true });
    const schema = `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow()
});`;
    await fs.writeFile(path.join(dbDir, 'schema.ts'), schema);
  }

  return { pkg, depsToAdd };
}
