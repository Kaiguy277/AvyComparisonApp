// In-memory stand-in for @react-native-async-storage/async-storage, used
// only under Vitest (aliased in vitest.config.ts). Covers the surface the
// app actually calls. Tests that care about persistence can import the
// `__store` to inspect or reset it.

const store = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store.delete(key);
  },
  async clear(): Promise<void> {
    store.clear();
  },
};

export const __store = store;
export default AsyncStorage;
