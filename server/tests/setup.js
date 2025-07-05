import { beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Global test setup
beforeAll(async () => {
  // Create necessary directories for testing
  const dirs = ['./uploads', './temp', './logs', './server/tests/fixtures'];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.PORT = '3002'; // Different port for testing
});

// Global test cleanup
afterAll(async () => {
  // Cleanup test files and directories
  const cleanupDirs = ['./temp', './server/tests/fixtures'];
  
  for (const dir of cleanupDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: console.error // Keep errors for debugging
};