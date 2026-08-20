const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const appNodeModules = path.resolve(__dirname, 'node_modules');

config.resolver.nodeModulesPaths = [
  appNodeModules,
  ...(config.resolver.nodeModulesPaths ?? []),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@radix-ui/react-slot': path.dirname(
    path.dirname(require.resolve('@radix-ui/react-slot')),
  ),
  'metro-runtime': path.resolve(appNodeModules, 'metro-runtime'),
};

if (!config.resolver.sourceExts.includes('sql')) {
  config.resolver.sourceExts.push('sql');
}

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

module.exports = config;
