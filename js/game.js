// ── GAME STATE ───────────────────────────────────────────
let G = null; // active game state
let activeSlot = null;
let pendingStartFitness = rnd(1, 20);

function normalizeChanges(changes = {}) {
  const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung', 'geschick'];
  const out = {};
  keys.forEach(k => {
    if (typeof changes[k] === 'number' && changes[k] !== 0) out[k] = changes[k];
  });
  return out;
}

function addEventEntry(text, type = '', changes = {}) {
  if (!G) return;
  G.events.push({ age: G.age, text, type, changes: normalizeChanges(changes) });
}

function heilerOptionen() {
  return {
    kloster: { name: 'Kloster', kosten: isKind() ? 0 : 50, failChance: 0.20 },
    wundheiler: { name: 'Wundheiler', kosten: 25, failChance: 0.35 }
  };
}

function heilerOption(typ) {
  return heilerOptionen()[typ] || null;
}

function marktItemKatalog() {
  return {
    heilsalbe: {
      id: 'heilsalbe',
      name: 'Heilsalbe',
      preis: 60,
      beschreibung: 'Heilt bei Benutzung 20 Gesundheit.'
    },
    bier: {
      id: 'bier',
      name: 'Bier',
      preis: 25,
      beschreibung: 'Sorgt 3 Jahre lang fuer +10 Zufriedenheit pro Jahr.'
    },
    schwert: {
      id: 'schwert',
      name: 'Schwert',
      preis: 250,
      beschreibung: 'Platzhalter fuer spaetere Kampf- und Statussysteme.'
    }
  };
}

function marktItem(itemId) {
  return marktItemKatalog()[itemId] || null;
}

const TITEL_STUFEN = ['Unfreier', 'Bürger', 'Patrizier', 'Baron', 'Landsherr'];
const TITEL_AUFSTIEGS_KOSTEN = {
  'Unfreier->Bürger': 500,
  'Bürger->Patrizier': 5000,
  'Patrizier->Baron': 15000,
  'Baron->Landsherr': 25000
};

const BEZIEHUNGS_CONFIG = {
  einwohnerGesamt: 100,
  interaktionenProJahr: 5,
  titelAnteile: {
    unfreier: 0.15,
    buerger: 0.50,
    patrizier: 0.20,
    baron: 0.15
  }
};

const START_TITEL_STUFEN = ['Unfreier', 'Bürger', 'Patrizier'];

function rollStartFamilienTitel() {
  return START_TITEL_STUFEN[rnd(0, START_TITEL_STUFEN.length - 1)];
}

function startGoldByTitel(titel) {
  if (titel === 'Unfreier') return 35;
  if (titel === 'Bürger') return 100;
  if (titel === 'Patrizier') return 160;
  return 100;
}

function verteileAnteile(gesamt, anteile) {
  const keys = Object.keys(anteile);
  const counts = {};
  let sum = 0;
  keys.forEach(k => {
    const c = Math.floor(gesamt * anteile[k]);
    counts[k] = c;
    sum += c;
  });
  let rest = gesamt - sum;
  while (rest > 0) {
    counts.buerger += 1;
    rest -= 1;
  }
  return counts;
}

function randomTitelAusPool(pool) {
  return pool.splice(rnd(0, pool.length - 1), 1)[0];
}

function baueTitelPool(gesamt) {
  const counts = verteileAnteile(gesamt, BEZIEHUNGS_CONFIG.titelAnteile);
  const pool = [];
  for (let i = 0; i < counts.unfreier; i++) pool.push('Unfreier');
  for (let i = 0; i < counts.buerger; i++) pool.push('Bürger');
  for (let i = 0; i < counts.patrizier; i++) pool.push('Patrizier');
  for (let i = 0; i < counts.baron; i++) pool.push('Baron');
  return pool;
}

function generateFamilie(familienTitel) {
  const geschwisterCount = rnd(0, 3);
  const geschwisterNamen = [];
  const mitglieder = [];
  for (let i = 0; i < geschwisterCount; i++) {
    const gender = rnd(0, 1) === 0 ? 'm' : 'f';
    const name = randomName(gender);
    const geschwisterAlter = rnd(1, 10);
    geschwisterNamen.push(name);
    mitglieder.push({
      id: `f_geschwister_${i + 1}`,
      gruppe: 'familie',
      rolle: 'Geschwister',
      name,
      gender,
      alter: geschwisterAlter,
      maxAlter: geschwisterAlter + rnd(0, Math.max(0, 80 - geschwisterAlter)),
      titel: familienTitel,
      beziehung: rnd(15, 55),
      status: 'familie'
    });
  }

  const vater = randomName('m');
  const mutter = randomName('f');

  const mutterAlter = rnd(22, 38);
  const vaterAlter = rnd(25, 40);
  mitglieder.unshift({
    id: 'f_mutter',
    gruppe: 'familie',
    rolle: 'Mutter',
    name: mutter,
    gender: 'f',
    alter: mutterAlter,
    maxAlter: mutterAlter + rnd(0, Math.max(0, 80 - mutterAlter)),
    titel: familienTitel,
    beziehung: rnd(30, 75),
    status: 'familie'
  });
  mitglieder.unshift({
    id: 'f_vater',
    gruppe: 'familie',
    rolle: 'Vater',
    name: vater,
    gender: 'm',
    alter: vaterAlter,
    maxAlter: vaterAlter + rnd(0, Math.max(0, 80 - vaterAlter)),
    titel: familienTitel,
    beziehung: rnd(30, 75),
    status: 'familie'
  });

  return {
    vater,
    vaterTitel: familienTitel,
    mutter,
    geschwister: geschwisterCount,
    geschwisterNamen,
    mitglieder,
    ehepartner: null,
    kinder: 0
  };
}

function baueAlterPool(gesamt) {
  const jugend    = Math.round(gesamt * 0.25); // ¼: 6–14 Jahre
  const erwachsen = Math.round(gesamt * 0.50); // ½: 16–35 Jahre
  const reif      = gesamt - jugend - erwachsen; // ¼: 36–60 Jahre
  const pool = [];
  for (let i = 0; i < jugend; i++)    pool.push(rnd(6, 14));
  for (let i = 0; i < erwachsen; i++) pool.push(rnd(16, 35));
  for (let i = 0; i < reif; i++)      pool.push(rnd(36, 60));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function generateBeziehungenPool(gesamt = BEZIEHUNGS_CONFIG.einwohnerGesamt) {
  const personen = [];
  const titelPool = baueTitelPool(gesamt);
  const alterPool = baueAlterPool(gesamt);
  const maenner = Math.floor(gesamt / 2);
  const frauen = gesamt - maenner;

  for (let i = 0; i < maenner; i++) {
    const alter = alterPool[i] ?? rnd(16, 35);
    personen.push({
      id: `p${i + 1}`,
      gruppe: 'stadt',
      name: randomName('m'),
      gender: 'm',
      alter,
      maxAlter: alter + rnd(0, Math.max(0, 80 - alter)),
      titel: randomTitelAusPool(titelPool),
      beziehung: rnd(-10, 10),
      status: 'single'
    });
  }
  for (let i = 0; i < frauen; i++) {
    const alter = alterPool[maenner + i] ?? rnd(16, 35);
    personen.push({
      id: `p${maenner + i + 1}`,
      gruppe: 'stadt',
      name: randomName('f'),
      gender: 'f',
      alter,
      maxAlter: alter + rnd(0, Math.max(0, 80 - alter)),
      titel: randomTitelAusPool(titelPool),
      beziehung: rnd(-10, 10),
      status: 'single'
    });
  }

  for (let i = personen.length - 1; i > 0; i--) {
    const j = rnd(0, i);
    [personen[i], personen[j]] = [personen[j], personen[i]];
  }

  return {
    config: {
      einwohnerGesamt: gesamt,
      titelAnteile: { ...BEZIEHUNGS_CONFIG.titelAnteile }
    },
    personen
  };
}

function stadtBevoelkerung() {
  if (!G) return [];
  if (!G.beziehungen || !Array.isArray(G.beziehungen.personen)) {
    G.beziehungen = generateBeziehungenPool();
  }
  return G.beziehungen.personen;
}

function findePerson(personId) {
  const id = String(personId);
  const stadt = stadtBevoelkerung().find(p => p.id === id);
  if (stadt) return stadt;
  const familie = Array.isArray(G?.family?.mitglieder) ? G.family.mitglieder.find(p => p.id === id) : null;
  return familie || null;
}

function beziehungsInteraktionenUebrig() {
  if (!G) return 0;
  if (typeof G.beziehungsInteraktionenGenutzt !== 'number') G.beziehungsInteraktionenGenutzt = 0;
  return Math.max(0, BEZIEHUNGS_CONFIG.interaktionenProJahr - G.beziehungsInteraktionenGenutzt);
}

function nutzeBeziehungsInteraktionOderWarnung() {
  if (!G) return false;
  const uebrig = beziehungsInteraktionenUebrig();
  if (uebrig <= 0) {
    showModal('Beziehungen', `Du hast in diesem Jahr bereits alle ${BEZIEHUNGS_CONFIG.interaktionenProJahr} Interaktionen genutzt.`, [{ label: 'Ok', action: closeModal }]);
    return false;
  }
  G.beziehungsInteraktionenGenutzt += 1;
  return true;
}

function aenderePersonBeziehung(person, delta) {
  if (!person) return;
  person.beziehung = clamp((person.beziehung || 0) + delta, -100, 100);
}

function standardAlterFuerPerson(person) {
  if (!person || typeof person !== 'object') return 18;
  if (person.gruppe === 'familie') {
    if (person.rolle === 'Vater') return rnd(25, 40);
    if (person.rolle === 'Mutter') return rnd(22, 38);
    return rnd(1, 10);
  }
  return rnd(18, 65);
}

function incrementierePersonenAlter() {
  if (!G) return [];
  const todesereignisse = [];

  if (Array.isArray(G.family?.mitglieder)) {
    G.family.mitglieder.forEach(person => {
      if (person.status === 'verstorben') return;
      const basisAlter = Number.isInteger(person.alter) && person.alter >= 0
        ? person.alter
        : standardAlterFuerPerson(person);
      if (!Number.isInteger(person.maxAlter)) {
        person.maxAlter = basisAlter + rnd(0, Math.max(0, 80 - basisAlter));
      }
      person.alter = basisAlter + 1;
      if (person.alter >= person.maxAlter) {
        person.status = 'verstorben';
        const anrede = person.gender === 'f' ? 'e' : '';
        const text = `Dein${anrede} ${person.rolle} ${person.name} ist in diesem Jahr gestorben.`;
        addEventEntry(text, 'bad', {});
        todesereignisse.push(text);
      }
    });
  }

  if (Array.isArray(G.beziehungen?.personen)) {
    const ueberlebende = [];
    G.beziehungen.personen.forEach(person => {
      const basisAlter = Number.isInteger(person.alter) && person.alter >= 0
        ? person.alter
        : standardAlterFuerPerson(person);
      if (!Number.isInteger(person.maxAlter)) {
        person.maxAlter = basisAlter + rnd(0, Math.max(0, 80 - basisAlter));
      }
      person.alter = basisAlter + 1;
      if (person.alter >= person.maxAlter) {
        if (person.status === 'ehepartner') {
          const text = `Dein Ehepartner ${person.name} ist in diesem Jahr gestorben.`;
          addEventEntry(text, 'bad', {});
          todesereignisse.push(text);
          if (G.family) G.family.ehepartner = null;
        }
        // Stadtbürger stirbt still
      } else {
        ueberlebende.push(person);
      }
    });
    G.beziehungen.personen = ueberlebende;
  }

  return todesereignisse;
}

function kannMitPersonenInteragieren() {
  return !!G && G.age >= 4;
}

function beziehungsAktionSprechen(personId) {
  if (!G) return;
  if (!kannMitPersonenInteragieren()) {
    showModal('Beziehungen', 'Interaktionen sind erst ab 4 Jahren möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  const person = findePerson(personId);
  if (!person) return;
  if (!nutzeBeziehungsInteraktionOderWarnung()) return;
  const delta = rnd(-5, 15);
  aenderePersonBeziehung(person, delta);
  addEventEntry(`Du sprichst mit ${person.name}.`, delta >= 0 ? 'good' : 'bad', { luck: delta > 0 ? 1 : 0 });
  writeSave(activeSlot, G);
  renderGame();
  showPersonInteraktion(person.id);
}

function beziehungsAktionGeschenk(personId) {
  if (!G) return;
  if (!kannMitPersonenInteragieren()) {
    showModal('Beziehungen', 'Interaktionen sind erst ab 4 Jahren möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  const person = findePerson(personId);
  if (!person) return;
  if (!nutzeBeziehungsInteraktionOderWarnung()) return;
  const kosten = 80;
  if (G.gold < kosten) {
    G.beziehungsInteraktionenGenutzt = Math.max(0, G.beziehungsInteraktionenGenutzt - 1);
    showModal('Beziehungen', 'Du hast nicht genug Gold für ein Geschenk (80 Gold).', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  G.gold -= kosten;
  const delta = rnd(-10, 40);
  aenderePersonBeziehung(person, delta);
  addEventEntry(`Du machst ${person.name} ein Geschenk.`, delta >= 0 ? 'good' : 'bad', { gold: -kosten });
  writeSave(activeSlot, G);
  renderGame();
  showPersonInteraktion(person.id);
}

function beziehungsAktionBeleidigen(personId) {
  if (!G) return;
  if (!kannMitPersonenInteragieren()) {
    showModal('Beziehungen', 'Interaktionen sind erst ab 4 Jahren möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  const person = findePerson(personId);
  if (!person) return;
  if (!nutzeBeziehungsInteraktionOderWarnung()) return;
  const delta = -rnd(0, 30);
  aenderePersonBeziehung(person, delta);
  addEventEntry(`Du beleidigst ${person.name}.`, 'bad', {});
  writeSave(activeSlot, G);
  renderGame();
  showPersonInteraktion(person.id);
}

function kannUmHandAnhalten(person) {
  if (!G || !person) return false;
  if (G.age < 16) return false;
  if (G.family?.ehepartner) return false;
  if (person.gruppe === 'familie' || person.status === 'familie') return false;
  if (person.gender === G.gender) return false;
  return (person.beziehung || 0) >= 80;
}

function umHandAnhalten(personId) {
  if (!G) return;
  if (!kannMitPersonenInteragieren()) {
    showModal('Beziehungen', 'Interaktionen sind erst ab 4 Jahren möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  const person = findePerson(personId);
  if (!person || !kannUmHandAnhalten(person)) {
    showModal('Beziehungen', 'Ein Antrag ist hier noch nicht möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (!nutzeBeziehungsInteraktionOderWarnung()) return;

  const chance = clamp((person.beziehung || 0) / 100, 0, 1);
  const erfolgreich = Math.random() < chance;

  if (erfolgreich) {
    G.family.ehepartner = person.name;
    person.status = 'ehepartner';
    addEventEntry(`${person.name} nimmt deinen Heiratsantrag an.`, 'good', { luck: 10 });
    showModal('💍 Verlobung', `${esc(person.name)} hat deinen Antrag angenommen. Ihr seid nun verlobt/verheiratet.`, [
      { label: 'Wunderbar', action: () => { closeModal(); openBeziehungenFamilieMenu(); } }
    ]);
  } else {
    aenderePersonBeziehung(person, -15);
    addEventEntry(`${person.name} lehnt deinen Heiratsantrag ab.`, 'bad', { luck: -8 });
    showModal('💔 Verlobung', `${esc(person.name)} lehnt deinen Antrag ab. Eure Beziehung leidet darunter.`, [
      { label: 'Verstanden', action: () => { closeModal(); showPersonInteraktion(person.id); } }
    ]);
  }

  writeSave(activeSlot, G);
  renderGame();
}

function titelIndex(titel) {
  return TITEL_STUFEN.indexOf(titel);
}

function naechsterTitelAufstieg() {
  if (!G) return null;
  const idx = titelIndex(G.titel);
  if (idx < 0 || idx >= TITEL_STUFEN.length - 1) return null;
  const von = TITEL_STUFEN[idx];
  const nach = TITEL_STUFEN[idx + 1];
  const key = `${von}->${nach}`;
  return { von, nach, kosten: TITEL_AUFSTIEGS_KOSTEN[key] ?? 0 };
}

function titelVorteilePlaceholderText(titel) {
  return `Titel: ${titel}. Konkrete Titelvorteile folgen in einem späteren Update.`;
}

function pruefeTitelAufstiegAktivierung() {
  if (!G || !G.pendingTitelAufstieg) return null;
  const pending = G.pendingTitelAufstieg;
  if (typeof pending.aktivAbJahr !== 'number' || G.year < pending.aktivAbJahr) return null;

  G.titel = pending.nach;
  G.pendingTitelAufstieg = null;
  return pending;
}

function kaufeTitelAufstieg() {
  if (!G) return;
  if (G.pendingTitelAufstieg) {
    showModal('🏛️ Rathaus', `Ein Titelaufstieg zu ${G.pendingTitelAufstieg.nach} ist bereits beantragt und wird ab dem Jahr ${G.pendingTitelAufstieg.aktivAbJahr} gültig.`, [{ label: 'Ok', action: closeModal }]);
    return;
  }

  const aufstieg = naechsterTitelAufstieg();
  if (!aufstieg) {
    showModal('🏛️ Rathaus', 'Du hast bereits den höchsten Titel erreicht.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  if (G.gold < aufstieg.kosten) {
    showModal('🏛️ Rathaus', `Du brauchst ${aufstieg.kosten} Gold für den Aufstieg von ${aufstieg.von} zu ${aufstieg.nach}.`, [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.gold -= aufstieg.kosten;
  G.pendingTitelAufstieg = {
    von: aufstieg.von,
    nach: aufstieg.nach,
    gekauftImJahr: G.year,
    aktivAbJahr: G.year + 1
  };

  addEventEntry(`Im Rathaus beantragst du den Titelaufstieg von ${aufstieg.von} zu ${aufstieg.nach}. Der Titel wird ab dem Jahr ${G.year + 1} gültig.`, 'event', { gold: -aufstieg.kosten });
  writeSave(activeSlot, G);
  renderGame();
  showModal('🏛️ Titelaufstieg', `Der Aufstieg zu ${aufstieg.nach} wurde gekauft. Er wird im Jahr ${G.year + 1} wirksam.`, [{ label: 'Verstanden', action: closeModal }]);
}

function defaultStats(origin) {
  const bases = {
    bauer:     { health:70, luck:50, fitness:75, looks:45, geschick:35, gold:20 },
    kaufmann:  { health:60, luck:70, fitness:50, looks:60, geschick:55, gold:200 },
    klerus:    { health:65, luck:60, fitness:40, looks:50, geschick:45, gold:80 },
  };
  return { ...(bases[origin] || bases.bauer) };
}

function newGame(slot, name, gender, origin, startYear, startFitness) {
  const s = defaultStats(origin);
  const familienTitel = rollStartFamilienTitel();
  return {
    slot, name, gender, origin, year: parseInt(startYear),
    age: 0, dead: false,
    health: s.health, luck: s.luck, fitness: clamp(startFitness ?? rnd(1, 20), 1, 20), looks: s.looks,
    geschick: s.geschick,
    gold: startGoldByTitel(familienTitel), stand: 'Kind',
    bildung: 0, ansehen: 0,
    events: [],
    family: generateFamilie(familienTitel),
    beruf: 'Keine Lehre',
    lehre: null,
    lehreJahr: null,
    meister: false,
    betrieb: false,
    mitarbeiter: 0,
    beziehungen: generateBeziehungenPool(),
    titel: familienTitel,
    pendingTitelAufstieg: null,
    inventar: [],
    aktiveEffekte: { bierJahre: 0 },
    krank: false,
    pendingBehandlung: null,
    pendingKrankheitHeilung: null,
    maxAge: 80 + rnd(0, 15),
    beziehungsInteraktionenGenutzt: 0,
    aktivitaetGenutzt: false,
    arbeitGenutzt: false,
    heilerGenutzt: false,
    krankheitHeilungGenutzt: false,
    schuleGenutzt: false,
  };
}

// UI/navigation/render logic was moved to js/ui.js.

// ── AGE UP ───────────────────────────────────────────────
function ageUp() {
  if (!G || G.dead) return;
  if (typeof G.maxAge !== 'number') G.maxAge = 80 + rnd(0, 15);
  const warLehrling = isLehrling();
  let krankheitHeilungPopup = null;
  let behandlungPopup = null;
  const jahresPopups = [];

  function pushJahresPopup(textOrEntry, changes = {}) {
    if (typeof textOrEntry === 'string' && textOrEntry.trim()) {
      jahresPopups.push({ text: textOrEntry.trim(), changes: normalizeChanges(changes) });
      return;
    }
    if (textOrEntry && typeof textOrEntry.text === 'string' && textOrEntry.text.trim()) {
      jahresPopups.push({
        text: textOrEntry.text.trim(),
        changes: normalizeChanges(textOrEntry.changes || {})
      });
    }
  }

  function renderJahresPopupEntry(entry, idx, total) {
    const effects = chronikTooltip(entry.changes || {})
      ? `<div class="year-popup-effects">${renderChronikEffects(entry.changes || {})}</div>`
      : '';
    const borderStyle = idx === total - 1 ? 'none' : '1px solid var(--border)';
    return `<div class="year-popup-entry" style="border-bottom:${borderStyle}"><div>${esc(entry.text)}</div>${effects}</div>`;
  }

  function showJahresPopups() {
    const eintraegeQuelle = jahresPopups.length
      ? jahresPopups
      : [{ text: 'Keine besonderen Vorkommnisse', changes: {} }];

    const heading = `<div class="year-popup-heading">JAHR ${G.year}</div><div class="year-popup-subheading">Alter ${G.age}</div>`;

    if (eintraegeQuelle.length === 1) {
      showModal('Jahresbericht', `${heading}${renderJahresPopupEntry(eintraegeQuelle[0], 0, 1)}`, [
        { label: 'Weiter', action: closeModal }
      ]);
      return true;
    }

    const eintraege = eintraegeQuelle
      .map((entry, idx) => `<div><strong>Ereignis ${idx + 1}:</strong>${renderJahresPopupEntry(entry, idx, eintraegeQuelle.length)}</div>`)
      .join('');

    showModal(
      'Jahresbericht',
      `${heading}<div style="max-height:42vh;overflow-y:auto;padding-right:0.25rem">${eintraege}</div>`,
      [{ label: 'Weiter', action: closeModal }]
    );
    return true;
  }
  G.age++;
  G.year++;
  const npcTodesereignisse = incrementierePersonenAlter();
  const lehreAbgeschlossenDiesesJahr = warLehrling && !isLehrling();
  G.aktivitaetGenutzt = false;
  G.arbeitGenutzt = false;
  G.schuleGenutzt = false;
  G.beziehungsInteraktionenGenutzt = 0;
  G.heilerGenutzt = false;
  G.krankheitHeilungGenutzt = false;

  const titelAufstiegAktiviert = pruefeTitelAufstiegAktivierung();
  if (titelAufstiegAktiviert) {
    const text = `Dein Titelaufstieg wird rechtskräftig. Du trägst nun den Titel ${titelAufstiegAktiviert.nach}.`;
    addEventEntry(text, 'good', {});
    pushJahresPopup(text);
  }

  if (!G.aktiveEffekte) G.aktiveEffekte = { bierJahre: 0 };

  if (G.aktiveEffekte.bierJahre > 0) {
    G.luck = clamp(G.luck + 10, 0, 100);
    G.aktiveEffekte.bierJahre -= 1;
    addEventEntry('Das Bier aus deinem Vorrat hebt in diesem Jahr deine Stimmung.', 'good', { luck: 10 });
    pushJahresPopup('Das Bier aus deinem Vorrat hebt in diesem Jahr deine Stimmung.', { luck: 10 });
  }

  // Behandlungen wirken erst im nächsten Jahr.
  if (G.pendingBehandlung) {
    const beh = G.pendingBehandlung;
    const istKloster = beh.typ === 'kloster';
    const opt = heilerOption(beh.typ);
    const failChance = opt ? opt.failChance : (istKloster ? 0.20 : 0.35);
    const fehlgeschlagen = Math.random() < failChance;

    if (fehlgeschlagen) {
      const malus = rnd(2, 6);
      G.health = clamp(G.health - malus, 0, 100);
      behandlungPopup = {
        text: istKloster
          ? 'Die Behandlung im Kloster ist fehlgeschlagen und schwächt dich.'
          : 'Die Behandlung beim Wundheiler ist fehlgeschlagen und schwächt dich.',
        changes: { health: -malus }
      };
      addEventEntry(behandlungPopup.text, 'bad', { health: -malus });
    } else {
      const heal = rnd(25, 40);
      G.health = clamp(G.health + heal, 0, 100);
      behandlungPopup = {
        text: istKloster
          ? 'Die Klosterbehandlung zeigt Wirkung und stärkt deine Gesundheit.'
          : 'Die Behandlung beim Wundheiler zeigt Wirkung und stärkt deine Gesundheit.',
        changes: { health: heal }
      };
      addEventEntry(behandlungPopup.text, 'good', { health: heal });
    }

    G.pendingBehandlung = null;
  }

  // Krankheitsheilung wirkt am Ende des Jahres
  if (G.pendingKrankheitHeilung) {
    if (G.krank) {
      const heilung = G.pendingKrankheitHeilung;
      const istKloster = heilung.typ === 'kloster';
      const opt = heilerOption(heilung.typ);
      const failChance = opt ? opt.failChance : (istKloster ? 0.20 : 0.35);

      if (Math.random() >= failChance) {
        G.krank = false;
        const text = istKloster
          ? 'Die Klosterbehandlung hat deine Krankheit geheilt.'
          : 'Die Behandlung beim Wundheiler hat deine Krankheit geheilt.';
        addEventEntry(text, 'good', {});
        krankheitHeilungPopup = text;
      } else {
        const text = istKloster
          ? 'Die Klosterbehandlung konnte deine Krankheit nicht heilen.'
          : 'Die Behandlung beim Wundheiler konnte deine Krankheit nicht heilen.';
        addEventEntry(text, 'bad', {});
        krankheitHeilungPopup = text;
      }
    }
    G.pendingKrankheitHeilung = null;
  }

  if (G.krank) {
    let damage = 5;
    if (G.age >= 60) damage = 15;
    else if (G.age >= 45) damage = 10;
    G.health = clamp(G.health - damage, 0, 100);
    addEventEntry('Eine Krankheit schwächt dich in diesem Jahr.', 'bad', { health: -damage });
    pushJahresPopup('Eine Krankheit schwächt dich in diesem Jahr.', { health: -damage });
  }

  if (G.betrieb && G.mitarbeiter > 0) {
    const betriebErtrag = G.mitarbeiter * 150;
    G.gold += betriebErtrag;
    addEventEntry('Dein Betrieb erwirtschaftet Gewinn.', 'good', { gold: betriebErtrag });
    pushJahresPopup('Dein Betrieb erwirtschaftet Gewinn.', { gold: betriebErtrag });
  }

  function runJahresabschluss() {
    const starteJahresereignisse = () => {
    if (lehreAbgeschlossenDiesesJahr) {
      addEventEntry('Du hast deine Lehre abgeschlossen und bist nun Geselle.', 'event', {});
      pushJahresPopup('Du hast deine Lehre abgeschlossen und bist nun Geselle.');
    }
    npcTodesereignisse.forEach(text => pushJahresPopup(text));

    // Natural aging effects
    if (G.age > 40) G.health -= rnd(1,3);
    if (G.age > 60) G.health -= rnd(2,5);
    G.health = clamp(G.health, 0, 100);
    G.luck = clamp(G.luck - 2.5, 0, 100);

    // Krankheit - separates System mit fester 8% Chance
    let wurdeKrankDiesesJahr = false;
    if (!G.krank && rollKrankheit()) {
      G.krank = true;
      wurdeKrankDiesesJahr = true;
      addEventEntry('Du bist erkrankt, du solltest einen Arzt aufsuchen.', 'bad', {});
      pushJahresPopup('Du bist erkrankt, du solltest einen Arzt aufsuchen.');
    }

    // Random event (altersgerecht)
    const event = rollEvent(G.age);
    applyEffects(event.effects || {});
    addEventEntry(event.text, event.type, event.effects || {});
    const eventIstBesonders = event.type || event.important || Object.keys(normalizeChanges(event.effects || {})).length > 0;
    if (eventIstBesonders) {
      pushJahresPopup({ text: event.text, changes: event.effects || {} });
    }

    // Death check
    if (G.health <= 0 || G.age >= G.maxAge) {
      const healthBeforeDeath = G.health;
      const diedFromHealth = G.health <= 0;
      G.dead = true;
      G.health = 0;
      const cause = diedFromHealth ? deathCause() : 'hohem Alter';
      addEventEntry(`${G.name} starb an ${cause}. Möge die Seele in Frieden ruhen.`, 'bad', { health: -healthBeforeDeath });
      writeSave(activeSlot, G);
      renderGame();
      showModal(`† ${G.name}`, `Du hast dein Leben in einem Alter von <strong>${G.age} Jahren</strong> im Jahre ${G.year} beendet. ${G.name} wird in Erinnerung bleiben als ${G.stand} aus ${originLabel(G.origin)}.<br><br><em>„${eulogy()}"</em>`, [
        { label: 'Chronik lesen', action: () => { closeModal(); openChronikScreen(); } },
        { label: 'Hauptmenü', action: () => { closeModal(); saveAndExit(); } }
      ]);
      return;
    }

    writeSave(activeSlot, G);
    renderGame();

    if (behandlungPopup) {
      pushJahresPopup(behandlungPopup);
    }

    if (krankheitHeilungPopup) {
      pushJahresPopup(krankheitHeilungPopup);
    }

    if (showJahresPopups()) {
      return;
    }
    };

    if (!titelAufstiegAktiviert) {
      starteJahresereignisse();
      return;
    }

    showModal(
      '👑 Die Stadt verkündet',
      `<strong>Neuer Titel:</strong> ${titelAufstiegAktiviert.nach}<br><strong>Vorheriger Titel:</strong> ${titelAufstiegAktiviert.von}<br><hr style="border-color:var(--border);margin:0.75rem 0"><em style="color:var(--muted)">${titelVorteilePlaceholderText(titelAufstiegAktiviert.nach)}</em>`,
      [{
        label: 'Zu den Ereignissen',
        action: () => {
          closeModal();
          starteJahresereignisse();
        }
      }]
    );
  }

  if (G.age >= 12 && !G.lehre) {
    showLehreAuswahl(() => {
      runJahresabschluss();
    });
    writeSave(activeSlot, G);
    renderGame();
    return;
  }

  runJahresabschluss();
}

// ── EVENT SYSTEM (Events sind jetzt in events.js ausgelagert) ──────────────
// rollEvent(age) und rollKrankheit() werden von events.js bereitgestellt

function berufFromLehre(lehre) {
  const map = {
    handwerker: 'Handwerker',
    gelehrter: 'Gelehrter',
    haendler: 'Händler',
  };
  return map[lehre] || 'Keine Lehre';
}

function standFromLehre(lehre) {
  const map = {
    handwerker: 'Handwerkerstand',
    gelehrter: 'Gelehrtenstand',
    haendler: 'Händlerstand',
  };
  return map[lehre] || 'Kind';
}

function waehleLehre(lehreKey, onComplete = null) {
  if (!G || G.lehre) return;

  G.lehre = lehreKey;
  G.lehreJahr = G.year;
  G.beruf = berufFromLehre(lehreKey);
  G.stand = standFromLehre(lehreKey);
  G.luck = clamp(G.luck + 15, 0, 100);

  addEventEntry(`Du beginnst eine Lehre als ${G.beruf}. Dein Berufsweg ist nun festgelegt.`, 'event', { luck: 15 });
  writeSave(activeSlot, G);
  renderGame();
  closeModal();
  if (typeof onComplete === 'function') onComplete();
}

function showLehreAuswahl(onComplete = null) {
  showModal(
    '⚒️ Lehre wählen',
    'Du bist nun alt genug, um eine Lehre zu beginnen. Wähle deinen Berufsweg:',
    [
      { label: 'Handwerker', action: () => waehleLehre('handwerker', onComplete) },
      { label: 'Gelehrter', action: () => waehleLehre('gelehrter', onComplete) },
      { label: 'Händler', action: () => waehleLehre('haendler', onComplete) },
    ]
  );
}

function lehreJahre() {
  if (!G || !G.lehre || typeof G.lehreJahr !== 'number') return 0;
  return Math.max(0, G.year - G.lehreJahr);
}

function isLehrling() {
  return !!G && !!G.lehre && lehreJahre() < 3;
}

function lehreStatusText() {
  if (!G || !G.lehre) return 'Noch keine';
  if (isLehrling()) {
    const jahr = Math.min(3, lehreJahre() + 1);
    return `${esc(berufFromLehre(G.lehre))} (Lehrling, Jahr ${jahr}/3)`;
  }
  return `${esc(berufFromLehre(G.lehre))} (Geselle)`;
}

function arbeiteImBeruf() {
  if (!G || !G.lehre) {
    showModal('⚒️ Arbeit', 'Du hast noch keine Lehre begonnen.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.arbeitGenutzt) {
    showModal('⚒️ Arbeit', 'Du hast in diesem Jahr bereits gearbeitet.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.arbeitGenutzt = true;
  const lehrling = isLehrling();
  const lohn = lehrling ? rnd(30, 80) : rnd(60, 160);
  G.gold += lohn;

  const changes = { gold: lohn };
  let text = 'Du arbeitest fleißig und erhältst deinen Lohn.';
  let modalText = `Du verdienst <span style="color:var(--gold)">+${lohn} Gold</span>.`;

  if (lehrling) {
    const gainB = rnd(5, 15);
    G.bildung = clamp(G.bildung + gainB, 0, 100);
    changes.bildung = gainB;
    text = 'Du arbeitest in deinem Beruf, sammelst Erfahrung und lernst wichtige Fertigkeiten.';
    modalText = `Du verdienst <span style="color:var(--gold)">+${lohn} Gold</span> und gewinnst <span style="color:var(--blue-l)">+${gainB} Bildung</span>.`;
  }

  addEventEntry(text, 'good', changes);
  writeSave(activeSlot, G);
  renderGame();
  showModal('⚒️ Arbeit', modalText, [{ label: 'Weiter', action: closeModal }]);
}

function isGeselle() {
  return !!G && !!G.lehre && !isLehrling();
}

function kaufeMeistertitel() {
  if (!G || !isGeselle()) {
    showModal('🏛️ Rathaus', 'Für die Meisterprüfung musst du zuerst deine Lehre abgeschlossen haben.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.meister) {
    showModal('🏛️ Rathaus', 'Du trägst den Meistertitel bereits.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.gold < 1000) {
    showModal('🏛️ Rathaus', 'Du brauchst 1000 Gold für die Meisterprüfung.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.gold -= 1000;
  G.meister = true;
  G.stand = 'Meisterstand';
  addEventEntry('Du hast die Meisterprüfung im Rathaus abgelegt und darfst nun einen eigenen Betrieb führen.', 'good', { gold: -1000 });
  writeSave(activeSlot, G);
  renderGame();
  showModal('🏛️ Meistertitel', 'Du hast die Meisterprüfung bestanden und darfst nun einen eigenen Betrieb führen.', [{ label: 'Weiter', action: closeModal }]);
}

function erwerbeBetrieb() {
  if (!G || !G.meister) {
    showModal('⚒️ Betriebe', 'Du brauchst zuerst den Meistertitel aus dem Rathaus.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.betrieb) {
    showModal('⚒️ Betriebe', 'Du besitzt bereits einen Betrieb.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.gold < 800) {
    showModal('⚒️ Betriebe', 'Du brauchst 800 Gold, um einen Betrieb zu erwerben.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.gold -= 800;
  G.betrieb = true;
  G.mitarbeiter = 1;
  addEventEntry('Du hast einen eigenen Betrieb erworben. Ein erster Arbeiter unterstützt dich.', 'good', { gold: -800 });
  writeSave(activeSlot, G);
  renderGame();
  showModal('⚒️ Betriebe', 'Betrieb erworben. Du startest mit 1 Arbeiter.', [{ label: 'Weiter', action: closeModal }]);
}

function stelleMitarbeiterEin() {
  if (!G || !G.betrieb) {
    showModal('⚒️ Betriebe', 'Du brauchst zuerst einen eigenen Betrieb.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.mitarbeiter >= 2) {
    showModal('⚒️ Betriebe', 'Du hast bereits die maximale Anzahl von 2 Mitarbeitern.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.gold < 300) {
    showModal('⚒️ Betriebe', 'Du brauchst 300 Gold für einen weiteren Mitarbeiter.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.gold -= 300;
  G.mitarbeiter += 1;
  addEventEntry('Du stellst einen weiteren Arbeiter für deinen Betrieb ein.', 'good', { gold: -300 });
  writeSave(activeSlot, G);
  renderGame();
  showModal('⚒️ Betriebe', `Neuer Mitarbeiter eingestellt. Aktuell: ${G.mitarbeiter}/2.`, [{ label: 'Weiter', action: closeModal }]);
}

function kaufeBehandlung(typ) {
  if (!G) return;
  if (G.heilerGenutzt) {
    showModal('Behandlung', 'Du hast in diesem Jahr bereits eine Behandlung gekauft.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  const opt = heilerOption(typ);
  if (!opt) return;

  if (G.gold < opt.kosten) {
    showModal('Behandlung', `Du brauchst ${opt.kosten} Gold für diese Behandlung.`, [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.heilerGenutzt = true;
  G.gold -= opt.kosten;
  G.pendingBehandlung = { typ: typ, jahr: G.year };
  addEventEntry(`Die Behandlung im ${opt.name} wird im nächsten Jahr Wirkung zeigen.`, 'event', { gold: -opt.kosten });
  writeSave(activeSlot, G);
  renderGame();
  showModal('Behandlung', `Die Behandlung im ${opt.name} wird im nächsten Jahr Wirkung zeigen.`, [{ label: 'Verstanden', action: closeModal }]);
}

function behandlungStatusLabel() {
  if (!G || !G.pendingBehandlung) return 'Keine laufende Behandlung';
  return G.pendingBehandlung.typ === 'kloster'
    ? 'Klosterbehandlung wartet auf Wirkung'
    : 'Wundheiler-Behandlung wartet auf Wirkung';
}

function krankheitHeilungStatusLabel() {
  if (!G || !G.pendingKrankheitHeilung) return '';
  return G.pendingKrankheitHeilung.typ === 'kloster'
    ? 'Klosterbehandlung für Krankheit wartet'
    : 'Wundheiler-Behandlung für Krankheit wartet';
}

function heilungKrankheit(typ) {
  if (!G) return;
  if (!G.krank) {
    showModal('Krankheitsheilung', 'Du bist nicht krank.', [{ label: 'Ok', action: closeModal }]);
    return;
  }
  if (G.krankheitHeilungGenutzt) {
    showModal('Krankheitsheilung', 'Du hast dich dieses Jahr bereits um Heilung bemüht.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  const opt = heilerOption(typ);
  if (!opt) return;

  if (G.gold < opt.kosten) {
    showModal('Krankheitsheilung', `Du brauchst ${opt.kosten} Gold für diese Heilung.`, [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.krankheitHeilungGenutzt = true;
  G.gold -= opt.kosten;
  G.pendingKrankheitHeilung = { typ: typ, jahr: G.year };
  addEventEntry(`Du suchst die ${opt.name} auf zur Heilung deiner Krankheit. Das Ergebnis zeigt sich im nächsten Jahr.`, 'event', { gold: -opt.kosten });
  writeSave(activeSlot, G);
  renderGame();
  showModal('Krankheitsheilung', `Du hast die ${opt.name} aufgesucht. Das Ergebnis zeigt sich im nächsten Jahr.`, [{ label: 'Verstanden', action: closeModal }]);
}

function inventarKapazitaet() {
  if (!G) return 0;
  if (G.fitness >= 100) return 6;
  if (G.fitness >= 80) return 5;
  if (G.fitness >= 50) return 4;
  return 3;
}

function inventarIstVoll() {
  return !!G && G.inventar.length >= inventarKapazitaet();
}

function inventarEintragLabel(itemId) {
  const item = marktItem(itemId);
  return item ? item.name : itemId;
}

function kaufeMarktItem(itemId) {
  if (!G) return;
  const item = marktItem(itemId);
  if (!item) return;

  if (inventarIstVoll()) {
    showModal('🏪 Markt', `Dein Inventar ist voll. Du hast ${G.inventar.length}/${inventarKapazitaet()} Plaetze belegt.`, [
      { label: 'Zurück', action: openMarktMenu }
    ]);
    return;
  }

  if (G.gold < item.preis) {
    showModal('🏪 Markt', `Du brauchst ${item.preis} Gold fuer ${item.name}.`, [
      { label: 'Zurück', action: openMarktMenu }
    ]);
    return;
  }

  G.gold -= item.preis;
  G.inventar.push(item.id);
  addEventEntry(`Du kaufst ${item.name} auf dem Markt.`, 'good', { gold: -item.preis });
  writeSave(activeSlot, G);
  renderGame();
  showModal('🏪 Markt', `${item.name} wurde fuer ${item.preis} Gold gekauft und liegt nun in deinem Inventar.`, [
    { label: 'Weiter einkaufen', action: openMarktMenu },
    { label: 'Inventar ansehen', action: openInventarMenu },
    { label: 'Schließen', action: closeModal }
  ]);
}

function nutzeInventarItem(index) {
  if (!G) return;
  if (!Number.isInteger(index) || index < 0 || index >= G.inventar.length) return;

  const itemId = G.inventar[index];
  const item = marktItem(itemId);
  if (!item) return;

  if (itemId === 'heilsalbe') {
    if (G.health >= 100) {
      showModal('Inventar', 'Deine Gesundheit ist bereits voll. Die Heilsalbe wuerde nichts bewirken.', [
        { label: 'Zurück', action: openInventarMenu }
      ]);
      return;
    }
    const heilung = Math.min(20, 100 - G.health);
    G.health = clamp(G.health + heilung, 0, 100);
    G.inventar.splice(index, 1);
    addEventEntry('Du verwendest Heilsalbe und versorgst deine Wunden.', 'good', { health: heilung });
    writeSave(activeSlot, G);
    renderGame();
    showModal('Inventar', `Die Heilsalbe wirkt: <span style="color:var(--green-l)">+${heilung} Gesundheit</span>.`, [
      { label: 'Zurück zum Inventar', action: openInventarMenu },
      { label: 'Schließen', action: closeModal }
    ]);
    return;
  }

  if (itemId === 'bier') {
    G.aktiveEffekte.bierJahre = (G.aktiveEffekte.bierJahre || 0) + 3;
    G.inventar.splice(index, 1);
    addEventEntry('Du lagerst Bier fuer die kommenden Jahre ein. Es wird deine Zufriedenheit fuer 3 Jahre steigern.', 'event', {});
    writeSave(activeSlot, G);
    renderGame();
    showModal('Inventar', 'Das Bier ist aktiviert und gibt dir fuer die naechsten 3 Jahre jeweils +10 Zufriedenheit.', [
      { label: 'Zurück zum Inventar', action: openInventarMenu },
      { label: 'Schließen', action: closeModal }
    ]);
    return;
  }

  if (itemId === 'schwert') {
    showModal('Inventar', 'Das Schwert ist aktuell nur ein Platzhalter und hat noch keine Funktion.', [
      { label: 'Zurück zum Inventar', action: openInventarMenu }
    ]);
  }
}

function applyEffects(fx) {
  if (fx.health !== undefined) G.health = clamp(G.health + fx.health, 0, 100);
  if (fx.luck   !== undefined) G.luck   = clamp(G.luck   + fx.luck,   0, 100);
  if (fx.gold   !== undefined) G.gold   = Math.max(0, G.gold + fx.gold);
  if (fx.fitness!== undefined) G.fitness= clamp(G.fitness+ fx.fitness, 0, 100);
  if (fx.looks  !== undefined) G.looks  = clamp(G.looks  + fx.looks,   0, 100);
  if (fx.geschick !== undefined) G.geschick = clamp(G.geschick + fx.geschick, 0, 100);
}

// ── HELPERS ───────────────────────────────────────────────
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function genderIcon(g) { return g === 'f' ? '👩' : '👨'; }
function originLabel(o) { return { bauer:'Bauer', kaufmann:'Kaufmann', klerus:'Klerus' }[o] || o; }
function lehreIcon(lehre) {
  return { handwerker:'🔨', gelehrter:'📚', haendler:'💼' }[lehre] || '';
}
function isKind() {
  return !G || G.age < 12;
}
function canPracticeWriting() {
  return !!G && G.age >= 4;
}
function isSchoolAge() {
  return !!G && G.age >= 6 && G.age <= 11;
}
function canGoToSchool() {
  return isSchoolAge() && !G.schuleGenutzt;
}
function schoolStatusLabel() {
  if (canGoToSchool()) return 'Schulbesuch möglich';
  if (isSchoolAge() && G.schuleGenutzt) return 'Bereits besucht';
  if (G && G.age < 6) return 'Zu jung';
  return 'Nicht mehr schulpflichtig';
}
function besucheSchule() {
  if (!canGoToSchool()) {
    showModal('Schule', 'Ein Schulbesuch ist aktuell nicht möglich.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.schuleGenutzt = true;
  const erlaubtOderBezahlbar = rnd(0, 1) === 1;
  if (!erlaubtOderBezahlbar) {
    addEventEntry('Deine Eltern konnten dir dieses Jahr keinen Schulbesuch ermöglichen.', 'bad', {});
    writeSave(activeSlot, G);
    renderGame();
    showModal('🏫 Schule', 'Dieses Jahr klappt es nicht: Deine Eltern erlauben oder finanzieren den Schulbesuch nicht.', [{ label: 'Verstanden', action: closeModal }]);
    return;
  }

  const gainB = rnd(3, 7);
  G.bildung = clamp(G.bildung + gainB, 0, 100);
  addEventEntry('Du durftest zur Schule gehen und hast viel gelernt.', 'good', { bildung: gainB });
  writeSave(activeSlot, G);
  renderGame();
  showModal('🏫 Schule', `Der Unterricht war erfolgreich: <span style="color:var(--gold)">+${gainB} Bildung</span>.`, [{ label: 'Weiter', action: closeModal }]);
}

function healthLabel(h) {
  if (h > 85) return 'Blühend';
  if (h > 65) return 'Gesund';
  if (h > 40) return 'Angeschlagen';
  if (h > 20) return 'Krank';
  return 'Sterbend';
}

// ── DEBUG FUNCTIONS ───────────────────────────────────────────
function toggleDebugMenu() {
  const menu = document.getElementById('debug-menu');
  if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', function(e) {
  const dd = document.getElementById('debug-dropdown');
  if (dd && !dd.contains(e.target)) {
    const menu = document.getElementById('debug-menu');
    if (menu) menu.classList.remove('open');
  }
});

function debugMakeSick() {
  if (!G) return;
  G.krank = true;
  G.health = clamp(G.health - 20, 0, 100);
  addEventEntry('[DEBUG] Du wurdest krank gemacht!', 'bad', { health: -20 });
  writeSave(activeSlot, G);
  renderGame();
}

function debugAddGold() {
  if (!G) return;
  G.gold += 10000;
  addEventEntry('[DEBUG] +10000 Gold hinzugefügt!', 'good', { gold: 10000 });
  writeSave(activeSlot, G);
  renderGame();
}
function bildungLabel(b) {
  if (b < 10) return 'Analphabet';
  if (b < 30) return 'Grundkenntnisse';
  if (b < 60) return 'Schreibkundig';
  if (b < 80) return 'Gelehrt';
  return 'Weiser';
}
function berufEinkommen(beruf) {
  const map = { 'Keine Lehre':4, 'Handwerker':18, 'Gelehrter':14, 'Händler':24 };
  return map[beruf] || 10;
}
function deathCause() {
  const causes = ['einer Seuche','einer Kriegswunde','einem Fieber','Erschöpfung','einem Unfall','einem langen Leiden'];
  return causes[rnd(0,causes.length-1)];
}
function eulogy() {
  const e = ['Er pflegte stets zu sagen: Die Arbeit adelt den Mann.', 'Sie hinterließ eine Spur der Güte.', 'Ein Leben gelebt wie es Gott gefiel.', 'Wenig Reichtum, aber viel Würde.'];
  return e[rnd(0,e.length-1)];
}

const MALE_NAMES   = ['Heinrich','Wilhelm','Konrad','Friedrich','Otto','Berthold','Gottfried','Walther','Gerhard','Ekkehard'];
const FEMALE_NAMES = ['Hildegard','Agnes','Mechthild','Adelheid','Kunigunde','Mathilde','Elisabeth','Gisela','Hedwig','Bertha'];
function randomName(gender) {
  const pool = gender === 'f' ? FEMALE_NAMES : MALE_NAMES;
  return pool[rnd(0, pool.length-1)];
}


