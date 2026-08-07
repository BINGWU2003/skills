import { defineConfig } from 'astro/config';

const deploymentUrl = process.env.URL ?? 'http://localhost:4321';

export default defineConfig({
  site: deploymentUrl,
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
