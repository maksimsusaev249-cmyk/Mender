import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {handleApiRequest} from './server/apiRouter';
import type {ServerEnv} from './server/firebaseAdminRest';

export default defineConfig(({mode}) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '');
  const getServerEnv = (): ServerEnv => ({
    FIREBASE_SERVICE_ACCOUNT_JSON:
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || loadedEnv.FIREBASE_SERVICE_ACCOUNT_JSON,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || loadedEnv.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || loadedEnv.FIREBASE_PRIVATE_KEY,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || loadedEnv.FIREBASE_PROJECT_ID,
    FIREBASE_DATABASE_ID: process.env.FIREBASE_DATABASE_ID || loadedEnv.FIREBASE_DATABASE_ID,
    AUTH_CHALLENGE_SECRET: process.env.AUTH_CHALLENGE_SECRET || loadedEnv.AUTH_CHALLENGE_SECRET,
    CF_TURN_TOKEN_ID: process.env.CF_TURN_TOKEN_ID || loadedEnv.CF_TURN_TOKEN_ID,
    CF_TURN_API_TOKEN: process.env.CF_TURN_API_TOKEN || loadedEnv.CF_TURN_API_TOKEN,
    TURN_URLS: process.env.TURN_URLS || loadedEnv.TURN_URLS,
    TURN_USERNAME: process.env.TURN_USERNAME || loadedEnv.TURN_USERNAME,
    TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || loadedEnv.TURN_CREDENTIAL,
    TURN_SECRET: process.env.TURN_SECRET || loadedEnv.TURN_SECRET,
  });

  const apiMiddleware = async (req: any, res: any, next: () => void) => {
    if (!req.url || !req.url.startsWith('/api/')) {
      return next();
    }
    try {
      const host = req.headers.host || 'localhost:3000';
      const fullUrl = new URL(req.url, `http://${host}`);
      const chunks: Buffer[] = [];
      if (req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) {
        await new Promise<void>((resolve, reject) => {
          req.on('data', (c: Buffer | Uint8Array | string) => chunks.push(Buffer.from(c)));
          req.on('end', resolve);
          req.on('error', reject);
        });
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const webReq = new Request(fullUrl.toString(), {
        method: req.method || 'GET',
        headers,
        body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
      });
      const webRes = await handleApiRequest(webReq, getServerEnv());
      res.statusCode = webRes.status;
      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const buf = Buffer.from(await webRes.arrayBuffer());
      res.end(buf);
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({error: err?.message || 'API error'}));
    }
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'mender-api-dev-middleware',
        configureServer(server) {
          server.middlewares.use(apiMiddleware);
        },
        configurePreviewServer(server) {
          server.middlewares.use(apiMiddleware);
        },
      },
      {
        name: 'mender-compact-apk-cleanup',
        closeBundle() {
          // Исключаем временные медиа-вложения чата (public/assets/aistudio) из итоговой сборки dist/,
          // чтобы сборка и APK-пакет весили ~1.8 МБ (строго меньше 20 МБ).
          const aistudioAssetsDir = path.resolve(__dirname, 'dist/assets/aistudio');
          if (fs.existsSync(aistudioAssetsDir)) {
            fs.rmSync(aistudioAssetsDir, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      target: 'es2020',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

