/**
 * Root Redux Store Configuration
 * Implements centralized state management with enhanced security and performance monitoring
 * @version 1.0.0
 */

import { configureStore, combineReducers, Middleware } from '@reduxjs/toolkit'; // v1.9.5
import { persistStore, persistReducer, createTransform } from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage'; // v6.0.0
import createEncryptedStorage from 'redux-persist-encrypt-storage'; // v2.0.0
import monitoringMiddleware from '@redux-monitoring/middleware'; // v2.0.0
import errorMiddleware from '@redux-middleware/error-handler'; // v1.0.0
import CryptoJS from 'crypto-js'; // v4.1.1

// Import reducers
import applicationReducer from './reducers/application.reducer';
import documentReducer from './reducers/document.reducer';
import authReducer from './reducers/auth.reducer';
import webhookReducer from './reducers/webhook.reducer';

/**
 * Create encrypted storage for sensitive data
 */
const encryptedStorage = createEncryptedStorage({
  key: process.env.VITE_STORAGE_ENCRYPTION_KEY || '',
  storage,
  algorithm: 'AES-256-GCM'
});

/**
 * Transform for encrypting sensitive data before persistence
 */
const encryptTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState: any, key) => {
    if (key === 'auth') {
      const { user, ...rest } = inboundState;
      if (user) {
        return {
          ...rest,
          user: CryptoJS.AES.encrypt(
            JSON.stringify(user),
            process.env.VITE_USER_ENCRYPTION_KEY || ''
          ).toString()
        };
      }
    }
    return inboundState;
  },
  // Transform state being rehydrated
  (outboundState: any, key) => {
    if (key === 'auth') {
      const { user, ...rest } = outboundState;
      if (user) {
        const decrypted = CryptoJS.AES.decrypt(
          user,
          process.env.VITE_USER_ENCRYPTION_KEY || ''
        ).toString(CryptoJS.enc.Utf8);
        return {
          ...rest,
          user: JSON.parse(decrypted)
        };
      }
    }
    return outboundState;
  }
);

/**
 * Redux persist configuration with security enhancements
 */
const persistConfig = {
  key: 'root',
  storage: encryptedStorage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: ['_persist'],
  transforms: [encryptTransform],
  timeout: 10000,
  debug: process.env.NODE_ENV === 'development'
};

/**
 * Root reducer combining all feature reducers
 */
const rootReducer = combineReducers({
  application: applicationReducer,
  document: documentReducer,
  auth: authReducer,
  webhook: webhookReducer
});

/**
 * Type definition for the complete Redux state
 */
export type RootState = ReturnType<typeof rootReducer>;

/**
 * Performance monitoring middleware configuration
 */
const monitoringConfig = {
  enablePerformanceTracking: true,
  sampleRate: 0.1,
  reportingThreshold: 100,
  errorTracking: true
};

/**
 * Error handling middleware configuration
 */
const errorConfig = {
  onError: (error: Error, state: RootState) => {
    console.error('Redux Error:', error, {
      state: state,
      timestamp: new Date().toISOString()
    });
  },
  rethrow: false
};

/**
 * Custom middleware stack with monitoring and error handling
 */
const middleware: Middleware[] = [
  monitoringMiddleware(monitoringConfig),
  errorMiddleware(errorConfig)
];

/**
 * Create the persisted reducer
 */
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configure and create the Redux store
 */
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE']
      },
      thunk: true
    }).concat(middleware),
  devTools: process.env.NODE_ENV === 'development' && {
    maxAge: 50,
    trace: true,
    traceLimit: 25
  }
});

/**
 * Create the persistor for the store
 */
export const persistor = persistStore(store);

/**
 * Enable hot module replacement for reducers in development
 */
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./reducers/application.reducer', () => {
    store.replaceReducer(persistedReducer);
  });
}

export type AppDispatch = typeof store.dispatch;