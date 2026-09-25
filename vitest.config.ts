import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: [
				'github-actions', { displayAnnotation: false}]
		],
    fileParallelism: false,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['tests/setup/unit.ts'],
          restoreMocks: true,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/setup/database.ts'],
          testTimeout: 15000,
          hookTimeout: 15000,
        },
      },
      {
        test: {
          name: 'mock',
          include: ['tests/mock/**/*.test.ts'],
        },
      },
    ],
  },
});
