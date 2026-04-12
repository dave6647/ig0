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
				<button class="btn btn-sm" onclick="importSave(${i});event.stopPropagation()">Import</button>
				<button class="btn btn-sm" onclick="exportSave(${i});event.stopPropagation()">Export</button>
				<button class="btn btn-sm btn-danger" onclick="confirmDelete(${i});event.stopPropagation()">✕</button>
			</div>`;
		div.onclick = () => loadGame(i);
		list.appendChild(div);
	}

	if (changed) saveAllSaves(all);

	const usedSlots = Object.keys(all).map(Number);
	const nextFreeSlot = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).find(i => !usedSlots.includes(i));

	if (nextFreeSlot !== undefined) {
		const btn = document.createElement('button');
		btn.className = 'btn btn-gold mt-2';
		btn.style.display = 'block';
		btn.textContent = '✦ Neues Leben beginnen';
		btn.onclick = () => openCreateScreen(nextFreeSlot);
		list.appendChild(btn);

		const importBtn = document.createElement('button');
		importBtn.className = 'btn mt-1';
		importBtn.style.display = 'block';
		importBtn.textContent = '⬆ Savegame importieren';
		importBtn.onclick = () => importSave(nextFreeSlot);
		list.appendChild(importBtn);
	} else {
		const p = document.createElement('p');
		p.className = 'text-muted text-center mt-2';
		p.style.fontSize = '0.8rem';
		p.textContent = 'Alle Spielstandsplätze sind belegt. Lösche einen Spielstand, um ein neues Leben zu beginnen.';
		list.appendChild(p);

		const importBtn = document.createElement('button');
		importBtn.className = 'btn mt-2';
		importBtn.style.display = 'block';
		importBtn.textContent = '⬆ Savegame importieren';
		importBtn.onclick = () => importSave();
		list.appendChild(importBtn);
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

function startNewGame() {
	const name = document.getElementById('create-name').value.trim();
	if (!name) { alert('Bitte gib deinem Charakter einen Namen.'); return; }
	const gender = document.getElementById('create-gender').value;
	G = newGame(activeSlot, name, gender, 'bauer', 1150, pendingStartFitness);
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
	document.getElementById('game-desc').textContent = `${G.stand} · Titel: ${G.titel}`;
	document.getElementById('game-age-display').textContent = `${G.age} Jahre`;
	document.getElementById('game-year-display').textContent = `${G.year} n. Chr.`;
	document.getElementById('game-gold').textContent = G.gold.toLocaleString('de-DE');
	document.getElementById('game-stand').textContent = `${G.stand} · ${G.titel}`;
	setBar('bar-health', G.health);
	setBar('bar-luck', G.luck);
	document.getElementById('value-health').textContent = statDisplayValue(G.health);
	document.getElementById('value-luck').textContent = statDisplayValue(G.luck);
	document.getElementById('info-familie').textContent = G.family.vater ? `Vater, Mutter, ${G.family.geschwister === 0 ? 'keine' : G.family.geschwister} Geschwister` : '—';
	document.getElementById('info-beruf').textContent = G.beruf || '—';
	document.getElementById('info-gesundheit').textContent = healthLabel(G.health);
	document.getElementById('info-vermoegen').textContent = G.gold + ' Pfennig';
	document.getElementById('info-stadt').textContent = canGoToSchool() ? 'Schule möglich' : '';
	document.getElementById('info-charakter').textContent = `Titel: ${G.titel}`;
	document.getElementById('btn-age-up').disabled = G.dead;
	document.getElementById('btn-age-up').textContent = G.dead ? '† Gestorben' : '⏳ Jahr voranschreiten';
	renderStatusEffects();
	renderSchoolNotice();
	renderLog();
}

function renderStatusEffects() {
	const row = document.getElementById('status-effects');
	if (!row || !G) return;

	const statuses = [];
	if (G.krank) statuses.push({ icon: '🤒', text: 'Krank', kind: 'bad' });
	if (G.pendingBehandlung) statuses.push({ icon: '🩹', text: 'Behandlung aktiv', kind: 'good' });
	if (G.pendingKrankheitHeilung) statuses.push({ icon: '💊', text: 'Krankheitsheilung aktiv', kind: 'good' });

	if (!statuses.length) {
		row.style.display = 'none';
		row.innerHTML = '';
		return;
	}

	row.style.display = 'flex';
	row.innerHTML = statuses
		.map(s => `<span class="status-chip ${s.kind}" title="${escAttr(s.text)}">${s.icon} ${esc(s.text)}</span>`)
		.join('');
}

function renderSchoolNotice() {
	const notice = document.getElementById('school-notice');
	if (!notice || !G) return;

	if (canGoToSchool()) {
		notice.style.display = 'block';
		notice.textContent = 'Schulbesuch ist in diesem Jahr möglich. Du findest ihn unter Stadt und dann Schule.';
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
		geschick: 'Geschick'
	};
	const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung', 'geschick'];
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
		geschick: 'Geschick'
	};
	const keys = ['gold', 'health', 'fitness', 'luck', 'looks', 'bildung', 'geschick'];
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

// ── MENU ACTIONS ─────────────────────────────────────────
function openMenu(which) {
	if (which === 'chronik') {
		openChronikScreen();
		return;
	}
	const menus = {
		charakter: {
			title: '🧾 Charakter',
			body: () => `
				<strong>Titel:</strong> ${G.titel}<br>
				${G.pendingTitelAufstieg ? `<strong>Titelaufstieg:</strong> Zu ${G.pendingTitelAufstieg.nach} ab Jahr ${G.pendingTitelAufstieg.aktivAbJahr}<br>` : ''}
				<strong>Gesundheit:</strong> ${healthLabel(G.health)} (${statDisplayValue(G.health)})<br>
				<strong>Krankheit:</strong> ${G.krank ? 'Erkrankt' : 'Keine bekannte Krankheit'}<br>
				<strong>Zufriedenheit:</strong> ${statDisplayValue(G.luck)}<br>
				<strong>Verheiratet:</strong> Nein (Platzhalter)<br>
				<strong>Ansehen:</strong> ${statDisplayValue(G.looks)}<br>
				<strong>Kraft:</strong> ${statDisplayValue(G.fitness)}<br>
				<strong>Bildung:</strong> ${bildungLabel(G.bildung)} (${statDisplayValue(G.bildung)})<br>
				<strong>Geschick:</strong> ${statDisplayValue(G.geschick)}<br>
				<strong>Inventar:</strong> ${G.inventar.length}/${inventarKapazitaet()} Plaetze belegt<br>
				${G.aktiveEffekte?.bierJahre > 0 ? `<strong>Bier-Effekt:</strong> Noch ${G.aktiveEffekte.bierJahre} Jahre aktiv<br>` : ''}
				<hr style="border-color:var(--border);margin:0.75rem 0">
				<strong>Inventarinhalt:</strong><br>
				${renderInventarListe()}
				<hr style="border-color:var(--border);margin:0.75rem 0">
				<em style="color:var(--muted);font-size:0.8rem">Weitere Charakterwerte und Beziehungen koennen hier spaeter erweitert werden.</em>
			`,
			actions: [
				{ label: 'Inventar öffnen', action: openInventarMenu },
				{ label: 'Schließen', action: closeModal }
			]
		},
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
				<strong>Titel:</strong> ${G.meister ? 'Meister' : (isGeselle() ? 'Geselle' : 'Kein Titel')}<br>
				<strong>Betrieb:</strong> ${G.betrieb ? `Ja (${G.mitarbeiter}/2 Mitarbeiter)` : 'Nein'}<br>
				<strong>Betriebs-Ertrag/Jahr:</strong> ${G.betrieb ? (G.mitarbeiter * 150) : 0} Pfennig<br>
				<strong>Arbeit in diesem Jahr:</strong> ${G.lehre ? (G.arbeitGenutzt ? 'Bereits erledigt' : 'Noch offen') : 'Nicht verfügbar'}<br>
				<hr style="border-color:var(--border);margin:0.75rem 0">
			`,
			actions: [
				...(G.lehre ? [{ label: G.arbeitGenutzt ? 'Arbeiten (bereits genutzt)' : 'Arbeiten', action: () => arbeiteImBeruf() }] : []),
				...(G.meister ? [{ label: 'Betriebe', action: openBetriebeMenu }] : []),
				{ label: 'Schließen', action: closeModal }
			]
		},
		gesundheit: {
			title: '🌿 Gesundheit',
			body: () => `
				<strong>Zustand:</strong> ${healthLabel(G.health)} (${G.health}%)<br>
				<strong>Krankheit:</strong> ${G.krank ? 'Erkrankt (−5/Jahr)' : 'Keine bekannte Krankheit'}<br>
				<strong>Behandlung:</strong> ${behandlungStatusLabel()}<br>
				${krankheitHeilungStatusLabel() ? `<strong>Krankheitsheilung:</strong> ${krankheitHeilungStatusLabel()}<br>` : ''}
				<strong>Alter:</strong> ${G.age} Jahre<br>
				<hr style="border-color:var(--border);margin:0.75rem 0">
				${(G.heilerGenutzt || G.krankheitHeilungGenutzt)
					? `<em style="color:var(--muted)">${[
						G.heilerGenutzt ? 'Normale Heilung in diesem Jahr bereits genutzt.' : '',
						G.krankheitHeilungGenutzt ? 'Krankheitsheilung in diesem Jahr bereits genutzt.' : ''
					].filter(Boolean).join('<br>')}</em>`
					: ''}
			`,
			actions: (() => {
				const acts = [];
				acts.push({ label: isKind() ? 'Kloster' : 'Kloster (50 💰)', action: () => openHeilerMenu('kloster') });
				if (!isKind()) acts.push({ label: 'Wundheiler (25 💰)', action: () => openHeilerMenu('wundheiler') });
				acts.push({ label: 'Schließen', action: closeModal });
				return acts;
			})()
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
				{ label: G.age <= 7 ? '🧸 Spielen (+Kraft, +Zufriedenheit, +Geschick)' : '⚔️ Waffenübung (+Kraft, +Geschick)', action: () => {
					G.aktivitaetGenutzt = true;
					const gain = G.age <= 7 ? 2 : 3;
					const gainGeschick = G.age <= 7 ? 1 : 2;
					G.fitness = clamp(G.fitness + gain, 0, 100);
					G.geschick = clamp(G.geschick + gainGeschick, 0, 100);
					if (G.age <= 7) {
						const gainL = rnd(5, 20);
						G.luck = clamp(G.luck + gainL, 0, 100);
						addEventEntry('Du spielst ausgelassen und wirst dabei ein kleines bisschen stärker und geschickter.', 'good', { fitness: gain, geschick: gainGeschick, luck: gainL });
						writeSave(activeSlot, G); renderGame();
						showModal('🧸 Spielen', `Du tobst und spielst: <span style="color:var(--blue-l)">+${gain} Kraft</span> · <span style="color:var(--gold)">+${gainL} Zufriedenheit</span> · <span style="color:var(--gold-l)">+${gainGeschick} Geschick</span>.`, [{ label: 'Gut!', action: closeModal }]);
					} else {
						addEventEntry('Du übst fleißig mit Schwert und Schild und verbesserst dein Geschick.', 'good', { fitness: gain, geschick: gainGeschick });
						writeSave(activeSlot, G); renderGame();
						showModal('⚔️ Waffenübung', `Du trainierst hart und gewinnst <span style="color:var(--blue-l)">+${gain} Kraft</span> sowie <span style="color:var(--gold-l)">+${gainGeschick} Geschick</span>.`, [{ label: 'Gut!', action: closeModal }]);
					}
				}},
				...(canPracticeWriting() ? [{ label: '📜 Schreiben lernen (+Bildung)', action: () => {
					const schreibenKosten = isKind() ? 0 : 5;
					if (G.gold < schreibenKosten) { showModal('Bildung', 'Du brauchst 5 Pfennig für Tinte und Pergament.', [{ label: 'Ok', action: closeModal }]); return; }
					G.aktivitaetGenutzt = true;
					G.gold -= schreibenKosten;
					const gainB = rnd(3, 5);
					G.bildung = clamp(G.bildung + gainB, 0, 100);
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
					const cost = rnd(2, 8);
					const gainL = rnd(5, 12);
					G.gold = Math.max(0, G.gold - cost); G.luck = clamp(G.luck + gainL, 0, 100);
					addEventEntry('Du feierst im Wirtshaus und triffst viele interessante Leute.', 'good', { gold: -cost, luck: gainL });
					writeSave(activeSlot, G); renderGame();
					showModal('🍺 Wirtshaus', `Ein fröhlicher Abend! <span style="color:var(--gold)">+${gainL} Zufriedenheit</span> · <span style="color:var(--red-l)">−${cost} 💰</span>`, [{ label: 'Prost!', action: closeModal }]);
				}}] : []),
				{ label: 'Schließen', action: closeModal }
			]
		},
		stadt: {
			title: '🏘️ Stadt',
			body: () => `
				<strong>Ort:</strong> Deine Stadtgemeinde<br>
				<strong>Verwaltung:</strong> Rathaus verfügbar<br>
				<strong>Titel:</strong> ${G.titel}<br>
				<strong>Markt:</strong> Waren und Ausruestung verfuegbar<br>
				<strong>Schule:</strong> ${schoolStatusLabel()}<br>
				<hr style="border-color:var(--border);margin:0.75rem 0">
				<em style="color:var(--muted);font-size:0.8rem">Im Rathaus kannst du Titel kaufen und als Geselle die Meisterpruefung erwerben. Auf dem Markt kaufst du Waren fuer dein Inventar.</em>
			`,
			actions: [
				{ label: '🏪 Markt', action: openMarktMenu },
				{ label: '🏫 Schule', action: openSchuleMenu },
				{ label: '🏛️ Rathaus', action: openRathausMenu },
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

function openSchuleMenu() {
	showModal('🏫 Schule', `
		<strong>Status:</strong> ${schoolStatusLabel()}<br>
		<strong>Bildung:</strong> ${bildungLabel(G.bildung)} (${statDisplayValue(G.bildung)})<br>
		<strong>Alter:</strong> ${G.age} Jahre<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<em style="color:var(--muted);font-size:0.8rem">Kinder zwischen 6 und 11 Jahren koennen die Schule einmal pro Jahr besuchen.</em>
	`, [
		...(canGoToSchool() ? [{ label: 'Schule besuchen', action: besucheSchule }] : []),
		{ label: 'Zurück', action: () => openMenu('stadt') },
		{ label: 'Schließen', action: closeModal }
	]);
}

function renderInventarListe() {
	if (!G || !Array.isArray(G.inventar) || !G.inventar.length) {
		return '<span style="color:var(--muted)">Dein Inventar ist leer.</span>';
	}

	return G.inventar.map((itemId, index) => {
		const item = marktItem(itemId);
		const name = item ? item.name : itemId;
		const beschreibung = item ? item.beschreibung : 'Unbekannter Gegenstand';
		const useButton = itemId === 'schwert'
			? '<span style="color:var(--muted);font-size:0.78rem">Noch nicht nutzbar</span>'
			: `<button class="btn btn-sm" style="margin-top:0.35rem" onclick="nutzeInventarItem(${index})">Benutzen</button>`;
		return `<div style="margin-top:0.45rem;padding:0.5rem 0;border-bottom:1px solid var(--border)"><strong>${esc(name)}</strong><br><span style="color:var(--muted);font-size:0.8rem">${esc(beschreibung)}</span><br>${useButton}</div>`;
	}).join('');
}

function openInventarMenu() {
	showModal('🎒 Inventar', `
		<strong>Plaetze:</strong> ${G.inventar.length}/${inventarKapazitaet()}<br>
		${G.aktiveEffekte?.bierJahre > 0 ? `<strong>Bier-Effekt:</strong> Noch ${G.aktiveEffekte.bierJahre} Jahre aktiv<br>` : ''}
		<hr style="border-color:var(--border);margin:0.75rem 0">
		${renderInventarListe()}
	`, [
		{ label: 'Zurück zum Charakter', action: () => openMenu('charakter') },
		{ label: 'Schließen', action: closeModal }
	]);
}

function openMarktMenu() {
	const items = Object.values(marktItemKatalog()).map(item => {
		const disabled = G.gold < item.preis || inventarIstVoll();
		const hinweis = inventarIstVoll()
			? 'Inventar voll'
			: (G.gold < item.preis ? 'Zu wenig Gold' : 'Kauf moeglich');
		return `<div style="padding:0.55rem 0;border-bottom:1px solid var(--border)"><strong>${esc(item.name)}</strong> · ${item.preis} Pfennig<br><span style="color:var(--muted);font-size:0.8rem">${esc(item.beschreibung)}</span><br><button class="btn btn-sm" style="margin-top:0.35rem" onclick="kaufeMarktItem('${item.id}')" ${disabled ? 'disabled' : ''}>Kaufen</button> <span style="color:var(--muted);font-size:0.78rem">${hinweis}</span></div>`;
	}).join('');

	showModal('🏪 Markt', `
		<strong>Gold:</strong> ${G.gold.toLocaleString('de-DE')} Pfennig<br>
		<strong>Inventar:</strong> ${G.inventar.length}/${inventarKapazitaet()} Plaetze belegt<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<div style="max-height:42vh;overflow-y:auto;padding-right:0.25rem">${items}</div>
	`, [
		{ label: 'Zurück zur Stadt', action: () => openMenu('stadt') },
		{ label: 'Schließen', action: closeModal }
	]);
}

function openHeilerMenu(typ) {
	const istKloster = typ === 'kloster';
	const name = istKloster ? 'Kloster' : 'Wundheiler';
	const kosten = istKloster ? (isKind() ? 'kostenlos' : '50 💰') : '25 💰';
	const actions = [];

	if (!G.heilerGenutzt) {
		actions.push({
			label: `Behandlung (${kosten})`,
			action: () => kaufeBehandlung(typ)
		});
		} else {
		actions.push({
			label: 'Behandlung (bereits genutzt)',
			action: () => showModal('Heilung', 'Du hast die normale Heilung in diesem Jahr bereits genutzt.', [
				{ label: 'Zurück', action: () => openHeilerMenu(typ) }
			])
		});
	}

	if (G.krank) {
		if (!G.krankheitHeilungGenutzt) {
			actions.push({
				label: `Krankheit heilen (${kosten})`,
				action: () => heilungKrankheit(typ)
			});
		} else {
			actions.push({
				label: 'Krankheit heilen (bereits genutzt)',
				action: () => showModal('Heilung', 'Du hast die Krankheitsheilung in diesem Jahr bereits genutzt.', [
					{ label: 'Zurück', action: () => openHeilerMenu(typ) }
				])
			});
		}
	}

	actions.push({ label: 'Zurück', action: () => openMenu('gesundheit') });

	showModal(`${istKloster ? '⛪' : '🩹'} ${name}`, `
		<strong>Heiler:</strong> ${name}<br>
		<strong>Normale Heilung:</strong> Fehlschlag ${istKloster ? '20%' : '35%'}<br>
		<strong>Krankheitsheilung:</strong> Fehlschlag ${istKloster ? '20%' : '35%'}<br>
		<strong>Kosten:</strong> ${kosten}<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<em style="color:var(--muted)">Wähle, ob du deine Gesundheit stärken oder gezielt eine Krankheit behandeln willst.</em>
	`, actions);
}

function openRathausMenu() {
	const naechsterAufstieg = naechsterTitelAufstieg();
	const titelStatus = G.pendingTitelAufstieg
		? `Beantragt: ${G.pendingTitelAufstieg.nach} (gültig ab Jahr ${G.pendingTitelAufstieg.aktivAbJahr})`
		: naechsterAufstieg
			? `Nächster Aufstieg: ${naechsterAufstieg.von} zu ${naechsterAufstieg.nach} für ${naechsterAufstieg.kosten} Pfennig`
			: 'Du hast bereits den höchsten Titel erreicht.';

	const kannMeisterKaufen = isGeselle() && !G.meister;
	const statusText = G.meister
		? 'Du bist bereits Meister und darfst Betriebe aufbauen.'
		: isGeselle()
			? 'Als Geselle kannst du hier die Meisterprüfung für 1000 Pfennig ablegen.'
			: 'Die Meisterprüfung ist erst nach Abschluss der Lehre verfügbar.';

	showModal('🏛️ Rathaus', `
		<strong>Adelstitel:</strong> ${G.titel}<br>
		<strong>Titelstatus:</strong> ${titelStatus}<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<strong>Meisterprüfung:</strong> 1000 Pfennig<br>
		<strong>Status:</strong> ${statusText}<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<em style="color:var(--muted);font-size:0.8rem">Titelaufstiege werden erst im folgenden Jahr gültig. Mit Meistertitel kannst du im Berufsbereich Betriebe aufbauen und jährlich passives Einkommen erhalten.</em>
	`, [
		...(!G.pendingTitelAufstieg && naechsterAufstieg ? [{ label: `Titelaufstieg kaufen (${naechsterAufstieg.kosten} 💰)`, action: kaufeTitelAufstieg }] : []),
		...(kannMeisterKaufen ? [{ label: 'Meistertitel erwerben (1000 💰)', action: kaufeMeistertitel }] : []),
		{ label: 'Zurück', action: () => openMenu('stadt') },
		{ label: 'Schließen', action: closeModal }
	]);
}

function openBetriebeMenu() {
	if (!G || !G.meister) {
		showModal('⚒️ Betriebe', 'Du brauchst zuerst den Meistertitel aus dem Rathaus.', [{ label: 'Ok', action: closeModal }]);
		return;
	}

	const hatBetrieb = !!G.betrieb;
	const ertrag = hatBetrieb ? G.mitarbeiter * 150 : 0;
	const kannMitarbeiterEinstellen = hatBetrieb && G.mitarbeiter < 2;

	showModal('⚒️ Betriebe', `
		<strong>Betrieb vorhanden:</strong> ${hatBetrieb ? 'Ja' : 'Nein'}<br>
		<strong>Mitarbeiter:</strong> ${hatBetrieb ? `${G.mitarbeiter}/2` : '0/2'}<br>
		<strong>Jährlicher Ertrag:</strong> ${ertrag} Pfennig<br>
		<hr style="border-color:var(--border);margin:0.75rem 0">
		<em style="color:var(--muted);font-size:0.8rem">Betrieb erwerben: 800 Pfennig. Neuer Mitarbeiter: 300 Pfennig. Pro Mitarbeiter erhältst du 150 Pfennig automatisch pro Jahr.</em>
	`, [
		...(!hatBetrieb ? [{ label: 'Betrieb erwerben (800 💰)', action: erwerbeBetrieb }] : []),
		...(kannMitarbeiterEinstellen ? [{ label: 'Mitarbeiter einstellen (300 💰)', action: stelleMitarbeiterEin }] : []),
		{ label: 'Zurück', action: () => openMenu('beruf') },
		{ label: 'Schließen', action: closeModal }
	]);
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

document.getElementById('create-name').addEventListener('input', updateCharPreview);
document.getElementById('create-gender').addEventListener('change', updateCharPreview);
