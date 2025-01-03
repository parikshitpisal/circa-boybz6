import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set Node.js as the test environment
  testEnvironment: 'node',

  // Define test file locations for all backend services
  roots: [
    '<rootDir>/services/api-gateway/tests',
    '<rootDir>/services/document-processor/tests',
    '<rootDir>/services/email-service/tests'
  ],

  // Pattern matching for test files
  testMatch: [
    '**/?(*.)+(spec|test).ts'
  ],

  // TypeScript transformation configuration
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Enable coverage collection
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover'
  ],

  // Set minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Module path aliases for clean imports
  moduleNameMapper: {
    '@shared/(.*)': '<rootDir>/shared/$1',
    '@api-gateway/(.*)': '<rootDir>/services/api-gateway/src/$1',
    '@document-processor/(.*)': '<rootDir>/services/document-processor/src/$1',
    '@email-service/(.*)': '<rootDir>/services/email-service/src/$1'
  },

  // Setup file for global test configuration
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts'
  ],

  // Test execution configuration
  testTimeout: 30000,
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};

export default config;