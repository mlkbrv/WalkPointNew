/**
 * Device storage: Keychain on iOS, Keystore on Android.
 *
 * Tokens are credentials, so they belong here rather than in AsyncStorage, which
 * is readable by anything that can read the app's sandbox.
 */

import * as SecureStore from "expo-secure-store";

import type { TokenStore } from "./tokenStore";

const store: TokenStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

export default store;
