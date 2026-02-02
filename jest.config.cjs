/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        diagnostics: {
          // Ignora erros de TypeScript relacionados a import.meta/env em arquivos Vite/Firebase
          ignoreCodes: [1343, 2339],
        },
      },
    ],
  },
};
