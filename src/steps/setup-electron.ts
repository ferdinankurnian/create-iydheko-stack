import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getLatestVersion } from '../utils/get-latest-version';

export async function setupElectron(root: string, pkg: any, projectName: string) {
  console.log(chalk.blue('[◉] Setting up Electron...'));

  // Add Electron dependencies
  const electronVersion = await getLatestVersion('electron');
  const electronBuilderVersion = await getLatestVersion('electron-builder');

  pkg.devDependencies['electron'] = `^${electronVersion}`;
  pkg.devDependencies['electron-builder'] = `^${electronBuilderVersion}`;

  // Add concurrently for running multiple processes
  const concurrentlyVersion = await getLatestVersion('concurrently');
  pkg.devDependencies['concurrently'] = `^${concurrentlyVersion}`;

  // Add wait-on to wait for dev server before launching Electron
  const waitOnVersion = await getLatestVersion('wait-on');
  pkg.devDependencies['wait-on'] = `^${waitOnVersion}`;

  // Update package.json scripts
  pkg.main = 'dist-electron/main.js';

  // Backup original dev script
  const originalDevScript = pkg.scripts.dev || pkg.scripts.start;

  pkg.scripts = {
    ...pkg.scripts,
    'dev:web': originalDevScript,
    'dev:electron': 'tsc -p tsconfig.electron.json && electron .',
    dev: `concurrently "npm run dev:web" "wait-on http://localhost:3000 && npm run dev:electron"`,
    'build:web': pkg.scripts.build || 'vite build',
    'build:electron': 'tsc -p tsconfig.electron.json',
    build: 'npm run build:web && npm run build:electron',
    package: 'npm run build && electron-builder',
    'package:win': 'npm run build && electron-builder --win',
    'package:mac': 'npm run build && electron-builder --mac',
    'package:linux': 'npm run build && electron-builder --linux',
  };

  // Add electron-builder config to package.json
  pkg.build = {
    appId: `com.iydheko.${projectName}`,
    productName: projectName,
    files: ['dist/**/*', 'dist-electron/**/*', 'node_modules/**/*', 'package.json'],
    directories: {
      output: 'release',
      buildResources: 'build',
    },
    win: {
      target: ['nsis'],
      icon: 'build/icon.ico',
    },
    mac: {
      target: ['dmg'],
      icon: 'build/icon.icns',
      category: 'public.app-category.utilities',
    },
    linux: {
      target: ['AppImage', 'deb'],
      icon: 'build/icon.png',
      category: 'Utility',
    },
  };

  // Create tsconfig.electron.json for Electron main process
  const tsconfigElectron = {
    extends: './tsconfig.json',
    compilerOptions: {
      module: 'commonjs',
      outDir: 'dist-electron',
      target: 'ES2020',
      lib: ['ES2020'],
      moduleResolution: 'node',
      skipLibCheck: true,
      types: ['node'],
    },
    include: ['electron/**/*'],
    exclude: ['node_modules', 'dist', 'dist-electron', 'release'],
  };

  await fs.writeFile(path.join(root, 'tsconfig.electron.json'), JSON.stringify(tsconfigElectron, null, 2));

  // Create electron directory
  const electronDir = path.join(root, 'electron');
  await fs.mkdir(electronDir, { recursive: true });

  // Create main.ts
  const mainTs = `import { app, BrowserWindow } from 'electron';
      import path from 'path';

      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

      function createWindow() {
        const mainWindow = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
          },
        });

        if (isDev) {
          // Development: load from dev server
          mainWindow.loadURL('http://localhost:3000');
          mainWindow.webContents.openDevTools();
        } else {
          // Production: load from built files
          mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        }
      }

      app.whenReady().then(() => {
        createWindow();

        app.on('activate', () => {
          if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
          }
        });
      });

      app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
          app.quit();
        }
      });
      `;

  await fs.writeFile(path.join(electronDir, 'main.ts'), mainTs);

  // Create preload.ts
  const preloadTs = `import { contextBridge, ipcRenderer } from 'electron';

      // Expose protected methods that allow the renderer process to use
      // the ipcRenderer without exposing the entire object
      contextBridge.exposeInMainWorld('electron', {
        // Example: send message to main process
        send: (channel: string, data: any) => {
          // Whitelist channels
          const validChannels = ['toMain'];
          if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
          }
        },
        // Example: receive message from main process
        receive: (channel: string, func: (...args: any[]) => void) => {
          const validChannels = ['fromMain'];
          if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
          }
        },
      });

      // Type definitions for window.electron
      declare global {
        interface Window {
          electron: {
            send: (channel: string, data: any) => void;
            receive: (channel: string, func: (...args: any[]) => void) => void;
          };
        }
      }
      `;

  await fs.writeFile(path.join(electronDir, 'preload.ts'), preloadTs);

  // Create build directory for icons (placeholder)
  const buildDir = path.join(root, 'build');
  await fs.mkdir(buildDir, { recursive: true });

  // Create a placeholder README for icons
  const iconsReadme = `# App Icons

      Place your app icons here:
      - 
icon.ico
 - Windows icon (256x256)
      - 
icon.icns
 - macOS icon (512x512)
      - 
icon.png
 - Linux icon (512x512)

      You can use tools like:
      - https://www.iconfinder.com/
      - https://icon.kitchen/
      - https://www.electronforge.io/guides/create-and-add-icons
      `;

  await fs.writeFile(path.join(buildDir, 'README.md'), iconsReadme);

  // Update .gitignore
  const gitignorePath = path.join(root, '.gitignore');
  try {
    let gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
    const electronIgnores = '\n# Electron\ndist-electron/\nrelease/\n';
    if (!gitignoreContent.includes('dist-electron')) {
      gitignoreContent += electronIgnores;
      await fs.writeFile(gitignorePath, gitignoreContent);
    }
  } catch (e) {
    await fs.writeFile(gitignorePath, '.env\n# Electron\ndist-electron/\nrelease/\n');
  }

  console.log(chalk.green('[◉] Electron setup complete!'));
  return pkg;
}
