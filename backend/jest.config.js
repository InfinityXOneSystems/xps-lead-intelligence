/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./jest.setup.js'],
  roots: ['<rootDir>/src/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: false } }] },
  moduleNameMapper: {},
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts'],
  coverageThreshold: { global: { branches: 40, functions: 40, lines: 40, statements: 40 } },
};
