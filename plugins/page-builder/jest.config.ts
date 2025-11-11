import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/widgets', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  collectCoverage: true,
  collectCoverageFrom: ['widgets/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}', '!**/*.d.ts'],
  moduleNameMapper: {
    '\\.(css|scss)$': '<rootDir>/tests/styleMock.js',
    '\\.module\\.css$': 'identity-obj-proxy',
  },
};

export default config;
