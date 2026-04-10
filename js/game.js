// ── SAVE MANAGEMENT ──────────────────────────────────────
const SAVE_KEY = 'mittelalter_leben_saves';
const MAX_SLOTS = 10;

function loadAllSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch(e) { return {}; }
}
function saveAllSaves(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
function getSave(slot) { return loadAllSaves()[slot] || null; }
function writeSave(slot, data) {
  const all = loadAllSaves();
  all[slot] = data;
  saveAllSaves(all);
}
function deleteSave(slot) {
  const all = loadAllSaves();
  delete all[slot];
  saveAllSaves(all);
}

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
    beziehungen: [],
    maxAge: 80 + rnd(0, 15),
    aktivitaetGenutzt: false,
    arbeitGenutzt: false,
    schuleGenutzt: false,
    heilerGenutzt: false,
  };
}

function migrateLegacySave(save) {
  if (!save || typeof save !== 'object') return save;

  if (save.origin === 'adel') save.origin = 'bauer';
  if (save.stand === 'Junker' || save.stand === 'Patrizier') save.stand = 'Kind';
  if (save.beruf === 'Müßiggang' || save.beruf === 'Gebet' || save.beruf === 'Feldarbeit' || save.beruf === 'Warenhandel') {
    save.beruf = 'Keine Lehre';
  }

  if (!('lehre' in save)) save.lehre = null;
  if (!('lehreJahr' in save)) save.lehreJahr = null;
  if (save.lehre && typeof save.lehreJahr !== 'number') save.lehreJahr = save.year;
  if (!('schuleGenutzt' in save)) save.schuleGenutzt = false;
  if (!('aktivitaetGenutzt' in save)) save.aktivitaetGenutzt = false;
  if (!('arbeitGenutzt' in save)) save.arbeitGenutzt = false;
  if (!('heilerGenutzt' in save)) save.heilerGenutzt = false;
  if (typeof save.maxAge !== 'number') save.maxAge = 80 + rnd(0, 15);
  if (!save.stand) save.stand = save.lehre ? standFromLehre(save.lehre) : 'Kind';
  if (!save.beruf) save.beruf = save.lehre ? berufFromLehre(save.lehre) : 'Keine Lehre';

  return save;
}

// ── SCREEN NAV ───────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function showSlots() {
  renderSlots();
  showScreen('screen-slots');
}

function renderSlots() {
  const all = loadAllSaves();
  const list = document.getElementById('slots-list');
  let changed = false;
  list.innerHTML = '';

  // Bestehende Spielstände anzeigen
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const save = all[i] || null;
    if (!save) continue;
    const normalizedSave = migrateLegacySave(save);
    all[i] = normalizedSave;
    changed = true;
    const div = document.createElement('div');
    div.className = 'save-slot';
    const icon = genderIcon(normalizedSave.gender) + (normalizedSave.lehre ? lehreIcon(normalizedSave.lehre) : '');
    div.innerHTML = `
      <div class="slot-icon">${icon}</div>
      <div class="slot-info">
        <div class="slot-name">${esc(normalizedSave.name)}</div>
        <div class="slot-meta">${normalizedSave.age} Jahre · ${normalizedSave.year} n. Chr. · ${esc(normalizedSave.stand)}</div>
      </div>
      <div class="slot-actions">
        <button class="btn btn-sm" onclick="loadGame(${i});event.stopPropagation()">Laden</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete(${i});event.stopPropagation()">✕</button>
      </div>`;
    div.onclick = () => loadGame(i);
    list.appendChild(div);
  }

  if (changed) saveAllSaves(all);

  // Freien Slot für neues Leben suchen
  const usedSlots = Object.keys(all).map(Number);
  const nextFreeSlot = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).find(i => !usedSlots.includes(i));

  // Schaltfläche "Neues Leben" nur wenn noch ein freier Slot vorhanden
  if (nextFreeSlot !== undefined) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-gold mt-2';
    btn.style.display = 'block';
    btn.textContent = '✦ Neues Leben beginnen';
    btn.onclick = () => openCreateScreen(nextFreeSlot);
    list.appendChild(btn);
  } else {
    const p = document.createElement('p');
    p.className = 'text-muted text-center mt-2';
    p.style.fontSize = '0.8rem';
    p.textContent = 'Alle Spielstandsplätze sind belegt. Lösche einen Spielstand, um ein neues Leben zu beginnen.';
    list.appendChild(p);
  }
}

function openCreateScreen(slot) {
  activeSlot = slot;
  pendingStartFitness = rnd(1, 20);
  document.getElementById('create-name').value = '';
  updateCharPreview();
  showScreen('screen-create');
}

function updateCharPreview() {
  const name = document.getElementById('create-name').value || '???';
  const gender = document.getElementById('create-gender').value;
  const s = defaultStats('bauer');
  const prev = document.getElementById('char-preview');
  prev.innerHTML = `
    <div class="char-header" style="margin-bottom:0">
      <div class="char-avatar">${genderIcon(gender)}</div>
      <div class="char-info">
        <div class="char-name">${esc(name)}</div>
        <div class="char-desc">Kind · Startkraft ${statDisplayValue(pendingStartFitness)}</div>
      </div>
      <div class="char-year" style="color:var(--gold)">${s.gold} 💰</div>
    </div>`;
}

document.getElementById('create-name').addEventListener('input', updateCharPreview);
document.getElementById('create-gender').addEventListener('change', updateCharPreview);

function startNewGame() {
  const name = document.getElementById('create-name').value.trim();
  if (!name) { alert('Bitte gib deinem Charakter einen Namen.'); return; }
  const gender = document.getElementById('create-gender').value;
  const year = document.getElementById('create-year').value;
  G = newGame(activeSlot, name, gender, 'bauer', year, pendingStartFitness);
  addEventEntry(`${name} wurde geboren — eine neue Seele betritt die Welt.`, 'event');
  writeSave(activeSlot, G);
  renderGame();
  showScreen('screen-game');
}

function loadGame(slot) {
  const save = getSave(slot);
  if (!save) return;
  G = migrateLegacySave(save);
  activeSlot = slot;
  writeSave(activeSlot, G);
  renderGame();
  showScreen('screen-game');
}

function saveAndExit() {
  if (G) writeSave(activeSlot, G);
  showSlots();
}

function confirmDelete(slot) {
  const save = getSave(slot);
  if (!save) return;
  showModal(`Spielstand löschen?`, `Bist du sicher, dass du das Leben von <strong>${esc(save.name)}</strong> unwiderruflich beenden möchtest?`, [
    { label: 'Löschen', danger: true, action: () => { deleteSave(slot); closeModal(); renderSlots(); } },
    { label: 'Abbrechen', action: closeModal }
  ]);
}

// ── GAME RENDER ──────────────────────────────────────────
function renderGame() {
  if (!G) return;
  const icon = genderIcon(G.gender) + (G.lehre ? lehreIcon(G.lehre) : '');
  document.getElementById('game-avatar').textContent = icon;
  document.getElementById('game-name').textContent = G.name;
  document.getElementById('game-desc').textContent = G.stand;
  document.getElementById('game-age-display').textContent = `${G.age} Jahre`;
  document.getElementById('game-year-display').textContent = `${G.year} n. Chr.`;
  document.getElementById('game-gold').textContent = G.gold.toLocaleString('de-DE');
  document.getElementById('game-stand').textContent = G.stand;
  setBar('bar-health', G.health);
  setBar('bar-luck',   G.luck);
  setBar('bar-fitness',G.fitness);
  setBar('bar-looks',  G.looks);
  document.getElementById('value-health').textContent = statDisplayValue(G.health);
  document.getElementById('value-luck').textContent = statDisplayValue(G.luck);
  document.getElementById('value-fitness').textContent = statDisplayValue(G.fitness);
  document.getElementById('value-looks').textContent = statDisplayValue(G.looks);
  document.getElementById('info-familie').textContent   = G.family.vater ? `Vater, Mutter, ${G.family.geschwister === 0 ? 'keine' : G.family.geschwister} Geschwister` : '—';
  document.getElementById('info-beruf').textContent     = G.beruf || '—';
  document.getElementById('info-gesundheit').textContent= healthLabel(G.health);
  document.getElementById('info-vermoegen').textContent = G.gold + ' Pfennig';
  document.getElementById('info-bez').textContent       = G.beziehungen.length + ' Personen';
  document.getElementById('info-bildung').textContent   = canGoToSchool() ? 'Schule möglich' : bildungLabel(G.bildung);
  document.getElementById('btn-age-up').disabled        = G.dead;
  document.getElementById('btn-age-up').textContent = G.dead ? '† Gestorben' : '⏳ Jahr voranschreiten';
  renderSchoolNotice();
  renderLog();
}

function renderSchoolNotice() {
  const notice = document.getElementById('school-notice');
  if (!notice || !G) return;

  if (canGoToSchool()) {
    notice.style.display = 'block';
    notice.textContent = 'Schulbesuch ist in diesem Jahr möglich. Du findest ihn im Bereich Bildung.';
    return;
  }

  notice.style.display = 'none';
  notice.textContent = '';
}

function setBar(id, val) {
  document.getElementById(id).style.width = Math.max(0, Math.min(100, val)) + '%';
}

function statDisplayValue(v) {
  const rounded = Math.round(v * 10) / 10;
  return `${rounded.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/100`;
}

function renderLog() {
  const log = document.getElementById('event-log');
  log.innerHTML = '';
  const recent = [...G.events].reverse().slice(0, 15);
  recent.forEach(e => {
    const div = document.createElement('div');
    div.className = 'log-entry ' + (e.type || '');
    div.innerHTML = `<span class="log-age">Alter ${e.age}:</span>${esc(e.text)}`;
    const tip = chronikTooltip(e.changes || {});
    if (tip) {
      div.setAttribute('data-tip', tip);
      div.title = tip;
    }
    log.appendChild(div);
  });
}

function openChronikScreen() {
  if (!G) return;
  renderChronik();
  showScreen('screen-chronik');
}

function formatDelta(n) {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
}

function chronikTooltip(changes = {}) {
  const labels = {
    gold: 'Gold',
    health: 'Gesundheit',
    fitness: 'Kraft',
    luck: 'Zufriedenheit',
    looks: 'Ansehen',
    bildung: 'Bildung',
  };
  const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung'];
  const parts = keys
    .filter(key => typeof changes[key] === 'number' && changes[key] !== 0)
    .map(key => `${labels[key]}: ${formatDelta(changes[key])}`);
  return parts.join(' | ');
}

function renderChronikEffects(changes = {}) {
  const labels = {
    gold: 'Gold',
    health: 'Gesundheit',
    fitness: 'Kraft',
    luck: 'Zufriedenheit',
    looks: 'Ansehen',
    bildung: 'Bildung',
  };
  const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung'];
  const chips = [];
  keys.forEach(k => {
    const val = changes[k] || 0;
    if (val === 0) return;
    chips.push({ val, html: `<span class="chronik-chip ${val > 0 ? 'good' : 'bad'}">${labels[k]} ${formatDelta(val)}</span>` });
  });
  chips.sort((a, b) => b.val - a.val);
  return chips.length ? chips.map(c => c.html).join('') : '<span class="chronik-chip none">Keine direkten Werteänderungen</span>';
}

function renderChronik() {
  const list = document.getElementById('chronik-list');
  if (!G || !list) return;
  if (!G.events.length) {
    list.innerHTML = '<p class="text-muted">Noch keine Ereignisse.</p>';
    return;
  }
  const entries = [...G.events].reverse();
  list.innerHTML = entries.map(e => {
    return `
      <div class="chronik-entry ${e.type || ''}">
        <div class="chronik-meta">Alter ${e.age}</div>
        <div class="chronik-text">${esc(e.text)}</div>
        <div class="chronik-effects">${renderChronikEffects(e.changes || {})}</div>
      </div>`;
  }).join('');
}

// ── AGE UP ───────────────────────────────────────────────
function ageUp() {
  if (!G || G.dead) return;
  if (typeof G.maxAge !== 'number') G.maxAge = 80 + rnd(0, 15);
  G.age++;
  G.year++;
  G.aktivitaetGenutzt = false;
  G.arbeitGenutzt = false;
  G.schuleGenutzt = false;
  G.heilerGenutzt = false;

  if (G.age >= 12 && !G.lehre) {
    showLehreAuswahl();
    writeSave(activeSlot, G);
    renderGame();
    return;
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

function applyEffects(fx) {
  if (fx.health !== undefined) G.health = clamp(G.health + fx.health, 0, 100);
  if (fx.luck   !== undefined) G.luck   = clamp(G.luck   + fx.luck,   0, 100);
  if (fx.gold   !== undefined) G.gold   = Math.max(0, G.gold + fx.gold);
  if (fx.fitness!== undefined) G.fitness= clamp(G.fitness+ fx.fitness, 0, 100);
  if (fx.looks  !== undefined) G.looks  = clamp(G.looks  + fx.looks,   0, 100);
}

// ── MENU ACTIONS ─────────────────────────────────────────
function openMenu(which) {
  if (which === 'chronik') {
    openChronikScreen();
    return;
  }
  const menus = {
    familie: {
      title: '👪 Familie',
      body: () => `
        <strong>Vater:</strong> ${esc(G.family.vater || 'Unbekannt')}<br>
        <strong>Mutter:</strong> ${esc(G.family.mutter || 'Unbekannt')}<br>
        <strong>Geschwister:</strong> ${G.family.geschwister === 0 ? 'Keine' : G.family.geschwister}<br>
        ${G.family.ehepartner ? `<strong>Ehepartner/in:</strong> ${esc(G.family.ehepartner)}<br>` : ''}
        ${G.family.kinder ? `<strong>Kinder:</strong> ${G.family.kinder}<br>` : ''}
        <hr style="border-color:var(--border);margin:0.75rem 0">
        <em style="color:var(--muted);font-size:0.8rem">Weitere Aktionen folgen in einer späteren Version.</em>
      `,
      actions: [{ label: 'Schließen', action: closeModal }]
    },
    beruf: {
      title: '⚒️ Beruf',
      body: () => `
        <strong>Aktueller Beruf:</strong> ${esc(G.beruf || 'Keine Lehre')}<br>
        <strong>Lehre:</strong> ${lehreStatusText()}<br>
        <strong>Stand:</strong> ${esc(G.stand)}<br>
        <strong>Arbeit in diesem Jahr:</strong> ${G.lehre ? (G.arbeitGenutzt ? 'Bereits erledigt' : 'Noch offen') : 'Nicht verfügbar'}<br>
        <hr style="border-color:var(--border);margin:0.75rem 0">
        
      `,
      actions: [
        ...(G.lehre ? [{
          label: G.arbeitGenutzt ? 'Arbeiten (bereits genutzt)' : 'Arbeiten',
          action: () => arbeiteImBeruf()
        }] : []),
        { label: 'Schließen', action: closeModal }
      ]
    },
    gesundheit: {
      title: '🌿 Gesundheit',
      body: () => `
        <strong>Zustand:</strong> ${healthLabel(G.health)} (${G.health}%)<br>
        <strong>Körperkraft:</strong> ${G.fitness}%<br>
        <strong>Alter:</strong> ${G.age} Jahre<br>
        <hr style="border-color:var(--border);margin:0.75rem 0">
        ${G.heilerGenutzt
          ? `<em style="color:var(--muted)">Du hast in diesem Jahr bereits einen Heiler aufgesucht.<br>Schreite ein Jahr voran, um ihn erneut besuchen zu können.</em>`
          : isKind()
            ? `Als Kind ist der Besuch beim Heiler kostenlos und stellt bis zu 20 Gesundheitspunkte wieder her.`
            : `Einen Heiler aufsuchen kostet 15 Pfennig und stellt bis zu 20 Gesundheitspunkte wieder her.`}
      `,
      actions: G.heilerGenutzt ? [
        { label: 'Schließen', action: closeModal }
      ] : [
        { label: isKind() ? 'Heiler aufsuchen (kostenlos)' : 'Heiler aufsuchen (15 💰)', action: () => {
          const healerCost = isKind() ? 0 : 15;
          if (G.gold < healerCost) { closeModal(); showModal('Heiler', 'Du hast nicht genug Gold.', [{ label: 'Ok', action: closeModal }]); return; }
          G.heilerGenutzt = true;
          G.gold -= healerCost;
          const gain = rnd(10,20);
          G.health = clamp(G.health+gain, 0, 100);
          const changes = healerCost > 0 ? { gold: -healerCost, health: gain } : { health: gain };
          addEventEntry(`Du hast einen Heiler aufgesucht und fühlst dich ${gain} Punkte besser.`, 'good', changes);
          writeSave(activeSlot, G); renderGame(); closeModal();
        }},
        { label: 'Schließen', action: closeModal }
      ]
    },
    vermoegen: {
      title: '🏺 Vermögen',
      body: () => `
        <strong>Gold:</strong> ${G.gold.toLocaleString('de-DE')} Pfennig<br>
        <strong>Beruf:</strong> ${esc(G.beruf)}<br>
        <strong>Steuerlast:</strong> ${G.origin === 'klerus' ? 'Keine' : 'Hoch'}<br>
        <hr style="border-color:var(--border);margin:0.75rem 0">
        <em style="color:var(--muted);font-size:0.8rem">Investitionen & Handel folgen in einer späteren Version.</em>
      `,
      actions: [{ label: 'Schließen', action: closeModal }]
    },
    aktivitaeten: {
      title: '🎯 Aktivitäten',
      body: () => G.aktivitaetGenutzt
        ? `<em style="color:var(--muted)">Du hast in diesem Jahr bereits eine Aktivität durchgeführt.<br>Schreite ein Jahr voran, um wieder zu handeln.</em>`
        : `Wähle eine Aktivität für dieses Jahr:${!canPracticeWriting() ? '<br><span style="color:var(--muted)">Schreiben lernen wird ab 4 Jahren verfügbar.</span>' : ''}`,
      actions: G.aktivitaetGenutzt ? [
        { label: 'Schließen', action: closeModal }
      ] : [
        { label: G.age <= 7 ? '🧸 Spielen (+Kraft, +Zufriedenheit)' : '⚔️ Waffenübung (+Kraft)', action: () => {
          G.aktivitaetGenutzt = true;
          const gain = G.age <= 7 ? 2 : 3;
          G.fitness = clamp(G.fitness+gain,0,100);
          if (G.age <= 7) {
            const gainL = rnd(5,20);
            G.luck = clamp(G.luck+gainL,0,100);
            addEventEntry('Du spielst ausgelassen und wirst dabei ein kleines bisschen stärker.', 'good', { fitness: gain, luck: gainL });
            writeSave(activeSlot, G); renderGame();
            showModal('🧸 Spielen', `Du tobst und spielst: <span style="color:var(--blue-l)">+${gain} Kraft</span> · <span style="color:var(--gold)">+${gainL} Zufriedenheit</span>.`, [{ label: 'Gut!', action: closeModal }]);
          } else {
            addEventEntry('Du übst fleißig mit Schwert und Schild.', 'good', { fitness: gain });
            writeSave(activeSlot, G); renderGame();
            showModal('⚔️ Waffenübung', `Du trainierst hart und gewinnst <span style="color:var(--blue-l)">+${gain} Kraft</span>.`, [{ label: 'Gut!', action: closeModal }]);
          }
        }},
        ...(canPracticeWriting() ? [{ label: '📜 Schreiben lernen (+Bildung)', action: () => {
          const schreibenKosten = isKind() ? 0 : 5;
          if (G.gold < schreibenKosten) { showModal('Bildung', 'Du brauchst 5 Pfennig für Tinte und Pergament.', [{label:'Ok',action:closeModal}]); return; }
          G.aktivitaetGenutzt = true;
          G.gold -= schreibenKosten;
          const gainB = rnd(3,5);
          G.bildung = clamp(G.bildung+gainB,0,100);
          const changes = schreibenKosten > 0 ? { gold: -schreibenKosten, bildung: gainB } : { bildung: gainB };
          addEventEntry('Du verbringst Stunden damit, das Schreiben zu üben.', 'good', changes);
          writeSave(activeSlot, G); renderGame();
          const kostenText = schreibenKosten > 0
            ? ` · <span style="color:var(--red-l)">−${schreibenKosten} 💰</span>`
            : ' · <span style="color:var(--green-l)">kostenlos (Kind)</span>';
          showModal('📜 Schreiben lernen', `Du lernst eifrig: <span style="color:var(--gold)">+${gainB} Bildung</span>${kostenText}`, [{ label: 'Gut!', action: closeModal }]);
        }}] : []),
        ...(!isKind() ? [{ label: '🍺 Im Wirtshaus feiern (+Zufriedenheit)', action: () => {
          G.aktivitaetGenutzt = true;
          const cost = rnd(2,8);
          const gainL = rnd(5,12);
          G.gold = Math.max(0, G.gold-cost); G.luck = clamp(G.luck+gainL,0,100);
          addEventEntry('Du feierst im Wirtshaus und triffst viele interessante Leute.', 'good', { gold: -cost, luck: gainL });
          writeSave(activeSlot, G); renderGame();
          showModal('🍺 Wirtshaus', `Ein fröhlicher Abend! <span style="color:var(--gold)">+${gainL} Zufriedenheit</span> · <span style="color:var(--red-l)">−${cost} 💰</span>`, [{ label: 'Prost!', action: closeModal }]);
        }}] : []),
        { label: 'Schließen', action: closeModal }
      ]
    },
    beziehungen: {
      title: '🤝 Beziehungen',
      body: () => `
        <strong>Bekannte:</strong> ${G.beziehungen.length || 'Niemand besonderes'}<br>
        <hr style="border-color:var(--border);margin:0.75rem 0">
        <em style="color:var(--muted);font-size:0.8rem">Freundschaften, Feindschaften & Heirat folgen in einer späteren Version.</em>
      `,
      actions: [{ label: 'Schließen', action: closeModal }]
    },
    bildung: {
      title: '📜 Bildung',
      body: () => `
        <strong>Bildungsstand:</strong> ${bildungLabel(G.bildung)} (${G.bildung}%)<br>
        <strong>Schule:</strong> ${schoolStatusLabel()}<br>
        <hr style="border-color:var(--border);margin:0.75rem 0">
        <em style="color:var(--muted);font-size:0.8rem">Schriftkundigkeit eröffnet neue Berufe und Optionen.</em>
      `,
      actions: [
        ...(canGoToSchool() ? [{ label: '🏫 Zur Schule gehen (+Bildung)', action: besucheSchule }] : []),
        { label: 'Schließen', action: closeModal }
      ]
    },
    chronik: {
      title: '📖 Chronik',
      body: () => {
        const entries = G.events.map(e => `<div style="margin-bottom:6px"><span style="color:var(--muted);font-size:0.75rem">Alter ${e.age}:</span> ${esc(e.text)}</div>`).join('');
        return `<div style="max-height:50vh;overflow-y:auto;font-size:0.82rem">${entries}</div>`;
      },
      actions: [{ label: 'Schließen', action: closeModal }]
    }
  };

  const m = menus[which];
  if (!m) return;
  showModal(m.title, m.body(), m.actions);
}

// ── MODAL ─────────────────────────────────────────────────
function showModal(title, body, actions = []) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  const act = document.getElementById('modal-actions');
  act.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'btn mt-1' + (a.danger ? ' btn-danger' : '');
    btn.textContent = a.label;
    btn.onclick = a.action;
    act.appendChild(btn);
  });
  document.getElementById('modal-overlay').classList.add('active');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

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


