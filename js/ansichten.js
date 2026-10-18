// Ansichten der App. Jede Ansicht liefert HTML für <main id="ansicht">.

import * as bilder from "./bilder.js";
import { maskieren, unterseite, ausgabe } from "./hilfen.js";

export { lexikon } from "./lexikon.js";
export { knall } from "./knall.js";
export { terminal } from "./terminal.js";

const LOGO = String.raw`   _____ ____  __  ______  ____________
  / ___// __ \/ / / / __ \/ ____/ ____/
  \__ \/ / / / / / / /_/ / /   / __/
 ___/ / /_/ / /_/ / _, _/ /___/ /___
/____/\____/\____/_/ |_|\____/_____/`;

const kachel = (ziel, text, bild) => `
  <li>
    <a class="kachel" href="#/${ziel}">
      ${bild}
      <div>
        <h2>./${ziel}</h2>
        <p>${text}</p>
        <span class="enter" aria-hidden="true">[ enter ]</span>
      </div>
    </a>
  </li>`;

export const start = ({ booten }) => `
  <div class="start${booten ? " booten" : ""}">
    <pre class="logo" aria-label="SOURCE">${LOGO}</pre>
    <p class="untertitel">v0.1 · verbindung verschlüsselt</p>
    <ul class="log" aria-hidden="true">
      <li><span class="ok">[ ok ]</span> tor-circuit aufgebaut</li>
      <li><span class="ok">[ ok ]</span> knoten fx-7 erreicht</li>
      <li><span class="warn">[warn]</span> unbekanntes signal · fornax-cluster</li>
    </ul>
    <ul class="kacheln">
      ${kachel("lexikon", "Begriffe, Orte und Personen der verborgenen Welt", bilder.lexikon)}
      ${kachel("terminal", "Zugang zum SOURCE-Net", bilder.terminal)}
      ${kachel("news", "Meldungen aus der Stadt", bilder.news)}
    </ul>
    <a class="info" href="#/ot/impressum" aria-label="Impressum">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="12" cy="7.4" r="1.25" fill="currentColor"/>
        <path d="M12 10.6v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </a>
  </div>`;

export const news = () =>
  unterseite("news", ausgabe("tail -f meldungen.log", "keine meldungen", "Neue Meldungen erscheinen hier, sobald es etwas gibt."));

// Münzwurf: verfluchte Goldmünze. Glück eskaliert zum Positiven, Pech zum Negativen.
export const muenzwurf = () =>
  unterseite(
    "ot/münzwurf",
    `<div class="muenzwurf">
      <p class="anleitung"># Sucht euch eine Situation aus und besprecht vorher, wie sie zum Positiven und zum Negativen eskalieren könnte.</p>
      <div class="wurf">
        <button class="muenze" type="button" aria-label="Münze werfen">
          <span class="seite glueck" aria-hidden="true">${bilder.glueck}<b>Glück</b></span>
          <span class="seite pech" aria-hidden="true">${bilder.pech}<b>Pech</b></span>
        </button>
      </div>
      <p class="ergebnis" aria-live="polite"><span class="kommentar"># Tippe auf die Münze.</span></p>
      <button class="werfen" type="button">[ münze werfen ]</button>
    </div>`
  );

muenzwurf.binden = (wurzel) => {
  const muenze = wurzel.querySelector(".muenze");
  const wurf = wurzel.querySelector(".wurf");
  const knopf = wurzel.querySelector(".werfen");
  const ergebnis = wurzel.querySelector(".ergebnis");
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let drehung = 0; // immer ein Vielfaches von 180: 0 = Glück oben, 180 = Pech oben

  function werfen() {
    if (knopf.disabled) return;
    const glueck = crypto.getRandomValues(new Uint8Array(1))[0] < 128;
    drehung = drehung - (drehung % 360) + 360 * 6 + (glueck ? 0 : 180);

    knopf.disabled = true;
    muenze.disabled = true;
    ergebnis.innerHTML = `<span class="kommentar"># die münze fliegt …</span>`;
    muenze.style.transform = `rotateX(${drehung}deg)`;
    wurf.classList.remove("fliegt");
    void wurf.offsetWidth; // Animation neu starten
    wurf.classList.add("fliegt");

    setTimeout(() => {
      ergebnis.innerHTML = glueck
        ? `<span class="ok">Glück.</span> Die Situation eskaliert zum Positiven.`
        : `<span class="fehler">Pech.</span> Die Situation eskaliert zum Negativen.`;
      navigator.vibrate?.(glueck ? 40 : [60, 50, 60]);
      knopf.disabled = false;
      muenze.disabled = false;
    }, ruhig ? 0 : 1700);
  }

  muenze.addEventListener("click", werfen);
  knopf.addEventListener("click", werfen);
};

// Spielregeln, übernommen von kopfsteinpflaster.github.io/regeln.html
export const regeln = () =>
  unterseite(
    "ot/regeln",
    `<div class="ot-text">
      <h2>Rule of Cool</h2>
      <p>Wir sind alle hier, um Spaß zu haben.</p>
      <p>Wenn eine Regel euch beim Spielspaß stört und alle Anwesenden einverstanden sind, lasst sie doch einfach weg.</p>
      <p>Atze, Drama ist geil. Lass es zu. Meta-Absprachen, um Drama zu erzeugen, schlagen alles!</p>
      <p>Play to lose ist auch geil. Wenn du Langeweile hast, kannst du mal absichtlich auf die Schnauze fallen,
        damit du wieder Spaß am Spiel hast.</p>
      <p>Play to lift ist auch wunderbar. Unterstütze andere in ihren Rollen, um ihr Spiel zu beflügeln.</p>

      <h2>Break &amp; Cut</h2>
      <p>Break &amp; Cut sind unsere Safety-Mechanismen. Wenn du dich unwohl fühlst und aus der Situation raus willst,
        sagst du „Break!“. Dann kannst du dich aus der Situation herausnehmen.</p>
      <p>Cut ist die Steigerung von Break. Wenn du „Cut!“ sagst, wird die Situation abgebrochen und jemand kümmert
        sich um dich.</p>
      <p>In keinem der Fälle wird diskutiert. Es ist völlig in Ordnung, eine Szene abzubrechen.</p>

      <h2>„Hey, Atze!…“</h2>
      <p>„Hey, Atze!…“ ist unsere Metaansage. Diese Worte leiten eine Spielansage ein, die ein offenes Spielangebot
        bietet. Meistens ist das eine übernatürliche Kraft, die auf dich wirkt. Du kannst dir selbst aussuchen, wie du
        darauf reagierst, aber meistens macht eine völlige Überreaktion am meisten Spaß.</p>

      <h2>Slow Motion</h2>
      <p>Unser Spiel hat auch Sword &amp; Sorcery als Inspiration; da muss auch Action sein. Wenn ihr kämpft, bewegt
        ihr euch in Zeitlupe und spielt Treffer aus. Es gibt übernatürliche Kräfte, die das ändern können.</p>

      <h2>Das lange Messer</h2>
      <p>Das Spielkonzept sieht vor, dass manchmal draußen gespielt wird. Bitte verwendet keine Anscheinswaffen an
        öffentlichen Orten mit Uneingeweihten. Das kann jede Menge Ärger geben, und das möchten wir alle gerne vermeiden.</p>
      <p>Benutzt stattdessen einfach die ausgestreckte flache Hand, um einen Stich oder Schnitt darzustellen.</p>

      <h2>Knall</h2>
      <p>Wenn du eine übernatürliche Kraft benutzt, bekommst du einen Knall. Bei 5 Knall bekommst du einen Absturz.
        Knall verschwindet nicht von alleine; du musst eines der folgenden Dinge tun, um einen Knall loszuwerden:</p>
      <ul>
        <li>Einen intimen Moment erleben. (Ein tiefgreifendes und persönliches Gespräch reicht.)</li>
        <li>Du musst etwas (oder irgendwen) zerstören.</li>
        <li>Exzessiver Konsum berauschender Substanzen. (Lotus und Goldener Wein zählen nicht, wenn sie für andere
          Spieleffekte eingenommen werden.)</li>
      </ul>

      <h2>Absturz</h2>
      <p>Wenn du 5 Knall hast, bekommst du einen Absturz. Das ist ein akuter Kontrollverlust. Dein Charakter wird von
        seinem Wahnsinn übermannt. Danach reduzierst du deinen Knall auf 3 und meldest dich bei der Spielleitung.
        (Nach der Session.)</p>

      <h2>Münzwurf</h2>
      <p>Berliner wetten auf alles. Wenn du dich dazu entscheidest, kannst du eine Aktion eskalieren lassen. Du solltest
        das sparsam tun, damit es etwas Besonderes bleibt und das Spiel nicht gestört wird.</p>
      <p>Du suchst die eine Situation und einen Mitspieler aus. Gemeinsam geht ihr auf eine Metaebene und besprecht,
        wie die Situation eskalieren könnte, sowohl zum Positiven als auch zum Negativen. Danach werft ihr eine Münze.
        Wenn du gewinnst, eskaliert die Situation zum Positiven; wenn nicht, eskaliert die Situation zum Negativen.</p>

      <h2>Andere Meta-Techniken</h2>
      <h3>Black Box</h3>
      <p>Manchmal benötigen wir einen Raum, um Abstraktionen zu schaffen, weil nicht alles leicht darstellbar ist.
        Um Dinge wie Traumreisen oder sehr obskure Orte wie Ruinen aus verlassenen Zeitaltern darzustellen, verwenden
        wir eine Black Box. Das ist ein abgedunkelter Raum, in dem nur einige wenige Requisiten sind, um eine Stimmung
        zu erzeugen.</p>

      <h3>In Medias Res</h3>
      <p>In Medias Res beschreibt eine Erzählweise, die direkt, ohne Umschweife, in die Mitte der Handlung führt.
        Diese Technik soll Schwung in die Geschichte bringen und die Spieler*innen direkt in die Action werfen.
        Es wird eine Ausgangssituation abgesprochen, und die Handlung wird gestartet, kurz bevor etwas Bedeutendes
        geschieht. Danach wird die Szene beendet. Beispiele dafür sind:</p>
      <ul>
        <li>Ein Charakter beginnt in einer Gefangenschaft und muss entkommen.</li>
        <li>Ein Charakter muss aus einer gefährlichen Situation fliehen.</li>
        <li>Die Charaktere beginnen mitten in einer Actionszene oder nach einem Mord.</li>
        <li>Ein Charakter bricht irgendwo ein.</li>
        <li>Eine wichtige Information wird enthüllt.</li>
        <li>Ein Ritual wird durchgeführt.</li>
      </ul>
      <p>Es ist möglich, auf diese Weise mehrere Szenen aneinander zu hängen, um eine Geschichte in Szenen zu erzählen.
        Ähnlich wie in einem Film oder einer Serie. Dabei können auch NPCs eingebaut werden, die von anderen
        Spieler*innen gespielt werden.</p>
    </div>`
  );

// Außerhalb des Spiels: echte Angaben, kein In-Game-Text
export const impressum = () =>
  unterseite(
    "ot/impressum",
    `<div class="ot-text">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>Simon Rautenberg<br>Biesenbrower Straße 51<br>13057 Berlin</p>

      <h2>Kontakt</h2>
      <p>E-Mail: simon_rautenberg[kringel-a]outlook.de<br>Telefon: null einhundertsechsundsiebzig 87645326</p>

      <h2>Worum es sich handelt</h2>
      <p>SOURCE ist die Begleit-App zu
        <a href="https://kopfsteinpflaster.github.io" target="_blank" rel="noopener">Kopfsteinpflaster</a>,
        einem Live Action Role Play (Larp) in Berlin. Sie ist ein rein privates, nicht-kommerzielles Hobby-Projekt.
        Es werden keine Waren oder Dienstleistungen gegen Entgelt angeboten.</p>
      <p>Alle Inhalte innerhalb der App, etwa Meldungen, Lexikon-Einträge und das SOURCE-Net, sind frei erfunden
        und Teil des Spiels. Ähnlichkeiten mit realen Personen, Gruppen oder Ereignissen sind nicht beabsichtigt.</p>

      <h2>Haftung für Links</h2>
      <p>Diese App enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
        Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
        Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>

      <h2>Datenschutz-Kurzhinweis</h2>
      <p>Diese App nutzt bewusst weder Cookies noch Tracking-Tools und hat keine Benutzerkonten. Das Hosting erfolgt
        über GitHub Pages. Dabei werden vom Hoster (GitHub Inc.) automatisch Server-Logfiles (z. B. IP-Adressen) erhoben,
        um den technischen Betrieb sicheren Standards entsprechend zu gewährleisten.</p>
      <p>Damit die App offline funktioniert, speichert dein Browser ihre Dateien auf deinem Gerät zwischen. Außerdem merkt
        er sich für die laufende Sitzung, dass der Startbildschirm schon einmal geladen wurde, und speichert dauerhaft
        den Stand deines Knall-Zählers, die Passwörter und Funde, die du im Terminal freigeschaltet hast, und deine Notizen. Diese Daten bleiben auf deinem Gerät und werden nicht an uns übertragen. Du kannst sie jederzeit über die Browser-Einstellungen löschen.</p>

      <h2>Schriftart</h2>
      <p>Die App verwendet die Schriftart IBM Plex Mono, lizenziert unter der SIL Open Font License 1.1.
        Sie wird mit der App ausgeliefert und nicht von externen Servern geladen.</p>
    </div>`
  );

export const nichtGefunden = () =>
  unterseite("?", ausgabe("cd " + maskieren(location.hash.slice(2)), "cd: verzeichnis nicht gefunden", "Geh zurück zur Startseite."));
