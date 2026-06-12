import { defineConfig } from 'vite';
import devlens from 'devlens-inspector';

export default defineConfig({
  plugins: [devlens()],
});
