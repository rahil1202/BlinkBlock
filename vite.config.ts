/* eslint-disable @typescript-eslint/no-explicit-any */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

function staticCopyPlugin() {
  return {
    name: 'static-copy-manifest-rules-icons',
    generateBundle(this: any) {
      const root = dirname(fileURLToPath(import.meta.url));
      const files = [
        { src: join(root, 'manifest.json'), dest: 'manifest.json' },
        { src: join(root, 'rules.json'), dest: 'rules.json' },
      ];

      for (const f of files) {
        if (fs.existsSync(f.src)) {
          const source = fs.readFileSync(f.src);
          this.emitFile({ type: 'asset', fileName: f.dest, source });
        }
      }

      const iconsDir = join(root, 'icons');
      if (fs.existsSync(iconsDir)) {
        const entries = fs.readdirSync(iconsDir);
        for (const name of entries) {
          const full = join(iconsDir, name);
          if (fs.statSync(full).isFile()) {
            const source = fs.readFileSync(full);
            this.emitFile({ type: 'asset', fileName: `icons/${name}`, source });
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), staticCopyPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
        'focus-mode': resolve(__dirname, 'focus-mode.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'background' ? '[name].js' : '[name].js';
        },
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    outDir: 'dist',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
