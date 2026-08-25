/**
 * Browser stand-in for `node:async_hooks`.
 *
 * `expo-font` imports `AsyncLocalStorage` from it for server-side rendering.
 * That path never executes in a browser, but the import is static, so the module
 * has to resolve for the bundle to build. A single-slot store is enough.
 */

export class AsyncLocalStorage<T> {
  private store: T | undefined;

  getStore(): T | undefined {
    return this.store;
  }

  run<R>(store: T, callback: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previous;
    }
  }

  enterWith(store: T): void {
    this.store = store;
  }

  disable(): void {
    this.store = undefined;
  }
}

export default { AsyncLocalStorage };
