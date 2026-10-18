// Spielleitungs-Werkzeug: liest die Klartext-Inhalte aus spielleitung/inhalt/ und schreibt data/terminal.json.
// Dazu einen druckbaren QR-Bogen: spielleitung/qr-codes.html
// Aufruf im Projektordner:  node werkzeuge/verschluesseln.mjs
// Anleitung: spielleitung/ANLEITUNG.md
//
// Verschlüsselung: PBKDF2 (SHA-256) → AES-GCM 256.
// Gegenstück im Browser: js/krypto.js. Beide müssen dieselben Parameter benutzen.

import { webcrypto as krypto } from "node:crypto";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJEKT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SPIELLEITUNG = path.join(PROJEKT, "spielleitung");
const QUELLE = path.join(SPIELLEITUNG, "inhalt");
const ZIEL = path.join(PROJEKT, "data", "terminal.json");
const QR_BOGEN = path.join(SPIELLEITUNG, "qr-codes.html");
const EINSTELLUNGEN = path.join(SPIELLEITUNG, "einstellungen.txt");
const ITERATIONEN = 150000;

// Hier liegen Fundstücke und Sammelsets; ihr Inhalt erscheint erst nach dem Scannen
const FUNDE = "notes/funde";
const SAMMLUNGEN = "notes/sammlungen";

// Dateien, die Betriebssysteme gern ungefragt anlegen
const IGNORIEREN = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);

// Ohne 0/o, 1/l/i, damit sich Codes gut abtippen lassen
const CODE_ZEICHEN = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LAENGE = 8;

const normalisieren = (passwort) => passwort.trim().toLowerCase();
const codeNormalisieren = (code) => code.toLowerCase().replace(/[^a-z0-9]/g, "");
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const zufallsBytes = (n) => krypto.getRandomValues(new Uint8Array(n));

async function schluessel(passwort, salt) {
  const roh = await krypto.subtle.importKey("raw", new TextEncoder().encode(normalisieren(passwort)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return krypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONEN },
    roh,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
}

async function verschluesseln(key, text) {
  const iv = zufallsBytes(12);
  const daten = await krypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: b64(iv), daten: b64(new Uint8Array(daten)) };
}

// Kennung, unter der ein Fund in terminal.json liegt (wie js/krypto.js)
async function kennung(code) {
  const hash = await krypto.subtle.digest("SHA-256", new TextEncoder().encode("source-scan:" + codeNormalisieren(code)));
  return Buffer.from(hash).subarray(0, 12).toString("hex");
}

function neuerCode() {
  return Array.from(zufallsBytes(CODE_LAENGE), (b) => CODE_ZEICHEN[b % CODE_ZEICHEN.length]).join("");
}

// ---------- Dateien lesen ----------

class Fehler extends Error {}

const relativ = (datei) => path.relative(QUELLE, datei).split(path.sep).join("/");

const KOPF = /^((?:[a-zäöüß]+:.*\n)+)---[ \t]*\n/i;

// Kopfzeilen wie "passwort: eibe" oder "zeit: 2026-10-24 20:00", danach "---", danach der Text
function zerlegen(roh) {
  const text = roh.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = text.match(KOPF);
  if (!m) return { kopf: {}, text: text.trim() };
  return { kopf: kopfzeilen(m[1]), text: text.slice(m[0].length).trim() };
}

function kopfzeilen(text) {
  const kopf = {};
  for (const z of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const i = z.indexOf(":");
    if (i > 0) kopf[z.slice(0, i).trim().toLowerCase()] = z.slice(i + 1).trim();
  }
  return kopf;
}

// "2026-10-24 20:00" in deutscher Ortszeit dieses Rechners
function zeitLesen(wert, datei) {
  const m = wert.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  const zeit = m && new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  if (!zeit || isNaN(zeit)) throw new Fehler(`${relativ(datei)}: zeit "${wert}" verstehe ich nicht. Schreib sie so: 2026-10-24 20:00`);
  return zeit;
}

function namePruefen(name, datei) {
  if (/\s/.test(name)) throw new Fehler(`${relativ(datei)}: Bitte keine Leerzeichen im Namen, nimm Bindestriche.`);
}

async function eintraege(ordner) {
  return (await readdir(ordner))
    .filter((n) => !IGNORIEREN.has(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "de"));
}

const istOrdner = async (pfad) => (await stat(pfad)).isDirectory();
const gibtEs = (pfad) => stat(pfad).then(() => true, () => false);

// ---------- Baum bauen ----------

const bericht = { offen: [], gesperrt: [], feeds: [], codesNeu: 0 };
const scan = { eintraege: {}, sammlungen: {} };
const qr = []; // für den QR-Bogen: { name, code, sammlung, teil }
const vergebeneCodes = new Set();

async function ordnerBauen(ordner) {
  const rel = relativ(ordner);
  if (rel === FUNDE) return fundeBauen(ordner);
  if (rel === SAMMLUNGEN) return sammlungenBauen(ordner);

  const knoten = { typ: "ordner", inhalt: {} };
  for (const name of await eintraege(ordner)) {
    if (name.startsWith("_")) continue; // Einstellungen, nicht Teil des Terminals
    const voll = path.join(ordner, name);
    namePruefen(name, voll);
    if (await istOrdner(voll)) {
      const einstellungen = path.join(voll, "_ordner.txt");
      knoten.inhalt[name] = (await gibtEs(einstellungen)) ? await feedBauen(voll, name, einstellungen) : await ordnerBauen(voll);
    } else {
      knoten.inhalt[name] = await dateiBauen(voll);
    }
  }
  return knoten;
}

async function dateiBauen(datei) {
  const { kopf, text } = zerlegen(await readFile(datei, "utf8"));
  if (!kopf.passwort) {
    bericht.offen.push(relativ(datei));
    return { typ: "datei", text };
  }
  const salt = zufallsBytes(16);
  const v = await verschluesseln(await schluessel(kopf.passwort, salt), text);
  bericht.gesperrt.push([relativ(datei), normalisieren(kopf.passwort)]);
  return { typ: "datei", verschluesselt: { salt: b64(salt), ...v } };
}

// Ein Feed: ein Passwort für den ganzen Ordner, jeder Post einzeln verschlüsselt (auch sein Name)
async function feedBauen(ordner, name, einstellungen) {
  const { passwort } = kopfzeilen(await readFile(einstellungen, "utf8"));
  if (!passwort) throw new Fehler(`${relativ(einstellungen)}: Es fehlt die Zeile "passwort: ..."`);
  const salt = zufallsBytes(16);
  const key = await schluessel(passwort, salt);
  const posts = [];
  const spaeter = [];

  for (const post of await eintraege(ordner)) {
    if (post.startsWith("_")) continue;
    const voll = path.join(ordner, post);
    namePruefen(post, voll);
    if (await istOrdner(voll)) throw new Fehler(`${relativ(voll)}: In einem Feed sind keine Unterordner erlaubt.`);
    const { kopf, text } = zerlegen(await readFile(voll, "utf8"));
    const zeit = kopf.zeit ? zeitLesen(kopf.zeit, voll) : null;
    if (zeit && zeit > new Date()) spaeter.push(`${post} ab ${zeit.toLocaleString("de-DE")}`);
    posts.push({ ...(zeit && { zeit: zeit.toISOString() }), ...(await verschluesseln(key, JSON.stringify({ name: post, text }))) });
  }

  bericht.feeds.push({ pfad: relativ(ordner), name, passwort: normalisieren(passwort), anzahl: posts.length, spaeter });
  return {
    typ: "ordner",
    gesperrt: name,
    salt: b64(salt),
    pruefung: await verschluesseln(key, "source-net"),
    posts,
  };
}

// ---------- Funde und Sammelsets ----------

// Liest eine Fund-Datei. Hat sie noch keinen Code, bekommt sie einen und die Datei wird ergänzt,
// damit der Code beim nächsten Lauf gleich bleibt (gedruckte QR-Codes gelten weiter).
async function fundLesen(datei) {
  const roh = (await readFile(datei, "utf8")).replace(/^﻿/, "");
  let { kopf, text } = zerlegen(roh);
  if (!kopf.code) {
    kopf.code = neuerCode();
    const einheitlich = roh.replace(/\r\n?/g, "\n");
    const neu = KOPF.test(einheitlich) ? `code: ${kopf.code}\n${einheitlich}` : `code: ${kopf.code}\n---\n${einheitlich}`;
    await writeFile(datei, neu, "utf8");
    bericht.codesNeu++;
  }
  const code = codeNormalisieren(kopf.code);
  if (code.length < 6) throw new Fehler(`${relativ(datei)}: Der Code "${kopf.code}" ist zu kurz (mindestens 6 Zeichen).`);
  if (vergebeneCodes.has(code)) throw new Fehler(`${relativ(datei)}: Den Code "${kopf.code}" gibt es schon bei einem anderen Fund.`);
  vergebeneCodes.add(code);
  return { code, text };
}

async function fundEintragen(code, inhalt) {
  const salt = zufallsBytes(16);
  const v = await verschluesseln(await schluessel(code, salt), JSON.stringify(inhalt));
  scan.eintraege[await kennung(code)] = { salt: b64(salt), ...v };
}

async function fundeBauen(ordner) {
  for (const name of await eintraege(ordner)) {
    if (name.startsWith("_")) continue;
    const voll = path.join(ordner, name);
    namePruefen(name, voll);
    if (await istOrdner(voll)) throw new Fehler(`${relativ(voll)}: Sammelsets gehören nach ${SAMMLUNGEN}/.`);
    const { code, text } = await fundLesen(voll);
    await fundEintragen(code, { name, text });
    qr.push({ name, code });
  }
  return { typ: "ordner", virtuell: "funde", inhalt: {} };
}

// Jeder Unterordner ist ein Sammelset: Teile mit eigenem Code, dazu _sammlung.txt mit der Belohnung.
// Die Belohnung ist mit allen Teil-Codes zusammen verschlüsselt.
async function sammlungenBauen(ordner) {
  for (const set of await eintraege(ordner)) {
    const setOrdner = path.join(ordner, set);
    if (set.startsWith("_") || !(await istOrdner(setOrdner))) continue;
    namePruefen(set, setOrdner);
    const belohnungDatei = path.join(setOrdner, "_sammlung.txt");
    if (!(await gibtEs(belohnungDatei))) throw new Fehler(`${relativ(setOrdner)}: Es fehlt _sammlung.txt mit der Belohnung.`);

    const teile = (await eintraege(setOrdner)).filter((n) => !n.startsWith("_"));
    if (teile.length < 2) throw new Fehler(`${relativ(setOrdner)}: Ein Sammelset braucht mindestens zwei Teile.`);
    const codes = [];
    for (const [i, name] of teile.entries()) {
      const voll = path.join(setOrdner, name);
      namePruefen(name, voll);
      const { code, text } = await fundLesen(voll);
      codes.push(code);
      await fundEintragen(code, { name, text, sammlung: set });
      qr.push({ name, code, sammlung: set, teil: `${i + 1}/${teile.length}` });
    }

    const { kopf, text } = zerlegen(await readFile(belohnungDatei, "utf8"));
    const salt = zufallsBytes(16);
    const schluesselText = [...codes].sort().join("+");
    const v = await verschluesseln(await schluessel(schluesselText, salt), JSON.stringify({ name: kopf.name || "vollstaendig.txt", text }));
    scan.sammlungen[set] = { anzahl: teile.length, salt: b64(salt), ...v };
  }
  return { typ: "ordner", virtuell: "sammlungen", inhalt: {} };
}

// ---------- QR-Bogen ----------

const html = (t) => String(t).replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);

function qrBogen(adresse) {
  const karten = qr
    .map(
      (q) => `
    <figure class="karte" data-code="${q.code}">
      <div class="qr"></div>
      <figcaption>
        <b>${html(q.name)}</b>
        ${q.sammlung ? `<span>Sammelset ${html(q.sammlung)}, Teil ${q.teil}</span>` : "<span>Fund</span>"}
        <code>${q.code.replace(/(.{4})/, "$1-")}</code>
      </figcaption>
    </figure>`
    )
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR-Codes · SOURCE</title>
<!-- Erzeugt von werkzeuge/verschluesseln.mjs. Nicht von Hand ändern, beim nächsten Lauf wird die Datei überschrieben. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #111; background: #fff; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .hinweis { color: #555; font-size: 14px; max-width: 70ch; }
  label { display: block; margin: 16px 0 24px; font-size: 14px; }
  label input { display: block; width: min(100%, 520px); margin-top: 4px; padding: 8px; font: inherit; }
  .bogen { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .karte { margin: 0; padding: 12px; border: 1px dashed #999; text-align: center; break-inside: avoid; }
  .qr svg { width: 100%; height: auto; display: block; }
  figcaption { display: grid; gap: 2px; margin-top: 8px; font-size: 13px; }
  figcaption span { color: #555; }
  code { font-size: 15px; letter-spacing: 0.08em; }
  .link { font-size: 11px; color: #777; word-break: break-all; }
  @media print { .bedienung { display: none; } body { margin: 0; } }
</style>
</head>
<body>
<div class="bedienung">
  <h1>QR-Codes für SOURCE</h1>
  <p class="hinweis">Ausschneiden und an die Props kleben. Unter jedem QR-Code steht der Code zum Abtippen
    (<code>scan k7x9-q2m4</code> im Terminal). <b>Dieser Bogen enthält alle Codes, bitte nicht weitergeben.</b></p>
  <label>Adresse der App (Testen im WLAN: https://IP-deines-Rechners/source_web_app/, im Spiel: die GitHub-Pages-Adresse)
    <input id="adresse" value="${html(adresse)}" spellcheck="false">
  </label>
</div>
<div class="bogen">${karten || "<p>Keine Funde vorhanden.</p>"}
</div>
<script>
  const feld = document.getElementById("adresse");
  const vorgabe = feld.value;
  // Eine von Hand geänderte Adresse gilt nur, solange die Vorgabe aus einstellungen.txt gleich bleibt
  try {
    const gemerkt = JSON.parse(localStorage.getItem("qr-adresse"));
    if (gemerkt?.vorgabe === vorgabe) feld.value = gemerkt.wert;
  } catch {}
  function zeichnen() {
    const basis = feld.value.trim().replace(/\\/?$/, "/");
    try { localStorage.setItem("qr-adresse", JSON.stringify({ vorgabe, wert: feld.value })); } catch {}
    for (const karte of document.querySelectorAll(".karte")) {
      const url = basis + "#/scan/" + karte.dataset.code;
      const q = qrcode(0, "M");
      q.addData(url);
      q.make();
      karte.querySelector(".qr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      let link = karte.querySelector(".link");
      if (!link) { link = document.createElement("span"); link.className = "link"; karte.querySelector("figcaption").append(link); }
      link.textContent = url;
    }
  }
  feld.addEventListener("input", zeichnen);
  zeichnen();
</script>
</body>
</html>
`;
}

// ---------- Los ----------

try {
  if (!(await stat(QUELLE).then((s) => s.isDirectory(), () => false))) {
    throw new Fehler(`Den Ordner ${QUELLE} gibt es nicht. Siehe spielleitung/ANLEITUNG.md.`);
  }
  const einstellungen = (await gibtEs(EINSTELLUNGEN)) ? kopfzeilen(await readFile(EINSTELLUNGEN, "utf8")) : {};
  const adresse = einstellungen.adresse || "http://localhost/source_web_app/";

  const baum = { kdf: { iterationen: ITERATIONEN }, ...(await ordnerBauen(QUELLE)), scan };
  await writeFile(ZIEL, JSON.stringify(baum, null, 2) + "\n", "utf8");
  await writeFile(QR_BOGEN, qrBogen(adresse), "utf8");

  console.log(`\nFertig: data/terminal.json und spielleitung/qr-codes.html geschrieben.\n`);
  console.log(`Offene Dateien:      ${bericht.offen.length}`);
  console.log(`Gesperrte Dateien:   ${bericht.gesperrt.length}`);
  for (const [datei, pw] of bericht.gesperrt) console.log(`  ~/${datei}   passwort: ${pw}`);
  console.log(`Feeds:               ${bericht.feeds.length}`);
  for (const f of bericht.feeds) {
    console.log(`  ~/${f.pfad}   connect ${f.name}   passphrase: ${f.passwort}   ${f.anzahl} Post(s)`);
    for (const s of f.spaeter) console.log(`      noch unsichtbar: ${s}`);
  }
  console.log(`QR-Codes:            ${qr.length}${bericht.codesNeu ? `  (${bericht.codesNeu} neu vergeben)` : ""}`);
  for (const q of qr) console.log(`  scan ${q.code}   ${q.sammlung ? `${q.sammlung} ${q.teil}: ` : ""}${q.name}`);
  console.log("");
} catch (e) {
  console.error(`\nFehler: ${e instanceof Fehler ? e.message : e.stack}\n`);
  console.error("data/terminal.json wurde nicht verändert.\n");
  process.exit(1);
}
