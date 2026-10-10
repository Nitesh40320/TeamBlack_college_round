module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  haste: {
    forceNodeFilesystemAPI: true,
    enableSymlinks: true
  },
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/'],
  testMatch: ['<rootDir>/tests/**/*.test.ts']
};
