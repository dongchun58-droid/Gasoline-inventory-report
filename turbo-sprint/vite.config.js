import { defineConfig } from 'vite';

// base: './' → 상대경로 빌드. GitHub Pages 등 어떤 하위 경로에 배포해도
// (예: https://<user>.github.io/<repo>/) 에셋이 올바르게 로드된다.
export default defineConfig({
  base: './',
});
