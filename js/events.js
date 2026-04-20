// ── EVENT SYSTEM ─────────────────────────────────────────
// Aktive Events nach Altersgruppen, jeweils mit positiven/negativen Ereignissen.
// Krankheit wird separat über rollKrankheit() gewürfelt.

const EVENT_GROUPS = {
  // Ereignisse für Kinder (0-11 Jahre)
  kinder: [
    // POSITIVE EREIGNISSE
    { text: 'Du findest einen schönen Stein und spielst stundenlang damit.', type: 'good', effects: { luck: +rnd(2,5) } },
    { text: 'Die Dorfjugend spielt Fangspiele. Du machst mit und hast einen wunderschönen Tag.', type: 'good', effects: { luck: +rnd(4,8) } },
    { text: 'Ein Bauer schenkt dir Äpfel aus seiner Ernte.', type: 'good', effects: { health: +rnd(2,5) } },
    { text: 'Du hilfst einer alten Frau und sie dankt dir mit Honigkuchen.', type: 'good', effects: { luck: +rnd(2,4), health: +2 } },
    { text: 'Ein Handwerkerlehrling zeigt dir am Brunnen, wie man Steine bearbeitet.', type: 'good', effects: { geschick: +rnd(2,4) } },
    { text: 'Du schwimmst im Fluss und fühlst dich erfrischt.', type: 'good', effects: { health: +rnd(3,6), luck: +rnd(1,3) } },
    { text: 'Die Kinder des Dorfes veranstalten ein Wettrennen. Du wirst Zweiter!', type: 'good', effects: { fitness: +rnd(2,4), luck: +rnd(1,3) } },
    { text: 'Ein umherziehender Spielmann erzählt fantastische Geschichten im Dorf.', type: 'event', effects: { bildung: +rnd(1,3) } },
    { text: 'Du fangst Glühwürmchen in einem Glas und staunst über ihr Licht.', type: 'event', effects: { luck: +rnd(2,3) } },

    // NEGATIVE EREIGNISSE
    { text: 'Du fällst von einem Baum beim Klettern.', type: 'bad', effects: { health: -rnd(3,8), luck: -rnd(1,3) } },
    { text: 'Ein anderes Kind nimmt dir dein Lieblingsspielzeug weg.', type: 'bad', effects: { luck: -rnd(2,5) } },
    { text: 'Du verlierst dich im Wald und findest erst nach Stunden zurück.', type: 'bad', effects: { luck: -rnd(3,6) } },
    { text: 'Du brichst dir den Arm beim Spielen und liegst wochenlang im Bett.', type: 'bad', effects: { health: -rnd(8,15), fitness: -rnd(2,4) } },
    { text: 'Ein Sturm beschädigt das Haus deiner Eltern, und es wird angespannt.', type: 'bad', effects: { luck: -rnd(3,5) } },
  ],

  // Ereignisse für Erwachsene (12-39 Jahre)
  erwachsene: [
    // POSITIVE EREIGNISSE
    { text: 'Ein reisender Kaufmann bleibt für die Nacht im Dorf und kauft deine Waren.', type: 'good', effects: { gold: +rnd(20,50) } },
    { text: 'Du gewinnst ein Trinkspiel im Wirtshaus und kassierst beachtliche Wetten ein.', type: 'good', effects: { gold: +rnd(10,25), luck: +rnd(2,5) } },
    { text: 'Ein gekonnter Handgriff rettet einem Kind beim Brunnen das Leben. Die Familie wird dankbar.', type: 'good', effects: { luck: +rnd(2,4) } },
    { text: 'Du entdeckst eine alte Münze unter dem Flussstein vom Großvater.', type: 'good', effects: { gold: +rnd(5,15) } },
    { text: 'Ein Schmied beauftragt dich mit wichtiger Arbeit. Die Bezahlung ist großzügig.', type: 'good', effects: { gold: +rnd(15,40), geschick: +1 } },
    { text: 'Du schreibst ein Gedicht, das im Dorf große Bewunderung findet.', type: 'good', effects: { bildung: +2 } },
    { text: 'Ein stiller Waldspaziergang klärt deine Gedanken und erfrischt deine Seele.', type: 'good', effects: { luck: +rnd(4,8), health: +rnd(2,5) } },
    { text: 'Die Weinlese war reichlich. Die Preise steigen und du profitierst.', type: 'good', effects: { gold: +rnd(25,60) } },
    { text: 'Du wirst zu einer wichtigen Gemeindeversammlung als Berater hinzugezogen.', type: 'event', effects: {} },
    { text: 'Ein fremder Wanderer erzählt dir von fernen Ländern.', type: 'event', effects: { bildung: +rnd(2,4) } },

    // NEGATIVE EREIGNISSE
    { text: 'Ein schöner Gegenstand bricht dir in der Hand, und du schuldest dem Besitzer Geld.', type: 'bad', effects: { gold: -rnd(10,30), luck: -rnd(1,3) } },
    { text: 'Ein Streit mit einem Nachbarn eskaliert und der Pfarrer muss vermitteln.', type: 'bad', effects: { luck: -rnd(3,6) } },
    { text: 'Ein falscher Freund verleumdert dich, und einige Leute glauben ihm.', type: 'bad', effects: { luck: -rnd(2,4) } },
    { text: 'Du wirst beim Stehlen erwischt. Die Schande sitzt tief.', type: 'bad', effects: { gold: -rnd(20,50) } },
    { text: 'Ein Dachziegel fällt dir fast auf den Kopf. Du wirst gestreift und verletzt.', type: 'bad', effects: { health: -rnd(5,12) } },
    { text: 'Du leihst jemandem Geld, der es nie zurückzahlt.', type: 'bad', effects: { gold: -rnd(15,40), luck: -rnd(1,3) } },
    { text: 'Eine unreine Nahrung verursacht Magenkrämpfe. Du liegst einen Tag im Bett.', type: 'bad', effects: { health: -rnd(3,8) } },
    { text: 'Der Vogt fordert Zusatzsteuern. Die Landwirtschaft ist dieses Jahr nicht ergiebig.', type: 'bad', effects: { gold: -rnd(30,80) } },
  ],

  // Ereignisse für ältere Menschen (40+ Jahre)
  alt: [
    // POSITIVE EREIGNISSE
    { text: 'Deine Lehren und Weisheit werden von jungen Menschen gesucht. Du erhältst eine feine Bezahlung.', type: 'good', effects: { gold: +rnd(20,40) } },
    { text: 'Ein alter Freund aus besseren Zeiten besucht dich. Ihr erinnert euch schöner Tage.', type: 'event', effects: { luck: +rnd(5,10) } },
    { text: 'Deine Handfertigkeiten werden von Sammlern geschätzt. Ein wohlhabender Kaufmann interessiert sich dafür.', type: 'good', effects: { gold: +rnd(15,35), geschick: +1 } },
    { text: 'Du erzählst uralte Geschichten im Wirtshaus. Die Menschen hängen an deinen Lippen.', type: 'event', effects: { luck: +rnd(2,4) } },
    { text: 'Ein arbeitsreicher Tag, aber die Früchte deiner Arbeit sind reichlich.', type: 'good', effects: { gold: +rnd(10,25) } },
    { text: 'Du bist endlich mit einer alten Schuld fertig geworden. Erleichterung breitet sich aus.', type: 'good', effects: { luck: +rnd(3,7), health: +rnd(2,4) } },
    { text: 'Ein ruhiger Tag voller Erinnerungen erfüllt dich mit Frieden.', type: 'event', effects: { luck: +rnd(2,5) } },

    // NEGATIVE EREIGNISSE
    { text: 'Deine alten Wunden beginnen zu schmerzen. Die Jahre hinterlassen Spuren.', type: 'bad', effects: { health: -rnd(5,10) } },
    { text: 'Ein Enkel oder Verwandter nimmt dir Geld ohne zu fragen. Es verletzt dich.', type: 'bad', effects: { gold: -rnd(5,20), luck: -rnd(2,4) } },
    { text: 'Du merkst, dass deine Gedankenschnelle nicht mehr wie früher ist.', type: 'bad', effects: { bildung: -1, luck: -rnd(1,3) } },
    { text: 'Ein alter Streit wird wieder hochgekocht. Die Vergangenheit holt dich ein.', type: 'bad', effects: { luck: -rnd(4,8) } },
    { text: 'Das Altersheim wird erwähnt, wenn dich jemand sieht. Deine Unabhängigkeit wird angezweifelt.', type: 'bad', effects: { luck: -rnd(2,4) } },
    { text: 'Eine ehemals enge Freundschaft bricht auseinander, weil sich die Wege zu sehr getrennt haben.', type: 'bad', effects: { luck: -rnd(5,10) } },
  ]
};

/**
 * Wählt ein Jahresereignis basierend auf dem Alter des Charakters
 * @param {number} age - Alter des Charakters
 * @returns {object} Ein zufälliges Ereignis
 */
function rollEvent(age) {
  if (age < 4) {
    return { text: 'Noch zu jung für größere Ereignisse.', type: '', effects: {} };
  }

  let group;
  if (age < 12) {
    group = EVENT_GROUPS.kinder;
  } else if (age < 40) {
    group = EVENT_GROUPS.erwachsene;
  } else {
    group = EVENT_GROUPS.alt;
  }
  
  return group[rnd(0, group.length - 1)];
}

/**
 * Würfelt, ob der Charakter dieses Jahr krank wird (separate Chance)
 * Krankheit ist nicht Teil der normalen Event-Auswahl
 * @returns {boolean} true wenn neu erkrankt
 */
function rollKrankheit() {
  // 8% Chance krank zu werden pro Jahr
  return Math.random() < 0.08;
}
