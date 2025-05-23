// Script to prepare the project for Linux deployment
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}Starting cross-platform preparation for OK Dashboard${colors.reset}`);

// Step 1: Update package.json to use WASM version of lightningcss
try {
  console.log(`${colors.yellow}Updating package.json to use platform-independent modules...${colors.reset}`);
  
  const packageJsonPath = path.join(__dirname, 'package.json');
  const packageJson = require(packageJsonPath);
  
  // Update the clean script to be cross-platform
  packageJson.scripts.clean = packageJson.scripts.clean.replace('rmdir /s /q', 'rm -rf');
  
  // Add the WASM version of lightningcss
  packageJson.dependencies.lightningcss = 'npm:lightningcss-wasm@^1.24.1';
  
  // Write the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`${colors.green}✓ package.json updated${colors.reset}`);
  
  // Create a .npmrc file to force using the WASM version
  console.log(`${colors.yellow}Creating .npmrc file...${colors.reset}`);
  fs.writeFileSync(
    path.join(__dirname, '.npmrc'),
    'node-linker=hoisted\n' +
    'public-hoist-pattern[]=*lightningcss*\n'
  );
  console.log(`${colors.green}✓ .npmrc created${colors.reset}`);
  
  // Create a cross-platform next.config.js
  updateNextConfig();
  
  console.log(`${colors.blue}\nPlatform preparation complete. Next steps:${colors.reset}`);
  console.log(`${colors.yellow}1. Run: npm ci --force${colors.reset}`);
  console.log(`${colors.yellow}2. Run: npm run build${colors.reset}`);
  console.log(`${colors.yellow}3. Copy the entire project to Linux${colors.reset}`);
  console.log(`${colors.yellow}4. On Linux, run: npm start${colors.reset}`);
  
} catch (error) {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
}

function updateNextConfig() {
  console.log(`${colors.yellow}Updating next.config.js...${colors.reset}`);
  
  const nextConfigPath = path.join(__dirname, 'next.config.js');
  let nextConfigContent;
  
  try {
    nextConfigContent = fs.readFileSync(nextConfigPath, 'utf8');
  } catch (error) {
    nextConfigContent = `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\n\nmodule.exports = nextConfig;`;
  }
  
  // Check if it already has experimental settings
  if (nextConfigContent.includes('experimental')) {
    if (!nextConfigContent.includes('disableExperimentalTailwindcss')) {
      nextConfigContent = nextConfigContent.replace(
        /experimental\s*:\s*{/,
        `experimental: {\n  disableExperimentalTailwindcss: true,`
      );
    }
  } else {
    // Add experimental settings
    nextConfigContent = nextConfigContent.replace(
      /const nextConfig = {/,
      `const nextConfig = {\n  experimental: {\n    disableExperimentalTailwindcss: true\n  },`
    );
    
    // If there's no config object yet
    if (!nextConfigContent.includes('const nextConfig = {')) {
      nextConfigContent = nextConfigContent.replace(
        /const nextConfig = ({})?\s*;/,
        `const nextConfig = {\n  experimental: {\n    disableExperimentalTailwindcss: true\n  }\n};`
      );
    }
  }
  
  fs.writeFileSync(nextConfigPath, nextConfigContent);
  console.log(`${colors.green}✓ next.config.js updated${colors.reset}`);
}
