// Entschlüsselung für das Terminal: PBKDF2 (SHA-256) → AES-GCM 256.
// Gegenstück: werkzeuge/verschluesseln.mjs. Beide müssen dieselben Parameter benutzen.

// Groß- und Kleinschreibung und Leerzeichen am Rand spielen keine Rolle, das Handy schreibt gern groß
export const normalisieren = (passwort) => passwort.trim().toLowerCase();

export const verfuegbar = () => Boolean(globalThis.crypto?.subtle);

const bytes = (b64) => Uint8Array.from(atob(b64), (z) => z.charCodeAt(0));

// QR-Codes: nur Buchstaben und Ziffern zählen, Bindestriche und Leerzeichen beim Abtippen sind egal
export const codeNormalisieren = (code) => code.toLowerCase().replace(/[^a-z0-9]/g, "");

// Kennung, unter der ein Fund in terminal.json liegt; verrät den Code nicht
export async function kennung(code) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("source-scan:" + codeNormalisieren(code)));
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function schluessel(passwort, salt, iterationen) {
  const roh = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalisieren(passwort)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: bytes(salt), iterations: iterationen },
    roh,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

// Liefert den Klartext, bei falschem Schlüssel null
export async function entschluesseln(key, { iv, daten }) {
  try {
    const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv) }, key, bytes(daten));
    return new TextDecoder().decode(klar);
  } catch {
    return null;
  }
}
