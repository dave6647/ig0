// ── SAVE/STORAGE MANAGEMENT ─────────────────────────────
const SAVE_KEY = 'mittelalter_leben_saves';
const MAX_SLOTS = 10;

function loadAllSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch (e) { return {}; }
}

function saveAllSaves(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function getSave(slot) {
  return loadAllSaves()[slot] || null;
}

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

function migrateLegacySave(save) {
  if (!save || typeof save !== 'object') return save;

  const defaults = defaultStats(save.origin || 'bauer');

  if (save.origin === 'adel') save.origin = 'bauer';
  if (save.stand === 'Junker' || save.stand === 'Patrizier') save.stand = 'Kind';
  if (save.beruf === 'Müßiggang' || save.beruf === 'Gebet' || save.beruf === 'Feldarbeit' || save.beruf === 'Warenhandel') {
    save.beruf = 'Keine Lehre';
  }

  if (!('lehre' in save)) save.lehre = null;
  if (!('lehreJahr' in save)) save.lehreJahr = null;
  if (!('meister' in save)) save.meister = false;
  if (!('betrieb' in save)) save.betrieb = false;
  if (!('mitarbeiter' in save)) save.mitarbeiter = 0;
  if (!('titel' in save) || !['Unfreier', 'Bürger', 'Patrizier', 'Baron', 'Landsherr'].includes(save.titel)) save.titel = 'Bürger';
  if (!('pendingTitelAufstieg' in save)) save.pendingTitelAufstieg = null;
  if (!save.family || typeof save.family !== 'object') save.family = {};
  if (!save.family.vater) save.family.vater = randomName('m');
  if (!save.family.mutter) save.family.mutter = randomName('f');
  const startTitelGueltig = ['Unfreier', 'Bürger', 'Patrizier'];
  const familienTitel = startTitelGueltig.includes(save.family.vaterTitel)
    ? save.family.vaterTitel
    : (startTitelGueltig.includes(save.titel) ? save.titel : 'Bürger');
  save.family.vaterTitel = familienTitel;
  save.titel = familienTitel;
  if (!Number.isInteger(save.family.geschwister) || save.family.geschwister < 0) save.family.geschwister = rnd(0, 3);
  if (!Array.isArray(save.family.geschwisterNamen)) {
    save.family.geschwisterNamen = [];
    for (let i = 0; i < save.family.geschwister; i++) {
      save.family.geschwisterNamen.push(randomName(rnd(0, 1) === 0 ? 'm' : 'f'));
    }
  }
  if (!Array.isArray(save.family.mitglieder)) {
    save.family.mitglieder = [];
  }
  if (save.family.mitglieder.length === 0) {
    save.family.mitglieder.push({
      id: 'f_vater', gruppe: 'familie', rolle: 'Vater', name: save.family.vater, gender: 'm', titel: familienTitel, beziehung: rnd(40, 60), status: 'familie'
    });
    save.family.mitglieder.push({
      id: 'f_mutter', gruppe: 'familie', rolle: 'Mutter', name: save.family.mutter, gender: 'f', titel: familienTitel, beziehung: rnd(40, 60), status: 'familie'
    });
    for (let i = 0; i < save.family.geschwisterNamen.length; i++) {
      const name = save.family.geschwisterNamen[i];
      save.family.mitglieder.push({
        id: `f_geschwister_${i + 1}`,
        gruppe: 'familie',
        rolle: 'Geschwister',
        name,
        gender: rnd(0, 1) === 0 ? 'm' : 'f',
        titel: familienTitel,
        beziehung: rnd(40, 60),
        status: 'familie'
      });
    }
  }
  save.family.mitglieder = save.family.mitglieder
    .filter(p => p && typeof p === 'object')
    .map((p, idx) => {
      const rolle = ['Vater', 'Mutter', 'Geschwister'].includes(p.rolle) ? p.rolle : 'Geschwister';
      const alter = Number.isInteger(p.alter) && p.alter > 0 ? p.alter
        : rolle === 'Vater' ? rnd(25, 40)
        : rolle === 'Mutter' ? rnd(22, 38)
        : rnd(1, 10);
      const maxAlter = Number.isInteger(p.maxAlter) && p.maxAlter >= alter
        ? p.maxAlter
        : alter + rnd(0, Math.max(0, 80 - alter));
      return {
        id: String(p.id || `f_mitglied_${idx + 1}`),
        gruppe: 'familie',
        rolle,
        name: String(p.name || randomName(p.gender === 'f' ? 'f' : 'm')),
        gender: p.gender === 'f' ? 'f' : 'm',
        alter,
        maxAlter,
        titel: familienTitel,
        beziehung: clamp(typeof p.beziehung === 'number' ? p.beziehung : 0, -100, 100),
        status: p.status === 'verstorben' ? 'verstorben' : 'familie'
      };
    });
  if (!('ehepartner' in save.family)) save.family.ehepartner = null;
  if (!('kinder' in save.family)) save.family.kinder = 0;

  if (!save.beziehungen || typeof save.beziehungen !== 'object') {
    save.beziehungen = generateBeziehungenPool(BEZIEHUNGS_CONFIG.einwohnerGesamt, save.gender);
  }
  if (!Array.isArray(save.beziehungen.personen) || save.beziehungen.personen.length === 0) {
    save.beziehungen = generateBeziehungenPool(BEZIEHUNGS_CONFIG.einwohnerGesamt, save.gender);
  }
  if (!save.beziehungen.config || typeof save.beziehungen.config !== 'object') {
    save.beziehungen.config = {
      einwohnerGesamt: save.beziehungen.personen.length,
      basisEinwohnerGesamt: BEZIEHUNGS_CONFIG.einwohnerGesamt,
      startKinderGesamt: 0,
      titelAnteile: { unfreier: 0.15, buerger: 0.50, patrizier: 0.20, baron: 0.15 }
    };
  }
  if (typeof save.beziehungen.config.interaktionenProJahr !== 'number') {
    save.beziehungen.config.interaktionenProJahr = 5;
  }
  if (typeof save.beziehungen.config.basisEinwohnerGesamt !== 'number') {
    save.beziehungen.config.basisEinwohnerGesamt = Math.max(0, save.beziehungen.personen.length - (save.beziehungen.config.startKinderGesamt || 0));
  }
  if (typeof save.beziehungen.config.startKinderGesamt !== 'number') {
    save.beziehungen.config.startKinderGesamt = 0;
  }
  save.beziehungen.config.einwohnerGesamt = save.beziehungen.personen.length;

  const sollHeiratsKandidaten = save.beziehungen.config.startKinderGesamt > 0;
  const spielerAlter = Number.isInteger(save.age) && save.age >= 0 ? save.age : 0;
  const kandidatinnenOhneMarker = sollHeiratsKandidaten
    ? save.beziehungen.personen.filter(p => p.gender !== save.gender && Number.isInteger(p.alter) && p.alter >= spielerAlter && p.alter <= spielerAlter + 3)
    : [];
  const hatKandidatenMarker = save.beziehungen.personen.some(p => p.heiratsKandidat === true);
  const heuristischeKandidatenIds = !hatKandidatenMarker && sollHeiratsKandidaten
    ? new Set(kandidatinnenOhneMarker.slice(0, save.beziehungen.config.startKinderGesamt).map(p => String(p.id)))
    : null;

  save.beziehungen.personen = save.beziehungen.personen
    .filter(p => p && typeof p === 'object')
    .map((p, idx) => {
      const alter = Number.isInteger(p.alter) && p.alter >= 0 ? p.alter : rnd(16, 55);
      const maxAlter = Number.isInteger(p.maxAlter) && p.maxAlter >= alter
        ? p.maxAlter
        : alter + rnd(0, Math.max(0, 80 - alter));
      return {
        id: String(p.id || `p${idx + 1}`),
        gruppe: 'stadt',
        name: String(p.name || randomName(p.gender === 'f' ? 'f' : 'm')),
        gender: p.gender === 'f' ? 'f' : 'm',
        alter,
        maxAlter,
        titel: ['Unfreier', 'Bürger', 'Patrizier', 'Baron'].includes(p.titel) ? p.titel : 'Bürger',
        beziehung: clamp(typeof p.beziehung === 'number' ? p.beziehung : 0, -100, 100),
        heiratsKandidat: p.heiratsKandidat === true || Boolean(heuristischeKandidatenIds && heuristischeKandidatenIds.has(String(p.id))),
        status: p.status === 'ehepartner' ? 'ehepartner' : 'single'
      };
    });

  if (!Array.isArray(save.inventar)) save.inventar = [];
  if (!save.aktiveEffekte || typeof save.aktiveEffekte !== 'object') save.aktiveEffekte = { bierJahre: 0 };
  if (typeof save.aktiveEffekte.bierJahre !== 'number') save.aktiveEffekte.bierJahre = 0;
  if (!('krank' in save)) save.krank = false;
  if (!('pendingBehandlung' in save)) save.pendingBehandlung = null;
  if (save.betrieb && (!Number.isInteger(save.mitarbeiter) || save.mitarbeiter < 1)) save.mitarbeiter = 1;
  if (save.mitarbeiter > 2) save.mitarbeiter = 2;
  if (save.pendingBehandlung && !['kloster', 'wundheiler'].includes(save.pendingBehandlung.typ)) save.pendingBehandlung = null;
  if (save.lehre && typeof save.lehreJahr !== 'number') save.lehreJahr = save.year;
  if (!('schuleGenutzt' in save)) save.schuleGenutzt = false;
  if (!('beziehungsInteraktionenGenutzt' in save) || typeof save.beziehungsInteraktionenGenutzt !== 'number') save.beziehungsInteraktionenGenutzt = 0;
  if (!('aktivitaetGenutzt' in save)) save.aktivitaetGenutzt = false;
  if (!('arbeitGenutzt' in save)) save.arbeitGenutzt = false;
  if (!('heilerGenutzt' in save)) save.heilerGenutzt = false;
  if (!('krankheitHeilungGenutzt' in save)) save.krankheitHeilungGenutzt = false;
  if (!('pendingKrankheitHeilung' in save)) save.pendingKrankheitHeilung = null;
  if (save.pendingKrankheitHeilung && !['kloster', 'wundheiler'].includes(save.pendingKrankheitHeilung.typ)) save.pendingKrankheitHeilung = null;
  if (save.pendingTitelAufstieg) {
    const p = save.pendingTitelAufstieg;
    const titelGueltig = ['Unfreier', 'Bürger', 'Patrizier', 'Baron', 'Landsherr'];
    if (!titelGueltig.includes(p.von) || !titelGueltig.includes(p.nach) || typeof p.aktivAbJahr !== 'number') {
      save.pendingTitelAufstieg = null;
    }
  }

  if (!save.rathaus || typeof save.rathaus !== 'object') save.rathaus = {};
  if (!save.rathaus.aemter || typeof save.rathaus.aemter !== 'object') save.rathaus.aemter = {};
  RATHAUS_AEMTER.forEach(def => {
    const eintrag = save.rathaus.aemter[def.id];
    if (!eintrag || typeof eintrag !== 'object') {
      save.rathaus.aemter[def.id] = {
        amtId: def.id,
        inhaberTyp: null,
        inhaberName: null,
        personId: null,
        startJahr: null,
        endJahr: null,
        bewerbungsFensterJahre: 2,
        spielerBeworben: false,
        bewerbungAnkuendigungFuerEndJahr: null
      };
      return;
    }
    if (!('amtId' in eintrag)) eintrag.amtId = def.id;
    if (!['spieler', 'npc', null].includes(eintrag.inhaberTyp)) eintrag.inhaberTyp = null;
    if (typeof eintrag.inhaberName !== 'string') eintrag.inhaberName = null;
    if (typeof eintrag.personId !== 'string') eintrag.personId = null;
    if (!Number.isInteger(eintrag.startJahr)) eintrag.startJahr = null;
    if (!Number.isInteger(eintrag.endJahr)) eintrag.endJahr = null;
    if (!Number.isInteger(eintrag.bewerbungsFensterJahre) || eintrag.bewerbungsFensterJahre < 1) eintrag.bewerbungsFensterJahre = 2;
    if (typeof eintrag.spielerBeworben !== 'boolean') eintrag.spielerBeworben = false;
    if (!Number.isInteger(eintrag.bewerbungAnkuendigungFuerEndJahr)) eintrag.bewerbungAnkuendigungFuerEndJahr = null;
  });

  if (typeof save.maxAge !== 'number') save.maxAge = 80 + rnd(0, 15);
  if (typeof save.health !== 'number') save.health = defaults.health;
  if (typeof save.luck !== 'number') save.luck = defaults.luck;
  if (typeof save.fitness !== 'number') save.fitness = defaults.fitness;
  if (typeof save.looks !== 'number') save.looks = defaults.looks;
  if (typeof save.geschick !== 'number') save.geschick = defaults.geschick;
  if (typeof save.bildung !== 'number') save.bildung = 0;
  if (!save.stand) save.stand = save.lehre ? standFromLehre(save.lehre) : 'Kind';
  if (!save.beruf) save.beruf = save.lehre ? berufFromLehre(save.lehre) : 'Keine Lehre';

  return save;
}

function exportSave(slot) {
  const save = getSave(slot);
  if (!save) {
    showModal('Export', 'Dieser Spielstand ist leer und kann nicht exportiert werden.', [{ label: 'Ok', action: closeModal }]);
    return;
  }

  const normalizedSave = migrateLegacySave(save);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    slot,
    save: normalizedSave
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const safeName = String(normalizedSave.name || 'spielstand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'spielstand';
  const fileName = `mittelalter-leben-${safeName}-slot-${slot}-${normalizedSave.year}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);

  showModal('Export', `Spielstand exportiert als <strong>${esc(fileName)}</strong>.`, [{ label: 'Ok', action: closeModal }]);
}

function importSave(preferredSlot = null) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) {
      input.remove();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      input.remove();
      try {
        const raw = String(reader.result || '');
        const parsed = JSON.parse(raw);
        const importedSave = parsed && typeof parsed === 'object' && parsed.save ? parsed.save : parsed;
        if (!importedSave || typeof importedSave !== 'object') throw new Error('Ungültige Datei.');

        const normalizedSave = migrateLegacySave(importedSave);
        if (!normalizedSave.name || typeof normalizedSave.year === 'undefined') {
          throw new Error('Die Datei enthält keinen gültigen Spielstand.');
        }

        const all = loadAllSaves();
        const suggestedFromFile = Number.isInteger(parsed?.slot) ? parsed.slot : null;
        const firstFreeSlot = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).find(i => !all[i]);

        let targetSlot = Number.isInteger(preferredSlot) ? preferredSlot : null;
        if (!targetSlot) {
          if (suggestedFromFile && suggestedFromFile >= 1 && suggestedFromFile <= MAX_SLOTS && !all[suggestedFromFile]) {
            targetSlot = suggestedFromFile;
          } else {
            targetSlot = firstFreeSlot || (suggestedFromFile >= 1 && suggestedFromFile <= MAX_SLOTS ? suggestedFromFile : null);
          }
        }

        if (!targetSlot || targetSlot < 1 || targetSlot > MAX_SLOTS) {
          showModal('Import', 'Kein gültiger Zielslot verfügbar. Bitte wähle einen Slot über dessen Import-Button.', [{ label: 'Ok', action: closeModal }]);
          return;
        }

        const finishImport = () => {
          writeSave(targetSlot, normalizedSave);
          closeModal();
          renderSlots();
          showModal('Import erfolgreich', `Spielstand wurde in Slot <strong>${targetSlot}</strong> importiert.`, [{ label: 'Ok', action: closeModal }]);
        };

        if (all[targetSlot]) {
          showModal('Import bestätigen', `Slot <strong>${targetSlot}</strong> ist bereits belegt. Überschreiben?`, [
            { label: 'Überschreiben', danger: true, action: finishImport },
            { label: 'Abbrechen', action: closeModal }
          ]);
          return;
        }

        finishImport();
      } catch (e) {
        showModal('Import', `Import fehlgeschlagen: ${esc(e && e.message ? e.message : 'Unbekannter Fehler')}`, [{ label: 'Ok', action: closeModal }]);
      }
    };

    reader.onerror = () => {
      input.remove();
      showModal('Import', 'Die Datei konnte nicht gelesen werden.', [{ label: 'Ok', action: closeModal }]);
    };

    reader.readAsText(file, 'utf-8');
  });

  input.click();
}
