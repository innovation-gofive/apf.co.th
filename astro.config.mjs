// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://innovation-gofive.github.io',
  base: '/apf.co.th',
  vite: {
    plugins: [tailwindcss()]
  }
});
