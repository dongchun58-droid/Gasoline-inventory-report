import { defineConfig } from 'vite';
// GitHub Pages: 루트는 turbo-sprint, 이 앱은 /zombie/ 하위 경로
export default defineConfig({ base: '/Gasoline-inventory-report/zombie/', build: { chunkSizeWarningLimit: 1500 } });
