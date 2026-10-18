// SOURCE-Net-Terminal: Dateibaum aus data/terminal.json, Eingabezeile, antippbare Ausgabe und Befehls-Chips.
// Gesperrte Dateien öffnet `decrypt`, gesperrte Feeds öffnet `connect`, Funde kommen per `scan` (QR-Code).
// Eigene Notizen schreiben `note` und `edit`. Passwörter, Funde und Notizen merkt sich das Gerät.

import { maskieren, unterseite, ausgabe, lesen, schreiben } from "./hilfen.js";
import { verfuegbar, schluessel, entschluesseln, kennung, codeNormalisieren } from "./krypto.js";

let baum = null;
const feedKnoten = {}; // gesellschaft → Ordnerknoten aus terminal.json
const feeds = {}; // gesellschaft → entschlüsselte Posts { name: { typ, text, zeit } }

async function laden() {
  if (!baum) {
    const antwort = await fetch("data/terminal.json");
    if (!antwort.ok) throw new Error(antwort.status);
    baum = await antwort.json();
    sammeln(baum);
    // Schon verbundene Feeds gleich wieder öffnen
    for (const [g, passwort] of Object.entries(lesen("terminal-feeds", {}))) await verbinden(g, passwort).catch(() => {});
  }
  return baum;
}

function sammeln(knoten) {
  if (knoten.typ !== "ordner") return;
  if (knoten.gesperrt) feedKnoten[knoten.gesperrt] = knoten;
  for (const kind of Object.values(knoten.inhalt ?? {})) sammeln(kind);
}

// Bleibt beim Wechsel zwischen den Ansichten erhalten
let ort = []; // aktueller Ordner als Liste von Namen, [] = ~
const verlauf = [];
let warten = null; // offene Passwortabfrage: { art: "decrypt" | "connect", ziel }
let entwurf = null; // Text im offenen Editor, null = Editor zu

const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ---------- Sprüche ----------

const HILFE_SPRUECHE = [
  "Du denkst, dir ist noch zu helfen?",
  "Hilfe ist unterwegs. Seit 1923.",
  "Die Stimmen in deinem Kopf wissen es auch nicht besser.",
  "Selbst JWD hat aufgegeben, dir etwas zu erklären.",
  "Der wahnsinnige Gott träumt gerade. Bitte nicht stören.",
  "Hast du es schon mit Aus- und wieder Einschalten versucht? Deinen Verstand, meine ich.",
  "Schon wieder? Na gut. Aber nur, weil du so verzweifelt aussiehst.",
  "Hilfe kostet extra. Zahlbar in Gold. Du weißt, welches.",
];

const UNBEKANNT_SPRUECHE = [
  "du übrigens auch nicht.",
  "netter versuch.",
  "das netz lacht über dich.",
  "tippfehler oder wahnsinn? schwer zu sagen.",
  "auch nicht im fornax-cluster.",
];

const LEER_SPRUECHE = [
  "hier ist nichts. noch nicht.",
  "leer. oder jemand war schneller.",
  "nichts. genieß die stille, solange sie hält.",
];

const FALSCH_SPRUECHE = [
  "das netz hat sich deinen versuch gemerkt.",
  "rate weiter. oder geh nach hause.",
  "fast. nein, eigentlich nicht.",
  "vielleicht fragst du jemanden, der es weiß. falls er dich nicht frisst.",
];

const SCAN_FALSCH = [
  "vielleicht falsch abgetippt. vielleicht eine fälschung.",
  "der code ist tot. oder du bist es.",
  "das netz kennt diese signatur nicht. noch nicht.",
];

const NOTIZ_SPRUECHE = [
  "für später. falls es ein später gibt.",
  "aufgeschrieben. vergessen kannst du es trotzdem.",
  "das netz liest mit. nur damit du es weißt.",
  "papier wäre sicherer. aber papier brennt.",
];

const WHOAMI = [
  "gute frage.",
  "ein niemand mit zugang. vorerst.",
  "jemand, der zu viele fragen stellt.",
  "das wüsste der maskierte mann auch gern.",
];

// ---------- Dateibaum ----------

const pfadText = (teile) => "~" + teile.map((t) => "/" + t).join("");

// Erschienene Posts eines Feeds; Posts mit Zeit in der Zukunft bleiben unsichtbar
const sichtbar = (k) => !k.zeit || new Date(k.zeit) <= new Date();

function inhaltVon(knoten) {
  if (knoten === baum.inhalt.notes) return { ...knoten.inhalt, "notizen.txt": NOTIZEN };
  if (knoten.virtuell === "funde") return fundeInhalt();
  if (knoten.virtuell === "sammlungen") return sammlungenInhalt();
  if (knoten.sammlung) return setInhalt(knoten.sammlung);
  if (!knoten.gesperrt) return knoten.inhalt;
  const posts = feeds[knoten.gesperrt];
  return posts ? Object.fromEntries(Object.entries(posts).filter(([, k]) => sichtbar(k))) : {};
}

// ---------- Funde (per Scan, nur auf diesem Gerät) ----------

const funde = () => lesen("terminal-funde", {}); // code → { name, text, sammlung? }
const belohnungen = () => lesen("terminal-belohnungen", {}); // sammlung → { name, text }
const alsDatei = (f) => [f.name, { typ: "datei", text: f.text }];

const fundeInhalt = () => Object.fromEntries(Object.values(funde()).filter((f) => !f.sammlung).map(alsDatei));

// Ein Sammelset erscheint, sobald der erste Teil gefunden ist
function sammlungenInhalt() {
  const teile = Object.values(funde()).filter((f) => f.sammlung);
  const sets = {};
  for (const set of new Set(teile.map((f) => f.sammlung))) {
    const anzahl = baum.scan?.sammlungen?.[set]?.anzahl ?? "?";
    sets[set] = { typ: "ordner", sammlung: set, fortschritt: `${teile.filter((f) => f.sammlung === set).length}/${anzahl}` };
  }
  return sets;
}

function setInhalt(set) {
  const inhalt = Object.fromEntries(Object.values(funde()).filter((f) => f.sammlung === set).map(alsDatei));
  const belohnung = belohnungen()[set];
  if (belohnung) inhalt[belohnung.name] = { typ: "datei", text: belohnung.text };
  return inhalt;
}

// ---------- Eigene Notizen (nur auf diesem Gerät) ----------

const NOTIZEN = { typ: "datei", virtuell: "notizen" };
const NOTIZEN_PFAD = "~/notes/notizen.txt";
const notizen = () => lesen("terminal-notizen", "");

const zweistellig = (n) => String(n).padStart(2, "0");
function zeitstempel(d = new Date()) {
  return `${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}. ${zweistellig(d.getHours())}:${zweistellig(d.getMinutes())}`;
}

const fundPfad = (f) => (f.sammlung ? `~/notes/sammlungen/${f.sammlung}/${f.name}` : `~/notes/funde/${f.name}`);

// Löst einen Pfad relativ zum aktuellen Ort auf: ~, /, .., . und relative Namen
function aufloesen(pfad = "") {
  const teile = pfad.startsWith("~") || pfad.startsWith("/") ? [] : [...ort];
  for (const t of pfad.replace(/^~/, "").split("/")) {
    if (!t || t === ".") continue;
    if (t === "..") teile.pop();
    else teile.push(t);
  }
  let knoten = baum;
  for (const t of teile) {
    knoten = knoten?.typ === "ordner" ? inhaltVon(knoten)[t] : undefined;
    if (!knoten) return { teile, knoten: null };
  }
  return { teile, knoten };
}

// Sucht auf dem Weg einen Feed, mit dem das Gerät noch nicht verbunden ist
function sperre(teile) {
  let knoten = baum;
  for (const t of teile) {
    knoten = inhaltVon(knoten)[t];
    if (knoten?.gesperrt && !feeds[knoten.gesperrt]) return knoten.gesperrt;
  }
  return null;
}

const iterationen = () => baum.kdf.iterationen;

// Datei lesen; null, wenn sie verschlüsselt ist und das Gerät das Passwort nicht kennt
async function dateiText(knoten, pfad) {
  if (knoten.virtuell === "notizen") return notizen();
  if (!knoten.verschluesselt) return knoten.text;
  const offen = lesen("terminal-dateien", {});
  if (!offen[pfad] || !verfuegbar()) return null;
  const v = knoten.verschluesselt;
  const text = await entschluesseln(await schluessel(offen[pfad], v.salt, iterationen()), v);
  if (text === null) {
    // Die Spielleitung hat das Passwort geändert
    delete offen[pfad];
    schreiben("terminal-dateien", offen);
  }
  return text;
}

const istOffen = (pfad) => Boolean(lesen("terminal-dateien", {})[pfad]);

async function verbinden(gesellschaft, passwort) {
  const k = feedKnoten[gesellschaft];
  if (!k || !verfuegbar()) return false;
  const key = await schluessel(passwort, k.salt, iterationen());
  if ((await entschluesseln(key, k.pruefung)) === null) return false;
  const posts = {};
  for (const p of k.posts) {
    const klar = await entschluesseln(key, p);
    if (klar === null) continue;
    const { name, text } = JSON.parse(klar);
    posts[name] = { typ: "datei", text, zeit: p.zeit };
  }
  feeds[gesellschaft] = posts;
  return true;
}

// ---------- Ausgabe-Bausteine ----------

const zeile = (text, klasse = "") => `<span class="${klasse}">${maskieren(text)}</span>`;
const fehler = (text) => zeile(text, "fehler");
const kommentar = (text) => zeile("# " + text, "kommentar");
const link = (befehl, text, klasse) =>
  `<button type="button" class="term-link ${klasse}" data-befehl="${maskieren(befehl)}">${maskieren(text)}</button>`;

const keinKanal = (befehl) =>
  [fehler(`${befehl}: kein sicherer kanal.`), kommentar("die app muss über https laufen.")].join("\n");

// ---------- Befehle ----------

const befehle = {
  help() {
    const liste = [
      ["ls [-a] [ordner]", "zeigt, was hier liegt. Nicht alles will gesehen werden."],
      ["cd <ordner>", "wechselt den Ordner. cd .. geht zurück, falls es ein Zurück gibt."],
      ["cat <datei>", "liest eine Datei. Auf eigene Gefahr."],
      ["decrypt <datei>", "entschlüsselt eine Datei. Passwörter wachsen nicht auf Bäumen."],
      ["connect <gesellschaft>", "verbindet dich mit einer Gesellschaft. Die wissen dann, wer du bist."],
      ["scan <code>", "liest einen Fund ein. Oder halt einfach die Kamera auf den QR-Code."],
      ["note <text>", "notiert etwas. Damit du später weißt, was du vergessen hast."],
      ["edit notizen.txt", "öffnet deine Notizen zum Bearbeiten. Nur die gehören dir."],
      ["pwd", "zeigt, wo du bist. Nicht, wer du bist."],
      ["clear", "wischt den Bildschirm. Nicht dein Gedächtnis."],
      ["whoami", "gute Frage."],
    ];
    return [
      kommentar(zufall(HILFE_SPRUECHE)),
      "",
      // Beschreibung unter dem Befehl, weil zwei Spalten auf dem Handy umbrechen
      ...liste.map(([b, t]) => `${zeile(b, "befehl")}\n  ${zeile(t, "kommentar-ort")}`),
      "",
      kommentar("Ordner und Dateien kannst du auch antippen."),
    ].join("\n");
  },

  ls(argumente) {
    const alle = argumente.includes("-a");
    const ziel = argumente.find((a) => a !== "-a") ?? "";
    const { teile, knoten } = aufloesen(ziel);
    if (!knoten) return fehler(`ls: ${ziel}: gibt es nicht. vielleicht nie gegeben.`);
    if (knoten.typ !== "ordner") return eintrag(teile.at(-1), knoten, pfadText(teile));
    const gesperrt = sperre(teile);
    if (gesperrt) return gesperrtMeldung("ls", ziel, gesperrt);

    const inhalt = inhaltVon(knoten);
    const namen = Object.keys(inhalt)
      .filter((n) => alle || !n.startsWith("."))
      .sort((a, b) => (inhalt[b].typ === "ordner") - (inhalt[a].typ === "ordner") || a.localeCompare(b, "de"));
    if (!namen.length) return kommentar(zufall(LEER_SPRUECHE));
    return namen.map((n) => eintrag(n, inhalt[n], pfadText([...teile, n]))).join("  ");
  },

  cd([ziel = "~"]) {
    const { teile, knoten } = aufloesen(ziel);
    if (!knoten) return fehler(`cd: ${ziel}: gibt es nicht. vielleicht nie gegeben.`);
    if (knoten.typ !== "ordner") return fehler(`cd: ${ziel}: ist eine datei. versuch: cat ${ziel}`);
    const gesperrt = sperre(teile);
    if (gesperrt) return gesperrtMeldung("cd", ziel, gesperrt);
    ort = teile;
    return "";
  },

  async cat([ziel]) {
    if (!ziel) return fehler("cat: was denn? versuch: cat <datei>");
    const { teile, knoten } = aufloesen(ziel);
    if (!knoten) return fehler(`cat: ${ziel}: gibt es nicht. vielleicht nie gegeben.`);
    if (knoten.typ === "ordner") return fehler(`cat: ${ziel}: ist ein ordner. versuch: ls ${ziel}`);
    const gesperrt = sperre(teile);
    if (gesperrt) return gesperrtMeldung("cat", ziel, gesperrt);
    const text = await dateiText(knoten, pfadText(teile));
    if (knoten.virtuell === "notizen" && !text) {
      return kommentar("noch leer. versuch: note <text> oder edit notizen.txt");
    }
    if (text === null) {
      return [fehler(`cat: ${ziel}: verschlüsselt. nur datensalat.`), kommentar(`versuch: decrypt ${ziel}`)].join("\n");
    }
    return zeile(text);
  },

  async decrypt([ziel, ...passwort]) {
    if (!ziel) return fehler("decrypt: was denn? versuch: decrypt <datei>");
    const { teile, knoten } = aufloesen(ziel);
    if (!knoten) return fehler(`decrypt: ${ziel}: gibt es nicht. vielleicht nie gegeben.`);
    if (knoten.typ === "ordner") {
      return [fehler(`decrypt: ${ziel}: ist ein ordner.`), kommentar("ordner öffnet man mit connect.")].join("\n");
    }
    if (!knoten.verschluesselt) return kommentar(`${ziel} ist gar nicht verschlüsselt. einfach: cat ${ziel}`);
    const pfad = pfadText(teile);
    if (istOffen(pfad)) return befehle.cat([pfad]);
    if (!verfuegbar()) return keinKanal("decrypt");
    if (!passwort.length) {
      warten = { art: "decrypt", ziel: pfad };
      return zeile(`passwort für ${teile.at(-1)}:`);
    }

    const v = knoten.verschluesselt;
    const text = await entschluesseln(await schluessel(passwort.join(" "), v.salt, iterationen()), v);
    if (text === null) return [fehler("decrypt: falsches passwort."), kommentar(zufall(FALSCH_SPRUECHE))].join("\n");
    schreiben("terminal-dateien", { ...lesen("terminal-dateien", {}), [pfad]: passwort.join(" ") });
    return [zeile(`entschlüsselt: ${teile.at(-1)}`, "ok"), "", zeile(text)].join("\n");
  },

  async connect([ziel, ...passwort]) {
    if (!ziel) return fehler("connect: womit? die stimmen nennen dir keinen namen.");
    const gesellschaft = ziel.toLowerCase().replace(/\/$/, "").split("/").at(-1);
    if (!feedKnoten[gesellschaft]) return fehler(`connect: knoten ${ziel} antwortet nicht. vielleicht gibt es ihn gar nicht.`);
    const zumFeed = () => {
      ort = aufloesen(pfadOf(feedKnoten[gesellschaft])).teile;
      return befehle.ls([]);
    };
    if (feeds[gesellschaft]) return [kommentar("schon verbunden. sie haben dich nicht vergessen."), zumFeed()].join("\n");
    if (!verfuegbar()) return keinKanal("connect");
    if (!passwort.length) {
      warten = { art: "connect", ziel: gesellschaft };
      return zeile(`passphrase für ${gesellschaft}:`);
    }

    if (!(await verbinden(gesellschaft, passwort.join(" ")))) {
      return [fehler(`connect: ${gesellschaft} verweigert die verbindung.`), kommentar(zufall(FALSCH_SPRUECHE))].join("\n");
    }
    schreiben("terminal-feeds", { ...lesen("terminal-feeds", {}), [gesellschaft]: passwort.join(" ") });
    return [zeile(`verbindung zu ${gesellschaft} steht. ab jetzt gehörst du dazu. vorerst.`, "ok"), zumFeed()].join("\n");
  },

  async scan([eingabe]) {
    if (!eingabe) return [fehler("scan: welcher code?"), kommentar("halt die kamera auf einen qr-code oder tippe: scan <code>")].join("\n");
    if (!verfuegbar()) return keinKanal("scan");
    const code = codeNormalisieren(eingabe);
    const gefunden = funde();
    if (gefunden[code]) {
      const f = gefunden[code];
      return [kommentar("kennst du schon."), link(`cat ${fundPfad(f)}`, fundPfad(f), "datei")].join("\n");
    }

    const eintrag = baum.scan?.eintraege?.[await kennung(code)];
    const klar = eintrag && (await entschluesseln(await schluessel(code, eintrag.salt, iterationen()), eintrag));
    if (!klar) return [fehler(`scan: ${eingabe}: signatur unbekannt.`), kommentar(zufall(SCAN_FALSCH))].join("\n");

    const fund = JSON.parse(klar);
    gefunden[code] = fund;
    schreiben("terminal-funde", gefunden);
    const aus = [`${zeile("signatur erkannt. gespeichert unter", "ok")} ${link(`cat ${fundPfad(fund)}`, fundPfad(fund), "datei")}`, "", zeile(fund.text)];

    if (fund.sammlung) {
      const set = baum.scan.sammlungen?.[fund.sammlung];
      const codes = Object.keys(gefunden).filter((c) => gefunden[c].sammlung === fund.sammlung);
      aus.push("", kommentar(`sammelset ${fund.sammlung}: ${codes.length}/${set?.anzahl ?? "?"} teile`));
      // Alle Teile da: Die Belohnung ist mit allen Codes zusammen verschlüsselt
      const text = set && codes.length >= set.anzahl && (await entschluesseln(await schluessel(codes.sort().join("+"), set.salt, iterationen()), set));
      if (text) {
        const belohnung = JSON.parse(text);
        schreiben("terminal-belohnungen", { ...belohnungen(), [fund.sammlung]: belohnung });
        const pfad = `~/notes/sammlungen/${fund.sammlung}/${belohnung.name}`;
        aus.push("", `${zeile("sammelset vollständig. neue datei:", "ok")} ${link(`cat ${pfad}`, pfad, "datei")}`, "", zeile(belohnung.text));
      }
    }
    return aus.join("\n");
  },

  note(argumente) {
    if (!argumente.length) {
      return [kommentar("was denn? versuch: note <text>"), link(`cat ${NOTIZEN_PFAD}`, NOTIZEN_PFAD, "datei")].join("\n");
    }
    const alt = notizen();
    schreiben("terminal-notizen", `${alt ? alt + "\n" : ""}${zeitstempel()}  ${argumente.join(" ")}`);
    return [`${zeile("notiert in", "ok")} ${link(`cat ${NOTIZEN_PFAD}`, NOTIZEN_PFAD, "datei")}`, kommentar(zufall(NOTIZ_SPRUECHE))].join("\n");
  },

  edit([ziel = NOTIZEN_PFAD]) {
    const { knoten } = aufloesen(ziel);
    if (!knoten) return fehler(`edit: ${ziel}: gibt es nicht. vielleicht nie gegeben.`);
    if (knoten.virtuell !== "notizen") {
      return [fehler(`edit: ${ziel}: schreibgeschützt.`), kommentar("nur deine notizen gehören dir. der rest gehört dem netz.")].join("\n");
    }
    entwurf = notizen();
    return kommentar("editor offen. speichern nicht vergessen. das netz vergisst nichts, du schon.");
  },

  pwd: () => zeile(pfadText(ort)),
  whoami: () => zeile(zufall(WHOAMI)),

  sudo: () => fehler("Zugriff verweigert. Er sieht dich."),
  rm: () => fehler("rm: im SOURCE-Net verschwindet nichts. auch du nicht."),
  exit: () => kommentar("es gibt kein exit."),

  ping([ziel]) {
    if (ziel?.toLowerCase() !== "jwd") return fehler(`ping: ${ziel ?? "?"}: zeitüberschreitung. niemand antwortet. diesmal.`);
    return ["7 3 1", "7 3 1", "7 3 . 1"]
      .map((s, i) => zeile(`64 bytes von jwd.fornax: seq=${i + 1} signal=${s}`))
      .concat(kommentar("das signal kommt nicht aus berlin."))
      .join("\n");
  },

  trace: () =>
    [
      zeile("verfolge verbindung …"),
      zeile("  1  fx-7.source.net        12 ms"),
      zeile("  2  ???.fornax             ** ms"),
      zeile("  3  ???                    ** ms"),
      fehler("verbindung zurückverfolgt. zu dir."),
      kommentar("schau nicht hinter dich."),
    ].join("\n"),
};

// Pfad eines Knotens im Baum, für connect → Feed-Ordner
function pfadOf(gesucht, knoten = baum, teile = []) {
  if (knoten === gesucht) return pfadText(teile);
  for (const [n, kind] of Object.entries(knoten.inhalt ?? {})) {
    const treffer = pfadOf(gesucht, kind, [...teile, n]);
    if (treffer) return treffer;
  }
  return null;
}

// Ein Name in der ls-Ausgabe, antippbar
function eintrag(name, k, pfad) {
  if (k.typ === "ordner") {
    if (k.fortschritt) return link(`cd ${pfad}`, `${name}/ [${k.fortschritt}]`, "ordner");
    return k.gesperrt && !feeds[k.gesperrt]
      ? link(`connect ${k.gesperrt}`, `${name}/ [gesperrt]`, "gesperrt")
      : link(`cd ${pfad}`, `${name}/`, "ordner");
  }
  if (k.verschluesselt && !istOffen(pfad)) return link(`decrypt ${pfad}`, `${name} [gesperrt]`, "gesperrt");
  return link(`cat ${pfad}`, name, "datei");
}

function gesperrtMeldung(befehl, ziel, gesellschaft) {
  return [fehler(`${befehl}: ${ziel}: zugriff verweigert.`), kommentar(`nur für eingeweihte. versuch: connect ${gesellschaft}`)].join(
    "\n"
  );
}

async function ausfuehren(eingabe) {
  const [name, ...argumente] = eingabe.trim().split(/\s+/);
  if (!name) return "";
  const befehl = befehle[name.toLowerCase()];
  if (befehl) return befehl(argumente);
  const antwort = [fehler(`${name}: befehl nicht gefunden. ${zufall(UNBEKANNT_SPRUECHE)}`)];
  if (Math.random() < 0.5) antwort.push(kommentar("tippe help. wenn du dich traust."));
  return antwort.join("\n");
}

// ---------- Ansicht ----------

const begruessung = () =>
  [
    zeile("verbunden mit source-net · knoten fx-7"),
    zeile(baum.inhalt["motd.txt"]?.text ?? ""),
    kommentar("hilfe? tippe help"),
  ].join("\n");

export async function terminal() {
  try {
    await laden();
  } catch {
    return unterseite(
      "terminal",
      ausgabe("connect source-net", "fehler: keine verbindung zum source-net", "Prüfe deine Internetverbindung und öffne das Terminal erneut.")
    );
  }
  warten = null;

  return unterseite(
    "terminal",
    `<div class="term">
      <pre class="term-ausgabe" aria-live="polite">${begruessung()}</pre>
      <form class="term-zeile" autocomplete="off">
        <label>
          <span class="term-prompt"></span>
          <input type="text" name="eingabe" aria-label="Befehl eingeben" autocapitalize="off" autocorrect="off"
            spellcheck="false" enterkeyhint="send">
        </label>
      </form>
      <div class="term-editor" hidden>
        <div class="term-prompt">${NOTIZEN_PFAD}</div>
        <textarea aria-label="Notizen bearbeiten" autocapitalize="sentences" spellcheck="false"></textarea>
      </div>
      <div class="term-chips"></div>
    </div>`
  );
}

terminal.binden = (wurzel, { scan } = {}) => {
  const form = wurzel.querySelector(".term-zeile");
  if (!form) return;
  const feld = form.elements.eingabe;
  const aus = wurzel.querySelector(".term-ausgabe");
  const prompt = wurzel.querySelector(".term-prompt");
  const chips = wurzel.querySelector(".term-chips");
  const editor = wurzel.querySelector(".term-editor");
  const blatt = editor.querySelector("textarea");
  let position = verlauf.length;
  let laeuft = false;

  function auffrischen() {
    // Offener Editor ersetzt die Eingabezeile, ein Entwurf übersteht auch den Wechsel zu einem anderen Tab
    const schreibt = entwurf !== null;
    editor.hidden = !schreibt;
    form.hidden = schreibt;
    if (schreibt && blatt.value !== entwurf) blatt.value = entwurf;
    // Bei einer Passwortabfrage wird nicht mitgelesen
    prompt.textContent = warten ? (warten.art === "connect" ? "passphrase:" : "passwort:") : `${pfadText(ort)}$`;
    feld.type = warten ? "password" : "text";
    const liste = schreibt
      ? ["speichern", "verwerfen"]
      : warten
        ? ["abbrechen"]
        : ["ls", ...(ort.length ? ["cd .."] : []), ...(ort.join("/") === "notes" ? ["edit notizen.txt"] : []), "help", "clear"];
    chips.innerHTML = liste.map((b) => link(b, `[ ${b} ]`, "chip")).join("");
  }

  function anhaengen(html) {
    aus.insertAdjacentHTML("beforeend", `\n\n${html}`);
  }

  async function starten(eingabe, getippt) {
    if (laeuft) return;
    laeuft = true;
    try {
      await verarbeiten(eingabe);
    } catch (e) {
      // Nie hängen bleiben: Fehler zeigen, Terminal bleibt bedienbar
      warten = null;
      anhaengen(`${fehler("systemfehler. das netz stottert.")}\n${kommentar(e?.message ?? String(e))}`);
    }
    auffrischen();
    laeuft = false;
    if (entwurf !== null) {
      editor.scrollIntoView({ block: "start" });
      return blatt.focus();
    }
    form.scrollIntoView({ block: "end" });
    // Nach dem Antippen keine Tastatur aufklappen, außer es wird ein Passwort gebraucht
    if (getippt || warten) feld.focus();
  }

  async function verarbeiten(eingabe) {
    if (entwurf !== null) {
      const text = blatt.value.replace(/\s+$/, "");
      entwurf = null;
      if (eingabe === "speichern") {
        schreiben("terminal-notizen", text);
        const anzahl = text ? text.split("\n").length : 0;
        anhaengen(`${zeile(`gespeichert: ${anzahl} ${anzahl === 1 ? "zeile" : "zeilen"} in`, "ok")} ${link(`cat ${NOTIZEN_PFAD}`, NOTIZEN_PFAD, "datei")}`);
      } else {
        anhaengen(kommentar("verworfen. was nicht gespeichert ist, ist nie passiert."));
      }
    } else if (warten) {
      const { art, ziel } = warten;
      warten = null;
      if (eingabe === "abbrechen" || !eingabe.trim()) {
        anhaengen(kommentar("abgebrochen. feigling."));
      } else {
        anhaengen(`${zeile("********", "kommentar-ort")}\n${await befehle[art]([ziel, eingabe])}`);
      }
    } else {
      eingabe = eingabe.trim();
      if (eingabe) {
        verlauf.push(eingabe);
        position = verlauf.length;
      }
      if (eingabe === "clear") {
        aus.innerHTML = "";
      } else {
        const echo = `${zeile(`${pfadText(ort)}$ `, "kommentar-ort")}${zeile(eingabe, "befehl")}`;
        const ergebnis = await ausfuehren(eingabe);
        anhaengen(`${echo}${ergebnis ? "\n" + ergebnis : ""}`);
      }
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const wert = feld.value;
    feld.value = "";
    starten(wert, true);
  });

  // Am .term hängen, nicht an der Wurzel: Die bleibt bestehen, sonst stapeln sich die Handler bei jedem Besuch
  wurzel.querySelector(".term").addEventListener("click", (e) => {
    const ziel = e.target.closest(".term-link");
    if (!ziel) return;
    // Im Editor zählen nur speichern und verwerfen, damit kein Entwurf verloren geht
    if (entwurf !== null && !["speichern", "verwerfen"].includes(ziel.dataset.befehl)) return;
    // Ein Antippen während einer Passwortabfrage bricht sie ab
    if (warten && ziel.dataset.befehl !== "abbrechen") starten("abbrechen", false).then(() => starten(ziel.dataset.befehl, false));
    else starten(ziel.dataset.befehl, false);
  });

  blatt.addEventListener("input", () => {
    entwurf = blatt.value;
  });

  blatt.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "Enter")) {
      e.preventDefault();
      starten("speichern", false);
    }
  });

  feld.addEventListener("keydown", (e) => {
    if (warten) {
      if (e.key === "Escape") starten("abbrechen", true);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      position = Math.max(0, Math.min(verlauf.length, position + (e.key === "ArrowUp" ? -1 : 1)));
      feld.value = verlauf[position] ?? "";
    } else if (e.key === "Tab") {
      e.preventDefault();
      vervollstaendigen(feld);
    }
  });

  auffrischen();

  // Aufruf über einen QR-Code (#/scan/<code>): gleich einlesen, danach normale Terminal-Adresse
  if (scan) {
    history.replaceState(null, "", "#/terminal");
    starten(`scan ${scan}`, false);
  }
};

// Vervollständigt das letzte Wort zu einem Namen im passenden Ordner
function vervollstaendigen(feld) {
  const woerter = feld.value.split(" ");
  const letztes = woerter.pop();
  const schnitt = letztes.lastIndexOf("/");
  const ordnerPfad = schnitt >= 0 ? letztes.slice(0, schnitt + 1) : "";
  const anfang = letztes.slice(schnitt + 1);
  const { knoten } = aufloesen(ordnerPfad);
  if (knoten?.typ !== "ordner") return;
  const inhalt = inhaltVon(knoten);
  const treffer = Object.keys(inhalt).filter((n) => n.startsWith(anfang) && (anfang.startsWith(".") || !n.startsWith(".")));
  if (treffer.length !== 1) return;
  const name = treffer[0] + (inhalt[treffer[0]].typ === "ordner" ? "/" : "");
  feld.value = [...woerter, ordnerPfad + name].join(" ");
}
