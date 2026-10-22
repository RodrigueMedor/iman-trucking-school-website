import { defineConfig } from 'vitest/config'

// Run through scripts/test-integration.sh, which starts the database.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.ts'],
    environment: 'node',
    fileParallelism: false,
  },
})
