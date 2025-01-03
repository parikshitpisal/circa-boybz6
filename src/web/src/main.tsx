import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ErrorBoundary } from '@sentry/react';
import { reportWebVitals } from 'web-vitals';

import App from './App';
import { store, persistor } from './store';

/**
 * Verifies browser compatibility with required features
 * @returns boolean indicating browser compatibility
 */
const checkBrowserCompatibility = (): boolean => {
  const requiredFeatures = {
    localStorage: !!window.localStorage,
    serviceWorker: 'serviceWorker' in navigator,
    webCrypto: 'crypto' in window && 'subtle' in window.crypto,
    asyncAwait: true
  };

  try {
    // Test async/await support
    new Function('async () => {}')();
  } catch {
    requiredFeatures.asyncAwait = false;
  }

  const missingFeatures = Object.entries(requiredFeatures)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature);

  if (missingFeatures.length > 0) {
    console.error('Browser missing required features:', missingFeatures);
    return false;
  }

  return true;
}

/**
 * Performance monitoring decorator
 */
const performanceMonitor = (markName: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      performance.mark(`${markName}-start`);
      const result = originalMethod.apply(this, args);
      performance.mark(`${markName}-end`);
      performance.measure(markName, `${markName}-start`, `${markName}-end`);
      return result;
    };
    return descriptor;
  };
};

/**
 * Renders the React application with all required providers
 */
@performanceMonitor('initial-render')
const renderApp = (): void => {
  // Verify browser compatibility
  if (!checkBrowserCompatibility()) {
    const message = 'Your browser is not supported. Please upgrade to a modern browser.';
    document.body.innerHTML = `<div role="alert" style="text-align: center; padding: 20px;">${message}</div>`;
    return;
  }

  // Get root element with type safety
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Render application with strict mode and providers
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={({ error }) => (
          <div role="alert" style={{ padding: '20px', color: 'red' }}>
            <h2>Application Error</h2>
            <pre>{error.message}</pre>
          </div>
        )}
      >
        <Provider store={store}>
          <PersistGate 
            loading={
              <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '20px' }}>
                Loading application...
              </div>
            } 
            persistor={persistor}
          >
            <App />
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize application
renderApp();

// Report web vitals
reportWebVitals(({ name, value, id }) => {
  // Log performance metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.debug('Web Vital:', { name, value, id });
  }
  
  // Send metrics to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    // Implementation would go here
  }
});

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}