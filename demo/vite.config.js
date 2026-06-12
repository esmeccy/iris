import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import devlens from 'devlens-inspector';

export default defineConfig({
  plugins: [devlens(), react()],
});
