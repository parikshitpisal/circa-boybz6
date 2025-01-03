import { defineConfig } from 'vite'; // ^4.3.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      fastRefresh: true,
      babel: {
        plugins: ['@emotion/babel-plugin']
      }
    }),
    tsconfigPaths({
      projects: ['./tsconfig.json']
    })
  ],

  server: {
    port: 3000,
    host: true,
    strictPort: true,
    cors: {
      origin: [
        'http://localhost:3000',
        'https://*.dollarfunding.com'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    },
    hmr: {
      overlay: true
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  },

  build: {
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          'material-ui': ['@mui/material', '@mui/icons-material'],
          form: ['react-hook-form', 'yup'],
          utils: ['lodash', 'date-fns'],
          state: ['zustand', 'immer']
        }
      }
    }
  },

  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@utils': '/src/utils',
      '@services': '/src/services',
      '@hooks': '/src/hooks',
      '@contexts': '/src/contexts',
      '@store': '/src/store',
      '@assets': '/src/assets',
      '@interfaces': '/src/interfaces',
      '@layouts': '/src/layouts',
      '@constants': '/src/constants',
      '@config': '/src/config',
      '@styles': '/src/styles'
    }
  },

  define: {
    __APP_VERSION__: 'JSON.stringify(process.env.npm_package_version)',
    __DEV__: "process.env.NODE_ENV === 'development'",
    __PROD__: "process.env.NODE_ENV === 'production'"
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material'
    ],
    exclude: ['@fsouza/prettierd']
  }
}));