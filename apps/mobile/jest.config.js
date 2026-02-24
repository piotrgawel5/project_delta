module.exports = {
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/app/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@lib/(.*)$': '<rootDir>/lib/$1',
    '^@components/(.*)$': '<rootDir>/components/$1',
    '^@store/(.*)$': '<rootDir>/store/$1',
    '^@shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@constants$': '<rootDir>/constants/index.ts',
    '^@project-delta/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@project-delta/constants$': '<rootDir>/../../packages/constants/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
};
