#!/usr/bin/env node
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const platform = process.platform;
const isWindows = platform === 'win32';
const isMac = platform === 'darwin';
const isLinux = platform === 'linux';

function log(msg) {
  console.log(`[BUILD] ${msg}`);
}

function error(msg) {
  console.error(`[ERROR] ${msg}`);
  process.exit(1);
}

function getPlatformName() {
  if (isWindows) return 'Windows';
  if (isMac) return 'macOS';
  if (isLinux) return 'Linux';
  return 'Unknown';
}

async function build() {
  try {
    log(`Detected platform: ${getPlatformName()} (${platform})`);

    // Check if dependencies are installed
    if (!fs.existsSync('node_modules')) {
      log('Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }

    // Run the appropriate build command
    let buildCmd = 'npm run build';
    if (isWindows) {
      log('Building for Windows...');
      buildCmd = 'npm run build:win';
    } else if (isMac) {
      log('Building for macOS...');
      buildCmd = 'npm run build:mac';
    } else if (isLinux) {
      log('Building for Linux...');
      buildCmd = 'npm run build';
    }

    log(`Executing: ${buildCmd}`);
    execSync(buildCmd, { stdio: 'inherit', cwd: process.cwd() });

    // Check for output in common locations
    const outputDir = path.join(process.cwd(), 'out');
    if (fs.existsSync(outputDir)) {
      log(`Build output directory: ${outputDir}`);
      const files = execSync(`find "${outputDir}" -type f`, { encoding: 'utf-8' });
      log(`Generated files:\n${files}`);
    }

    log('✓ Build completed successfully');
    process.exit(0);
  } catch (err) {
    error(`Build failed: ${err.message}`);
  }
}

build();
