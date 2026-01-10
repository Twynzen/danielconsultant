/**
 * Cross-platform script to copy dist folders for Netlify deployment
 * Combines: Landing Page + DeskFlow into a single dist folder
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Source paths
const LANDING_DIST = path.join(ROOT, 'dungeon-ai-landing', 'dist', 'dungeon-ai-landing', 'browser');
const DESKFLOW_DIST = path.join(ROOT, 'deskflow', 'dist', 'multidesktop-app', 'browser');

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source not found: ${src}`);
    process.exit(1);
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean and recreate dist folder
 */
function cleanDist() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
  }
  fs.mkdirSync(DIST, { recursive: true });
}

// Main execution
console.log('Copying dist folders...');
console.log(`Landing: ${LANDING_DIST}`);
console.log(`DeskFlow: ${DESKFLOW_DIST}`);

// Clean dist
cleanDist();

// Copy landing page to root of dist
console.log('Copying landing page...');
copyDir(LANDING_DIST, DIST);

// Copy DeskFlow to dist/deskflow
const DESKFLOW_DEST = path.join(DIST, 'deskflow');
console.log('Copying DeskFlow...');
copyDir(DESKFLOW_DIST, DESKFLOW_DEST);

console.log('Done! Combined dist ready at:', DIST);
