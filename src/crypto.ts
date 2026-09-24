// Zero-knowledge: a senha mestra nunca é enviada ao servidor.
// Dela derivamos (1) uma senha de login para o Supabase Auth e (2) a chave AES que cifra o cofre.
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 600_000;

const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function pbkdf2(master: string, salt: string) {
  const base = await crypto.subtle.importKey("raw", enc.encode(master), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITER },
    base,
    256
  );
}

export async function deriveAuthSecret(master: string, email: string) {
  return b64(await pbkdf2(master, "auth:" + email.toLowerCase()));
}

export async function deriveVaultKey(master: string, email: string) {
  const bits = await pbkdf2(master, "enc:" + email.toLowerCase());
  return crypto.subtle.importKey("raw", bits, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJSON(key: CryptoKey, data: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  return { iv: b64(iv), ciphertext: b64(ct) };
}

export async function decryptJSON<T>(key: CryptoKey, iv: string, ciphertext: string): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ciphertext));
  return JSON.parse(dec.decode(pt));
}

export function generatePassword(len = 20) {
  const set = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*?-_";
  const r = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(r, (n) => set[n % set.length]).join("");
}
