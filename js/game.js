// ── GAME STATE ───────────────────────────────────────────
let G = null; // active game state
let activeSlot = null;
let pendingStartFitness = rnd(1, 20);

function normalizeChanges(changes = {}) {
  const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung'];
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

function defaultStats(origin) {
  const bases = {
    bauer:     { health:70, luck:50, fitness:75, looks:45, gold:20 },
    kaufmann:  { health:60, luck:70, fitness:50, looks:60, gold:200 },
    klerus:    { health:65, luck:60, fitness:40, looks:50, gold:80 },
  };
  return { ...(bases[origin] || bases.bauer) };
}

function newGame(slot, name, gender, origin, startYear, startFitness) {
  const s = defaultStats(origin);
  return {
    slot, name, gender, origin, year: parseInt(startYear),
    age: 0, dead: false,
    health: s.health, luck: s.luck, fitness: clamp(startFitness ?? rnd(1, 20), 1, 20), looks: s.looks,
    gold: s.gold, stand: 'Kind',
    bildung: 0, ansehen: 0,
    events: [],
    family: { vater: randomName('m'), mutter: randomName('f'), geschwister: rnd(0,3) },
    beruf: 'Keine Lehre',
    lehre: null,
    lehreJahr: null,
    meister: false,
    betrieb: false,
    mitarbeiter: 0,
    beziehungen: [],
    maxAge: 80 + rnd(0, 15),
    aktivitaetGenutzt: false,
    arbeitGenutzt: false,
    schuleGenutzt: false,
    heilerGenutzt: false,
  };
}

// UI/navigation/render logic was moved to js/ui.js.

// ── AGE UP ───────────────────────────────────────────────
function ageUp() {
  if (!G || G.dead) return;
  if (typeof G.maxAge !== 'number') G.maxAge = 80 + rnd(0, 15);
  const warLehrling = isLehrling();
  G.age++;
  G.year++;
  const lehreAbgeschlossenDiesesJahr = warLehrling && !isLehrling();
  G.aktivitaetGenutzt = false;
  G.arbeitGenutzt = false;
  G.schuleGenutzt = false;
  G.heilerGenutzt = false;

  if (G.betrieb && G.mitarbeiter > 0) {
    const betriebErtrag = G.mitarbeiter * 150;
    G.gold += betriebErtrag;
    addEventEntry('Dein Betrieb erwirtschaftet Gewinn.', 'good', { gold: betriebErtrag });
  }

  if (G.age >= 12 && !G.lehre) {
    showLehreAuswahl();
    writeSave(activeSlot, G);
    renderGame();
    return;
  }

  if (lehreAbgeschlossenDiesesJahr) {
    addEventEntry('Du hast deine Lehre abgeschlossen und bist nun Geselle.', 'event', {});
  }

  // Natural aging effects
  if (G.age > 40) G.health -= rnd(1,3);
  if (G.age > 60) G.health -= rnd(2,5);
  G.health = clamp(G.health, 0, 100);
  G.luck = clamp(G.luck - 2.5, 0, 100);

  // Random event
  const event = rollEvent();
  applyEffects(event.effects || {});
  addEventEntry(event.text, event.type, event.effects || {});

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

  if (lehreAbgeschlossenDiesesJahr) {
    showModal('⚒️ Lehre abgeschlossen', 'Du hast deine Lehre abgeschlossen und bist nun Geselle.', [
      { label: 'Weiter', action: closeModal }
    ]);
    return;
  }

  if (event.type === 'event' || event.type === 'bad' || event.important) {
    showModal(`Jahr ${G.year} · Alter ${G.age}`, esc(event.text), [
      ...(event.choices || []),
      { label: 'Weiter', action: closeModal }
    ]);
  }
}

// ── EVENT SYSTEM ─────────────────────────────────────────
function rollEvent() {
  const events = [
    // POSITIVE
    { text: 'Die Ernte war dieses Jahr reichlich. Dein Keller ist voll.', type: 'good', effects: { gold: +rnd(10,40) } },
    { text: 'Du hast auf dem Markt ein gutes Geschäft gemacht.', type: 'good', effects: { gold: +rnd(5,25) } },
    { text: 'Ein Wanderheiler schenkt dir einen Kräutertrank. Du fühlst dich besser.', type: 'good', effects: { health: +rnd(5,12) } },
    { text: 'Ein Freund aus der Kindheit besucht dich. Ihr verbringt einen schönen Tag zusammen.', type: 'good', effects: { luck: +rnd(3,8) } },
    { text: 'Du hast einen freien Nachmittag und genießt die Sonne auf dem Feld.', type: 'good', effects: { health: +3 } },
    { text: 'Der Priester lobt dich für deine Tugend vor der Gemeinde.', type: 'good', effects: { looks: +rnd(2,6) } },
    { text: 'Ein reicher Händler bietet dir Arbeit für eine Woche an.', type: 'good', effects: { gold: +rnd(15,35) } },
    // NEGATIVE
    { text: 'Du wurdest von einer Seuche heimgesucht und liegst krank darnieder.', type: 'bad', effects: { health: -rnd(8,20) } },
    { text: 'Diebe brachen in dein Heim ein und stahlen einen Teil deines Besitzes.', type: 'bad', effects: { gold: -rnd(5,30) } },
    { text: 'Ein strenger Winter hat die Vorräte aufgebraucht.', type: 'bad', effects: { health: -rnd(3,8), gold: -rnd(5,15) } },
    { text: 'Du hast dich beim Holzhacken verletzt.', type: 'bad', effects: { health: -rnd(3,10) } },
    { text: 'Ein Streit mit einem Nachbarn ließ dich schlecht schlafen.', type: 'bad', effects: { luck: -rnd(2,5) } },
    { text: 'Die Steuern wurden erhöht. Der König braucht Geld für seinen Feldzug.', type: 'bad', effects: { gold: -rnd(10,25) } },
    // NEUTRAL
    { text: 'Das Jahr verging ruhig. Nichts Besonderes ist passiert.', type: '', effects: {} },
    { text: 'Du hast einen Pilger aus fernen Landen getroffen und allerlei Geschichten gehört.', type: 'event', effects: {} },
    { text: 'Ein Turnier in der nahegelegenen Stadt zieht Schaulustige aus der ganzen Region an.', type: 'event', effects: {} },
    { text: 'Die Glocken der Kirche läuten für einen Hochzug im Dorf.', type: 'event', effects: {} },
    { text: 'Der Winter war kalt, aber du hast ihn gut überstanden.', type: '', effects: {} },
  ];
  return events[rnd(0, events.length - 1)];
}

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

function waehleLehre(lehreKey) {
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
}

function showLehreAuswahl() {
  showModal(
    '⚒️ Lehre wählen',
    'Du bist nun alt genug, um eine Lehre zu beginnen. Wähle deinen Berufsweg:',
    [
      { label: 'Handwerker', action: () => waehleLehre('handwerker') },
      { label: 'Gelehrter', action: () => waehleLehre('gelehrter') },
      { label: 'Händler', action: () => waehleLehre('haendler') },
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
  let modalText = `Du verdienst <span style="color:var(--gold)">+${lohn} Pfennig</span>.`;

  if (lehrling) {
    const gainB = rnd(5, 15);
    G.bildung = clamp(G.bildung + gainB, 0, 100);
    changes.bildung = gainB;
    text = 'Du arbeitest in deinem Beruf, sammelst Erfahrung und lernst wichtige Fertigkeiten.';
    modalText = `Du verdienst <span style="color:var(--gold)">+${lohn} Pfennig</span> und gewinnst <span style="color:var(--blue-l)">+${gainB} Bildung</span>.`;
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
    showModal('🏛️ Rathaus', 'Du brauchst 1000 Pfennig für die Meisterprüfung.', [{ label: 'Ok', action: closeModal }]);
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
    showModal('⚒️ Betriebe', 'Du brauchst 800 Pfennig, um einen Betrieb zu erwerben.', [{ label: 'Ok', action: closeModal }]);
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
    showModal('⚒️ Betriebe', 'Du brauchst 300 Pfennig für einen weiteren Mitarbeiter.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  G.gold -= 300;
  G.mitarbeiter += 1;
  addEventEntry('Du stellst einen weiteren Arbeiter für deinen Betrieb ein.', 'good', { gold: -300 });
  writeSave(activeSlot, G);
  renderGame();
  showModal('⚒️ Betriebe', `Neuer Mitarbeiter eingestellt. Aktuell: ${G.mitarbeiter}/2.`, [{ label: 'Weiter', action: closeModal }]);
}

function applyEffects(fx) {
  if (fx.health !== undefined) G.health = clamp(G.health + fx.health, 0, 100);
  if (fx.luck   !== undefined) G.luck   = clamp(G.luck   + fx.luck,   0, 100);
  if (fx.gold   !== undefined) G.gold   = Math.max(0, G.gold + fx.gold);
  if (fx.fitness!== undefined) G.fitness= clamp(G.fitness+ fx.fitness, 0, 100);
  if (fx.looks  !== undefined) G.looks  = clamp(G.looks  + fx.looks,   0, 100);
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


