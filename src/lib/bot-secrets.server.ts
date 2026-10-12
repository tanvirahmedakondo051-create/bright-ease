const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function keyFrom(material: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function encryptBotSecret(value: string, material: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(material), encoder.encode(value));
  return `v2.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptBotSecret(value: string, material: string) {
  if (!value.startsWith("v2.")) return null;
  const [, encodedIv, encodedCipher] = value.split(".");
  if (!encodedIv || !encodedCipher) return null;
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    await keyFrom(material),
    fromBase64(encodedCipher),
  );
  return decoder.decode(decrypted);
}