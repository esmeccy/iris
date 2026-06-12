import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import iris from 'vite-plugin-iris';

export default defineConfig({
  plugins: [iris(), react()],
});
