/**
 * Where the JWT pair is kept — default implementation.
 *
 * This file is what the web build and TypeScript resolve. Metro picks
 * `tokenStore.native.ts` ahead of it on device, so a phone stores tokens in
 * Keychain / Keystore instead.
 *
 * AsyncStorage (localStorage underneath) is weaker than a keychain, which is part
 * of why the web target is a development and preview surface rather than a way to
 * ship the product.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface TokenStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const store: TokenStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export default store;
