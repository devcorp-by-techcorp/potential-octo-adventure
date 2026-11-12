module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo bundles the expo-router babel plugin on SDK 50+.
    presets: ["babel-preset-expo"],
  };
};
