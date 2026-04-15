import type { Config } from 'tailwindcss';

// Tailwind v4 — minimal config, most configuration is in CSS @theme
const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
};

export default config;
