import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  // Environment lives in the repository root so the server and the web app
  // share a single .env file. Only VITE_-prefixed values reach browser code.
  const env = loadEnv(mode, projectRoot, '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000';
  const port = Number(env.VITE_PORT || 3000);

  return {
    envDir: projectRoot,
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false,
        },
      },
    },
    preview: { host: '127.0.0.1', port, strictPort: true },
    build: { outDir: 'dist', sourcemap: true },
  };
});
