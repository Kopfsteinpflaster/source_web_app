// Kleine Helfer, die mehrere Ansichten brauchen.

// Gerätespeicher; ohne localStorage (privater Modus) gilt alles nur bis zum Neuladen
export function lesen(schluessel, standard) {
  try {
    const wert = localStorage.getItem(schluessel);
    return wert === null ? standard : JSON.parse(wert);
  } catch {
    return standard;
  }
}

export function schreiben(schluessel, wert) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // nicht speicherbar, dann eben nur für diese Sitzung
  }
}

export const maskieren = (text) =>
  String(text).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

export const unterseite = (ordner, inhalt) => `
  <div class="leiste">
    <a class="zurueck" href="#/" aria-label="Zurück zur Startseite">[ cd .. ]</a>
    <h1>source@net:~/<b>${ordner}</b>$ <span class="cursor" aria-hidden="true">▌</span></h1>
  </div>
  ${inhalt}`;

// Shell-Ausgabe: Befehl, Meldung, Hinweis
export const ausgabe = (befehl, meldung, hinweis) => `
  <pre class="ausgabe"><span class="befehl">$ ${befehl}</span>
<span class="fehler">${meldung}</span>
<span class="kommentar"># ${hinweis}</span></pre>`;
