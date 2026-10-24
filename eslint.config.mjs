import { defineConfig, globalIgnores } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/.next/**', '**/next-env.d.ts', '**/generated/**']),
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['apps/**/*.{ts,tsx}', 'packages/shared/**/*.ts'],
  })),
  {
    files: ['apps/admin/**/*.{ts,tsx,js,mjs}'],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/admin/' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]);
