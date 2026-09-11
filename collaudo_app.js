/**
 * COLLAUDO DELLO STRATO APP — invarianti su un'asta intera.
 *
 * Il simulatore gia' presente (simula_asta.js) collauda l'AGENTE: quanto
 * offrire, che tier puntare, se conviene chiamare adesso. Non tocca invece
 * la logica dell'APP — turno di chiamata, passaggio di fase, contabilita'
 * del budget, annullamento — che e' proprio dove stavano tre dei quattro
 * bug emersi nell'asta vera del 9 settembre.
 *
 * Qui si fa girare un'asta completa (8 squadre, 200 acquisti) chiamando le
 * FUNZIONI VERE di fantacalcio_app.js, non una loro riscrittura: l'app viene
 * caricata in un contesto con un DOM finto, e si pilotano gli stessi ingressi
 * che userebbe una persona (giocatore selezionato, squadra, prezzo).
 *
 * Dopo ogni singolo acquisto si verificano invarianti che devono valere
 * SEMPRE. Se una salta, il collaudo si ferma e stampa il passo esatto.
 *
 * Uso:  node collaudo_app.js [seme]
 */

const fs = require('fs');
const vm = require('vm');

const SEME = parseInt(process.argv[2] || '1', 10);

// Regola del turno da collaudare: 'chiamante' (Fantalissandria) oppure
// 'acquirente' (Lega Fantacalcio 1996). Le invarianti sul turno sono
// diverse nei due casi, vedi piu' avanti.
const REGOLA = (process.argv[3] === 'acquirente') ? 'acquirente' : 'chiamante';

// ---------------------------------------------------------------- casualita'
// Generatore deterministico: con lo stesso seme l'asta e' identica, cosi' un
// fallimento si puo' riprodurre e non "sparisce" al tentativo dopo.
let _s = SEME;
function rnd() {
  _s = (_s * 1103515245 + 12345) & 0x7fffffff;
  return _s / 0x7fffffff;
}

// ---------------------------------------------------------------- DOM finto
function elemento(id) {
  const el = {
    id: id, value: '', textContent: '', innerHTML: '', checked: false,
    disabled: false, style: {}, dataset: {}, children: [],
    classList: {
      _v: new Set(),
      add(c) { this._v.add(c); }, remove(c) { this._v.delete(c); },
      contains(c) { return this._v.has(c); },
      toggle(c) { if (this._v.has(c)) { this._v.delete(c); return false; }
                  this._v.add(c); return true; }
    },
    appendChild() {}, removeChild() {}, remove() {}, focus() {}, select() {},
    addEventListener() {}, removeEventListener() {}, click() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getAttribute() { return null; }, setAttribute() {}, scrollIntoView() {},
    insertAdjacentHTML() {}, closest() { return null; }
  };
  return el;
}

const cache = {};
const document = {
  getElementById(id) { return (cache[id] = cache[id] || elemento(id)); },
  createElement() { return elemento('nuovo'); },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
  body: elemento('body'),
  documentElement: elemento('html')
};

const store = {};
const localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
  clear() { for (const k in store) delete store[k]; }
};

const ctx = {
  window: {}, document: document, localStorage: localStorage, console: console,
  Date: Date, Math: Math, JSON: JSON, navigator: { clipboard: null },
  setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
  alert() {}, confirm() { return true; },
  // prompt pilotato: aggiungiGiocatoreManuale() chiede nome e squadra
  prompt(msg) { return ctx.__rispostePrompt.shift() || null; },
  requestAnimationFrame() {}, fetch() { return Promise.reject(new Error('offline')); },
  module: { exports: {} }
};
ctx.__rispostePrompt = [];
ctx.window.document = document;
ctx.window.localStorage = localStorage;
ctx.window.addEventListener = function () {};
ctx.window.removeEventListener = function () {};
ctx.window.dispatchEvent = function () {};
ctx.window.matchMedia = function () { return { matches: false, addListener() {}, addEventListener() {} }; };
ctx.window.getComputedStyle = function () { return {}; };
ctx.window.scrollTo = function () {};
ctx.window.location = { href: '', hash: '', search: '', reload() {} };
ctx.window.navigator = ctx.navigator;
ctx.window.setTimeout = ctx.setTimeout;
ctx.addEventListener = function () {};
ctx.globalThis = ctx;
vm.createContext(ctx);

function carica(file) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
carica('./players_data.js');
carica('./fantacalcio_ai.js');

// Nel browser window E' l'oggetto globale, quindi AI_AGENT e' raggiungibile
// per nome. Qui window e' un oggetto a parte: senza questo ponte, tutte le
// guardie "typeof AI_AGENT !== undefined" nell'app risultano false e il
// codice che dipende dall'agente non veniva collaudato affatto.
ctx.AI_AGENT = ctx.window.AI_AGENT;
ctx.STORICO_MANAGER = ctx.window.STORICO_MANAGER;

carica('./fantacalcio_app.js');

// ---------------------------------------------------------------- esiti
let passi = 0;
const fallimenti = [];
function esigi(condizione, titolo, dettaglio) {
  if (!condizione) fallimenti.push({ passo: passi, titolo: titolo, dettaglio: dettaglio });
  return condizione;
}

// Ponte verso il contesto: legge/scrive i globali dichiarati con let dentro
// l'app, che non sono proprieta' dell'oggetto globale.
const dentro = (codice) => vm.runInContext(codice, ctx);

// La lega da collaudare: cambia rosa, budget e regola del turno insieme.
const LEGA = process.argv[4] || null;
if (LEGA) dentro(`applicaLega(${JSON.stringify(LEGA)}, false);`);

const LIMITI = dentro('ROLE_LIMITS');
const REPARTI = dentro('ROLE_ORDER');
const BUDGET = dentro('BUDGET_TOTAL');
const PER_ROSA = dentro('PLAYERS_PER_SQUAD');
const D = dentro('PLAYERS_DATA');

// ---------------------------------------------------------------- preparazione
dentro('teamOrder = [3,1,6,2,8,5,4,7]; orderConfirmed = true; turnoIndex = 0;');

// Budget diversi per squadra, come nella Lega Fantacalcio 1996 (400 piu' il
// residuo dell'anno prima). Se le invarianti reggono qui, reggono anche nel
// caso piu' semplice in cui partono tutte dalla stessa cifra.
const RESIDUI = [18, 5, 5, 43, 0, 12, 1, 6];
for (let i = 1; i <= 8; i++) {
  const b = 400 + RESIDUI[i - 1];
  dentro(`teams[${i}].name = 'Squadra ${i}';`);
  dentro(`teams[${i}].budgetIniziale = ${b}; teams[${i}].budget = ${b}; teams[${i}].spent = 0;`);
}

const stato = () => dentro('JSON.parse(JSON.stringify({teams: teams, turnoIndex: turnoIndex, phaseOverride: phaseOverride}))');

// ---------------------------------------------------------------- invarianti
let faseVistaMax = -1;
let ultimoChiamante = null;
let ultimoAcquirente = null;

function verificaInvarianti(etichetta) {
  const s = stato();
  const t = s.teams;

  // 1 — contabilita': speso + residuo fa il budget iniziale DI QUELLA
  //     squadra. Non e' piu' una costante uguale per tutti: nella Lega
  //     Fantacalcio 1996 si parte da 400 piu' il residuo dell'anno prima,
  //     diverso per ciascuno.
  for (let i = 1; i <= 8; i++) {
    const atteso = typeof t[i].budgetIniziale === 'number' ? t[i].budgetIniziale : BUDGET;
    esigi(t[i].spent + t[i].budget === atteso,
      'contabilita rotta',
      `Squadra ${i}: speso ${t[i].spent} + residuo ${t[i].budget} = ${t[i].spent + t[i].budget}, atteso ${atteso} (${etichetta})`);
    esigi(t[i].budget >= 0, 'budget negativo', `Squadra ${i}: ${t[i].budget}`);
    // 2 — la somma dei prezzi in rosa coincide con lo speso dichiarato
    const somma = t[i].players.reduce((a, p) => a + p.price, 0);
    esigi(somma === t[i].spent, 'speso non coerente con la rosa',
      `Squadra ${i}: somma prezzi ${somma}, speso ${t[i].spent}`);
  }

  // 3 — nessuno supera i limiti di reparto, ne' i 25 slot
  for (let i = 1; i <= 8; i++) {
    REPARTI.forEach((r) => {
      const n = t[i].players.filter((p) => p.role === r).length;
      esigi(n <= LIMITI[r], 'limite di reparto superato',
        `Squadra ${i}: ${n} ${r}, massimo ${LIMITI[r]}`);
    });
    esigi(t[i].players.length <= PER_ROSA, 'rosa oltre i 25',
      `Squadra ${i}: ${t[i].players.length}`);
  }

  // 4 — nessun giocatore in due rose diverse
  const visti = new Map();
  for (let i = 1; i <= 8; i++) {
    t[i].players.forEach((p) => {
      esigi(!visti.has(p.id), 'giocatore in due rose',
        `${p.name} in Squadra ${visti.get(p.id)} e Squadra ${i}`);
      visti.set(p.id, i);
    });
  }

  // 5 — le fasi avanzano soltanto in avanti, mai all'indietro
  const fase = dentro('calcolaFaseCorrente()');
  if (fase) {
    const idx = REPARTI.indexOf(fase);
    esigi(idx >= faseVistaMax, 'fase tornata indietro',
      `da ${REPARTI[faseVistaMax]} a ${fase}`);
    faseVistaMax = Math.max(faseVistaMax, idx);
  }

  // 6 — chi ha completato il reparto in corso non puo' avere il turno
  const ch = dentro('prossimoChiamante()');
  if (ch && fase) {
    const presi = t[ch.squadNum].players.filter((p) => p.role === fase).length;
    esigi(presi < LIMITI[fase], 'turno a chi ha gia chiuso il reparto',
      `Squadra ${ch.squadNum} ha ${presi}/${LIMITI[fase]} ${fase} ma e' indicata come chiamante`);
  }

  // 7 — l'avanzamento non supera mai il 100% e non torna indietro
  const av = dentro('calcolaAvanzamento()');
  esigi(av.totPct >= 0 && av.totPct <= 100, 'avanzamento fuori scala', `${av.totPct}%`);
  esigi(av.totPresi === visti.size, 'conteggio avanzamento incoerente',
    `avanzamento dice ${av.totPresi}, in rosa ce ne sono ${visti.size}`);
}

// ---------------------------------------------------------------- asta
function liberi(ruolo) {
  const presi = new Set();
  const t = stato().teams;
  for (let i = 1; i <= 8; i++) t[i].players.forEach((p) => presi.add(p.id));
  return D.filter((p) => p.role === ruolo && !presi.has(p.id));
}

dentro(`regolaTurno = ${JSON.stringify(REGOLA)};`);

console.log('COLLAUDO STRATO APP — seme ' + SEME + ', regola turno: ' + REGOLA +
  (LEGA ? ', lega: ' + LEGA : '') + ', rosa da ' + PER_ROSA);
console.log('Ordine di chiamata: ' + JSON.stringify(dentro('teamOrder')) + '\n');

verificaInvarianti('stato iniziale');

let ripetizioniIngiustificate = 0;
let acquisti = 0;
const MAX = 400; // guardia contro un ciclo che non termina

while (acquisti < MAX) {
  const fase = dentro('calcolaFaseCorrente()');
  if (!fase) break;

  const ch = dentro('prossimoChiamante()');
  if (!ch) break;

  // INVARIANTE SUL TURNO — diversa secondo la regola di lega.
  if (REGOLA === 'chiamante') {
    // Ordine fisso: un chiamante puo' ripetersi solo se e' rimasto l'unico
    // con slot liberi nel reparto.
    if (ultimoChiamante !== null && ch.squadNum === ultimoChiamante) {
      const t = stato().teams;
      let altriDisponibili = 0;
      for (let i = 1; i <= 8; i++) {
        if (i === ch.squadNum) continue;
        if (t[i].players.filter((p) => p.role === fase).length < LIMITI[fase]) altriDisponibili++;
      }
      if (altriDisponibili > 0) {
        ripetizioniIngiustificate++;
        fallimenti.push({ passo: passi, titolo: 'chiamante ripetuto',
          dettaglio: `Squadra ${ch.squadNum} chiama due volte di fila in ${fase} mentre altre ${altriDisponibili} squadre hanno ancora slot` });
      }
    }
  } else if (ultimoAcquirente !== null) {
    // Regola 1996: chi chiama deve essere la prima squadra con slot liberi
    // partendo dalla posizione SUCCESSIVA a chi ha comprato l'ultima volta.
    // Qui una ripetizione del chiamante e' legittima e non va segnalata.
    const t = stato().teams;
    const ordine = dentro('teamOrder');
    const posAcq = ordine.indexOf(ultimoAcquirente);
    let atteso = null;
    for (let k = 1; k <= 8; k++) {
      const cand = ordine[(posAcq + k) % 8];
      if (t[cand].players.filter((p) => p.role === fase).length < LIMITI[fase]) { atteso = cand; break; }
    }
    if (atteso !== null && atteso !== ch.squadNum) {
      fallimenti.push({ passo: passi, titolo: 'turno non segue chi ha comprato',
        dettaglio: `ha comprato Squadra ${ultimoAcquirente}, dovrebbe chiamare Squadra ${atteso}, chiama invece Squadra ${ch.squadNum} (fase ${fase})` });
    }
  }
  ultimoChiamante = ch.squadNum;

  const disponibili = liberi(fase);
  if (!disponibili.length) break;

  // Chi compra non e' per forza chi chiama: nel 35% dei casi se lo prende
  // un'altra squadra che ha ancora slot in quel reparto, come in un'asta vera.
  let compratore = ch.squadNum;
  if (rnd() < 0.35) {
    const t = stato().teams;
    const idonei = [];
    for (let i = 1; i <= 8; i++) {
      if (t[i].players.filter((p) => p.role === fase).length < LIMITI[fase]) idonei.push(i);
    }
    compratore = idonei[Math.floor(rnd() * idonei.length)];
  }

  const scelto = disponibili[Math.floor(rnd() * Math.min(40, disponibili.length))];

  // Prezzo compatibile col tetto reale della squadra
  const t = stato().teams;
  const slotLiberi = PER_ROSA - t[compratore].players.length;
  const tetto = Math.max(1, t[compratore].budget - Math.max(0, slotLiberi - 1));
  const prezzo = Math.max(1, Math.min(tetto, Math.floor(rnd() * 30) + 1));

  dentro(`selectedPlayer = PLAYERS_DATA.find(p => p.id === ${JSON.stringify(scelto.id)});`);
  dentro(`selectedTeam = ${compratore};`);
  document.getElementById('playerPrice').value = String(prezzo);

  const prima = stato();
  dentro('registerPurchase()');
  const dopo = stato();

  const registrato = dopo.teams[compratore].players.length > prima.teams[compratore].players.length;
  if (!registrato) {
    // Rifiuto legittimo solo se il prezzo eccedeva il budget
    esigi(prezzo > prima.teams[compratore].budget, 'acquisto valido rifiutato',
      `Squadra ${compratore}, ${scelto.name} (${scelto.role}) a ${prezzo} in fase ${fase}, budget ${prima.teams[compratore].budget}`);
    break;
  }

  acquisti++; passi++;
  ultimoAcquirente = compratore;
  verificaInvarianti(`dopo ${scelto.name} -> Squadra ${compratore}`);

  // ---- giocatore inserito a mano, a campione ----
  // Simula il caso reale: un nome chiamato al tavolo che nel listone non
  // c'e'. Viene aggiunto in corsa e comprato subito dopo, come accadrebbe.
  if (acquisti % 53 === 0) {
    const faseM = dentro('calcolaFaseCorrente()');
    if (faseM) {
      const nomeM = 'FORZATO ' + acquisti;
      ctx.__rispostePrompt = [nomeM, 'SquadraFinta'];
      const primaM = stato();
      dentro('aggiungiGiocatoreManuale()');

      const inListone = D.length !== dentro('PLAYERS_DATA.length');
      esigi(dentro('PLAYERS_DATA.some(p => p.name === ' + JSON.stringify(nomeM) + ')'),
        'giocatore manuale non inserito nel listone', nomeM);
      void inListone;

      // Il listone in memoria e' cresciuto: le funzioni che lo interrogano
      // devono continuare a rispondere senza errori.
      const idM = dentro('PLAYERS_DATA.find(p => p.name === ' + JSON.stringify(nomeM) + ').id');
      esigi(idM >= 900000, 'id manuale fuori dall\'intervallo riservato', String(idM));
      esigi(!primaM.teams[1].players.some(p => p.id === idM),
        'giocatore manuale gia presente prima di comprarlo', nomeM);

      // Lo compra una squadra che ha ancora slot in questa fase
      const tM = stato().teams;
      let compM = null;
      for (let i = 1; i <= 8; i++) {
        if (tM[i].players.filter(p => p.role === faseM).length < LIMITI[faseM] &&
            tM[i].budget >= 1) { compM = i; break; }
      }
      if (compM) {
        dentro(`selectedPlayer = PLAYERS_DATA.find(p => p.id === ${idM});`);
        dentro(`selectedTeam = ${compM};`);
        document.getElementById('playerPrice').value = '1';
        dentro('registerPurchase()');
        const dopoM = stato();
        esigi(dopoM.teams[compM].players.some(p => p.id === idM),
          'acquisto di un giocatore manuale rifiutato', nomeM + ' -> Squadra ' + compM);
        acquisti++; passi++;
        ultimoAcquirente = compM;
        verificaInvarianti('dopo giocatore manuale ' + nomeM);

        // L'agente deve continuare a funzionare col listone "sporcato"
        try {
          const pm = dentro('PLAYERS_DATA.find(p => p.id === ' + idM + ')');
          const conv = dentro('AI_AGENT.convenienza(PLAYERS_DATA.find(p => p.id === ' + idM +
                              '), PLAYERS_DATA.filter(x => x.role === ' + JSON.stringify(faseM) + '))');
          esigi(conv && conv.puntiAttesi !== undefined && !Number.isNaN(conv.puntiAttesi),
            'convenienza() va in errore su un giocatore manuale', JSON.stringify(conv));
          // Il metro di paragone non deve contarlo
          esigi(!String(conv.sintesi || '').includes('undefined'),
            'sintesi convenienza malformata', String(conv.sintesi));
          void pm;
        } catch (e) {
          esigi(false, 'convenienza() lancia eccezione su giocatore manuale', e.message);
        }
        try {
          dentro('AI_AGENT.trappole(PLAYERS_DATA, 8)');
        } catch (e) {
          esigi(false, 'trappole() lancia eccezione col listone esteso', e.message);
        }
      }
    }
  }

  // ---- controllo dell'annullamento, a campione ----
  if (acquisti % 37 === 0) {
    const primaUndo = stato();
    dentro('annullaUltimoAcquisto()');
    const dopoUndo = stato();
    const atteso = JSON.stringify(prima);
    const ottenuto = JSON.stringify(dopoUndo);
    esigi(atteso === ottenuto, 'annullamento non ripristina lo stato',
      'lo stato dopo l\'undo differisce da quello precedente all\'acquisto');
    // rimette l'acquisto per proseguire l'asta
    dentro(`selectedPlayer = PLAYERS_DATA.find(p => p.id === ${JSON.stringify(scelto.id)});`);
    dentro(`selectedTeam = ${compratore};`);
    document.getElementById('playerPrice').value = String(prezzo);
    dentro('registerPurchase()');
    void primaUndo;
  }
}

// ---------------------------------------------------------------- esito
const fine = stato();
let completi = 0;
for (let i = 1; i <= 8; i++) if (fine.teams[i].players.length === PER_ROSA) completi++;

const manuali = dentro('PLAYERS_DATA.filter(p => p.inseritoManualmente).length');
console.log('Budget iniziali usati: ' + [1,2,3,4,5,6,7,8].map(i => fine.teams[i].budgetIniziale).join(', '));
console.log('Speso + residuo:       ' + [1,2,3,4,5,6,7,8].map(i => fine.teams[i].spent + '+' + fine.teams[i].budget).join(', '));
console.log(`Acquisti registrati: ${acquisti}`);
console.log(`Giocatori inseriti a mano durante l'asta: ${manuali}`);
console.log(`Rose complete (${PER_ROSA}/${PER_ROSA}): ${completi}/8`);
console.log(`Invarianti controllate a ogni passo: 7`);
console.log(`Chiamanti ripetuti senza motivo: ${ripetizioniIngiustificate}`);
console.log('');

if (!fallimenti.length) {
  console.log('ESITO: nessuna violazione. Asta completa, contabilita\' e turni coerenti.');
  process.exit(0);
} else {
  console.log(`ESITO: ${fallimenti.length} violazioni.\n`);
  const perTipo = {};
  fallimenti.forEach((f) => { (perTipo[f.titolo] = perTipo[f.titolo] || []).push(f); });
  Object.keys(perTipo).forEach((k) => {
    console.log(`  [${perTipo[k].length}x] ${k}`);
    perTipo[k].slice(0, 3).forEach((f) => console.log(`        passo ${f.passo}: ${f.dettaglio}`));
  });
  process.exit(1);
}
