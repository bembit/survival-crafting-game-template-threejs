// vite.config.js (Revised)
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'public/models', // Path relative to project root BEFORE build
          dest: '.'             // Copies 'models' folder into 'dist' root
        }
      ]
    })
  ],
});