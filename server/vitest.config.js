import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    restoreMocks: true,
    fileParallelism: process.env.RUN_INFRA_INTEGRATION !== 'true',
    testTimeout: process.env.RUN_INFRA_INTEGRATION === 'true' ? 20_000 : 5_000,
  },
});
