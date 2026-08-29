module.exports = function (api) {
  api.cache(true);
  return {
    // `babel-preset-expo` is the whole configuration now. The Reanimated plugin
    // used to be listed here; it was removed along with the library, and leaving
    // the entry behind breaks the bundler outright with MODULE_NOT_FOUND.
    presets: ["babel-preset-expo"],
  };
};
