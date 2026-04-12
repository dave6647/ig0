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
