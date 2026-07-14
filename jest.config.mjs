/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx|mjs)$': ['babel-jest', { configFile: './jest.babel.config.cjs' }],
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.(js|jsx)'],
};

export default config;
