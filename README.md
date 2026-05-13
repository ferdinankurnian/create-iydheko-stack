# create-iydheko-stack

Minimal Bun-first project scaffolder.

## Usage

```bash
bun create iydheko-stack
bun create iydheko-stack my-app
```

```bash
npm create iydheko-stack@latest
npm create iydheko-stack@0.2.0-alpha
```

### Flags

```bash
-s, --simple      skip libraries, databases, auth, and deploy prompts
--preset <id>     provide shadcn preset id (default: nova)
```

## Frameworks

- Vite Vanilla
- Vite + React
- Vite + React + TanStack Router
- Vite + React + React Router
- TanStack Start
- NextJS
- Hono
- Hono + Cloudflare Workers
- Vite + Electron

## What it does

- Scaffolds the selected framework with Bun-oriented defaults
- Removes template boilerplate/bloat content
- Generates a minimal welcome screen/route
- Supports optional Tailwind, shadcn, toolchain, libraries, databases, auth, deploy
- Always initializes a git repository
- Optionally installs dependencies

## 0.2.0-alpha updates

- Publish output is now clean and minimal (only required runtime files are shipped)
- CLI project name input is validated more strictly
- Publish flow ensures executable CLI entrypoint shebang in `dist/bin/index.js`
- Shadcn preset defaults to `nova` and is now prompted directly in this CLI

## Local development

```bash
bun install
bun run dev
```

Build:

```bash
bun run build
```
