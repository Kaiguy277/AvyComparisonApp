// Random ids and secrets. Wrapped so tests can alias this module.
import * as Crypto from "expo-crypto";

export function newId(): string {
  return Crypto.randomUUID();
}

// 16 random bytes → base64url (22 chars, no padding). Used for the
// per-plan secret the client keeps in SecureStore.
export function newSecret(): string {
  const bytes = Crypto.getRandomBytes(16);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  // btoa is available in RN (Hermes) and Node ≥ 16.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}
