#!/usr/bin/env node

/**
 * Install pre-commit hooks for secret detection
 * This script is called automatically during npm install (via prepare script)
 */

import { execSync } from 'child_process';

try {
  // Check if pre-commit is available
  execSync('pre-commit --version', { stdio: 'pipe' });
  
  // Install pre-commit hooks
  execSync('pre-commit install', { stdio: 'inherit' });
  console.log('✅ Pre-commit hooks installed successfully');
} catch (error) {
  console.warn('⚠️  Warning: pre-commit not found. Security hooks not installed.');
  console.warn('   Install with: pip install pre-commit detect-secrets');
  console.warn('   Then run: npm run prepare');
}
