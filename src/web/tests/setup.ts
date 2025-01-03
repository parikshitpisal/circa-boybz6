import '@testing-library/jest-dom'; // v5.16.5
import { server } from './mocks/server';

// Configure extended timeout for complex async operations
jest.setTimeout(10000);

// Configure comprehensive window.matchMedia mock for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress specific console warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress MSW-specific warnings
  if (typeof args[0] === 'string' && args[0].includes('[MSW]')) {
    return;
  }
  originalWarn.apply(console, args);
};

// Initialize test environment before all tests
beforeAll(() => {
  // Start MSW server with warning suppression
  server.listen({
    onUnhandledRequest: 'bypass',
  });
});

// Clean up after each test
afterEach(() => {
  // Reset request handlers to original state
  server.resetHandlers();
});

// Ensure complete cleanup after all tests
afterAll(() => {
  // Stop MSW server and cleanup
  server.close();
  
  // Restore console.warn
  console.warn = originalWarn;
});

// Configure custom Jest matchers
expect.extend({
  toBeResponsive(received: HTMLElement) {
    const computedStyle = window.getComputedStyle(received);
    const isResponsive = computedStyle.display !== 'none' && 
                        computedStyle.visibility !== 'hidden';
    
    return {
      message: () => `expected element to be responsive`,
      pass: isResponsive,
    };
  },
});

// Add custom type definitions for enhanced matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeResponsive(): R;
    }
  }
}