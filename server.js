#!/usr/bin/env node
/**
 * Root launcher for The 29 Game LAN Host Server.
 * Runs `npx tsx server/index.ts` to execute the TypeScript server directly without manual transpilation.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.join(__dirname, 'server', 'index.ts');

const child = spawn('npx', ['tsx', serverScript], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
