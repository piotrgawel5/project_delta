module.exports = function (api) {
  api.cache(true);
  let plugins = [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@': './app',
          '@modules': './modules',
          '@lib': './lib',
          '@components': './components',
          '@store': './store',
          '@shared': '../../packages/shared/src/index.ts',
          '@constants': '../../packages/constants/src/index.ts', // <-- this one
        },
      },
    ],
  ];

  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
