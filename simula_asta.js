/**
 * SIMULATORE D'ASTA — collaudo della logica dell'agente
 *
 * Fa girare un'asta intera secondo le regole della lega:
 *   - 8 squadre, 500 crediti, 25 giocatori (3 POR, 8 DIF, 8 CEN, 6 ATT)
 *   - asta sequenziale per reparto: POR, poi DIF, poi CEN, poi ATT
 *   - ordine di chiamata estratto a sorte e fisso
 *   - si passa al reparto dopo solo quando tutte e 8 hanno completato
 *
 * La squadra 1 segue i consigli dell'agente. Le altre 7 seguono un
 * comportamento semplice ma non stupido: pagano intorno al prezzo di
 * mercato, con un po' di rumore, e si fermano quando il budget stringe.
 *
 * Serve a verificare che la logica dell'agente regga per un'asta intera,
 * non a prevedere cosa succedera' davvero.
 */
const fs = require('fs'), vm = require('vm');

const ctx = { window: {}, module: { exports: {} }, console, Date,
              localStorage: { getItem() { return null; }, setItem() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/claude/players_data.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('/home/claude/fantacalcio_ai.js', 'utf8'), ctx);

const W = ctx.window, D = W.PLAYERS_DATA, A = W.AI_AGENT;
const LIMITI = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };
const ORDINE_REPARTI = ['POR', 'DIF', 'CEN', 'ATT'];
const STRATEGIA = process.argv[2] || 'bilanciata';

// ---------------------------------------------------------------- utilita'
const rnd = (a, b) => a + Math.random() * (b - a);
const conta = (t, r) => t.players.filter((p) => p.role === r).length;
const serve = (t, r) => LIMITI[r] - conta(t, r);
const slotMancanti = (t) => 25 - t.players.length;
// In asta non puoi spendere tutto: ogni slot rimanente costa almeno 1.
const tettoReale = (t) => Math.max(0, t.budget - Math.max(0, slotMancanti(t) - 1));

// ------------------------------------------------------- comportamento avversari
/**
 * Quanto e' disposto a pagare un avversario.
 * Paga intorno al prezzo di mercato con rumore, spende di piu' se ha
 * budget in eccesso rispetto agli slot che gli restano, e non sfora mai
 * il tetto che gli lascia 1 credito per slot.
 */
function offertaAvversario(t, p) {
  if (serve(t, p.role) <= 0) return 0;
  const base = p.pma || 1;
  const agio = t.budget / Math.max(1, slotMancanti(t));  // crediti per slot
  const fattore = agio > 20 ? rnd(1.0, 1.5) : agio > 8 ? rnd(0.8, 1.2) : rnd(0.4, 0.9);
  return Math.min(tettoReale(t), Math.max(1, Math.round(base * fattore)));
}

/** Quanto e' disposta a pagare la squadra dell'agente. */
function offertaAgente(t, p, tutte) {
  if (serve(t, p.role) <= 0) return 0;
  W.teams = tutte; ctx.teams = tutte; W.myTeamNum = 1; W.currentStrategy = STRATEGIA;
  const q = A.quantoOffrire(p, t, STRATEGIA, D, tutte, 1);
  // Se il giocatore fa salire di scaglione nel modificatore, l'agente
  // consiglia di spingersi oltre il tetto nominale.
  const max = q.offertaConsigliata != null ? q.offertaConsigliata : q.offertaMassima;
  return Math.min(tettoReale(t), Math.max(0, max));
}

// ---------------------------------------------------------------- l'asta
function simula(verboso) {
  const squadre = {};
  for (let i = 1; i <= 8; i++) {
    squadre[i] = { name: i === 1 ? 'AGENTE' : 'Avv' + i, budget: 500, spent: 0, players: [] };
  }
  // ordine di chiamata estratto a sorte, fisso per tutta l'asta
  const ordine = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = ordine.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
  }

  const presi = new Set();
  const log = [];
  let turno = 0;

  for (const reparto of ORDINE_REPARTI) {
    let giri = 0;
    // si resta nel reparto finche' tutte e 8 non hanno completato
    while (Object.values(squadre).some((t) => serve(t, reparto) > 0)) {
      if (++giri > 400) { log.push('STALLO nel reparto ' + reparto); break; }

      const chiamante = squadre[ordine[turno % 8]];
      turno++;
      if (serve(chiamante, reparto) <= 0) continue;

      // chi chiama sceglie un giocatore ancora libero del reparto
      const liberi = D.filter((p) => p.role === reparto && !presi.has(p.id));
      if (!liberi.length) { log.push('FINITI i ' + reparto); break; }

      let scelto;
      if (chiamante === squadre[1]) {
        // l'agente chiama il suo obiettivo migliore
        W.teams = squadre; ctx.teams = squadre; W.myTeamNum = 1; W.currentStrategy = STRATEGIA;
        const bf = A.budgetFase(squadre[1], STRATEGIA, squadre);
        const criterio = (bf && bf.titolariMancanti === 0) ? 'efficienza' : 'resa';
        const cand = A.bestValue(liberi, { role: reparto, limit: 1, criterio: criterio,
                                           maxSpesa: tettoReale(squadre[1]) });
        scelto = cand.length ? D.find((p) => p.name === cand[0].nome) : liberi[0];
      } else {
        // gli avversari chiamano fra i migliori per prezzo, con rumore
        const pool = liberi.slice().sort((a, b) => (b.pma || 0) - (a.pma || 0))
                           .slice(0, 12);
        scelto = pool[Math.floor(Math.random() * pool.length)];
      }
      if (!scelto) break;

      // ognuno dice quanto pagherebbe: vince il piu' alto, paga il secondo + 1
      const offerte = [];
      for (let i = 1; i <= 8; i++) {
        const t = squadre[i];
        const o = (i === 1) ? offertaAgente(t, scelto, squadre)
                            : offertaAvversario(t, scelto);
        if (o >= 1) offerte.push({ i, o });
      }
      if (!offerte.length) {
        // nessuno lo vuole: se lo prende chi ha chiamato, a 1 credito
        if (tettoReale(chiamante) >= 1) offerte.push({ i: ordine[(turno - 1) % 8], o: 1 });
        else { presi.add(scelto.id); continue; }
      }
      offerte.sort((a, b) => b.o - a.o);
      const vinc = squadre[offerte[0].i];
      const prezzo = Math.max(1, Math.min(offerte[0].o,
                       (offerte[1] ? offerte[1].o + 1 : 1)));

      vinc.players.push({ id: scelto.id, name: scelto.name, role: scelto.role,
                          team: scelto.team, price: prezzo });
      vinc.spent += prezzo; vinc.budget -= prezzo;
      presi.add(scelto.id);
      if (verboso && offerte[0].i === 1) {
        log.push('  agente prende ' + scelto.name + ' (' + scelto.role + ') a ' + prezzo);
      }
    }
  }
  return { squadre, log };
}

// ---------------------------------------------------------------- controlli
function verifica(squadre) {
  const errori = [];
  Object.entries(squadre).forEach(([k, t]) => {
    if (t.players.length !== 25) errori.push(t.name + ': ' + t.players.length + ' giocatori invece di 25');
    if (t.budget < 0) errori.push(t.name + ': budget negativo (' + t.budget + ')');
    if (t.spent > 500) errori.push(t.name + ': ha speso ' + t.spent + ' su 500');
    Object.keys(LIMITI).forEach((r) => {
      const n = conta(t, r);
      if (n !== LIMITI[r]) errori.push(t.name + ': ' + n + ' ' + r + ' invece di ' + LIMITI[r]);
    });
  });
  const ids = [];
  Object.values(squadre).forEach((t) => t.players.forEach((p) => ids.push(p.id)));
  if (new Set(ids).size !== ids.length) errori.push('un giocatore risulta comprato da piu squadre');
  return errori;
}

// ---------------------------------------------------------------- esecuzione
console.log('SIMULAZIONE ASTA — strategia ' + STRATEGIA.toUpperCase());
console.log('');
const N = Number(process.argv[3] || 1);
let tuttiErrori = [], riepiloghi = [];

for (let k = 0; k < N; k++) {
  const { squadre, log } = simula(N === 1);
  const err = verifica(squadre);
  tuttiErrori = tuttiErrori.concat(err.map((e) => '[asta ' + (k + 1) + '] ' + e));

  const mia = squadre[1];
  const perRuolo = {};
  Object.keys(LIMITI).forEach((r) => {
    perRuolo[r] = mia.players.filter((p) => p.role === r)
                             .reduce((a, p) => a + p.price, 0);
  });
  riepiloghi.push({ speso: mia.spent, perRuolo, players: mia.players });

  if (N === 1) {
    console.log('LA ROSA DELL AGENTE (speso ' + mia.spent + '/500)');
    Object.keys(LIMITI).forEach((r) => {
      const g = mia.players.filter((p) => p.role === r).sort((a, b) => b.price - a.price);
      console.log('  ' + r + ' — ' + perRuolo[r] + ' crediti (' +
                  Math.round(perRuolo[r] / 5) + '% del budget)');
      console.log('    ' + g.map((p) => p.name + ' ' + p.price).join(', '));
    });
    console.log('');
    // il blocco difensivo che ne esce
    W.teams = squadre; ctx.teams = squadre; W.myTeamNum = 1;
    const md = A.modificatoreAttuale(mia, D);
    console.log('MODIFICATORE RISULTANTE');
    console.log('  ' + (md.completo
      ? md.portiere.nome + ' + ' + md.migliori3Difensori.map((d) => d.nome).join(', ') +
        ' -> media ' + md.mediaAttuale + ', bonus ' + md.bonusAttuale
      : md.nota));
    console.log('');
    console.log('SPESA DEGLI AVVERSARI');
    for (let i = 2; i <= 8; i++) {
      console.log('  ' + squadre[i].name + ': ' + squadre[i].spent +
                  ' crediti, ' + squadre[i].players.length + ' giocatori');
    }
  }
}

if (N > 1) {
  console.log('Aste simulate: ' + N);
  console.log('');
  const med = (f) => (riepiloghi.reduce((a, r) => a + f(r), 0) / N).toFixed(1);
  console.log('Spesa media dell agente: ' + med((r) => r.speso) + '/500');
  console.log('Ripartizione media per reparto:');
  Object.keys(LIMITI).forEach((r) => {
    const m = Number(med((x) => x.perRuolo[r]));
    console.log('  ' + r + ': ' + m.toFixed(1) + ' crediti (' +
                (m / 5).toFixed(1) + '% del budget)');
  });
}

console.log('');
if (tuttiErrori.length) {
  console.log('PROBLEMI TROVATI: ' + tuttiErrori.length);
  [...new Set(tuttiErrori)].slice(0, 15).forEach((e) => console.log('  ' + e));
} else {
  console.log('Nessuna violazione delle regole: rose complete, budget rispettati.');
}

// ---- diagnostica extra: concentrazione della spesa in attacco ----
if (process.env.DIAG) {
  const conc = [];
  for (let k = 0; k < 30; k++) {
    const { squadre } = simula(false);
    const att = squadre[1].players.filter((p) => p.role === 'ATT')
                          .sort((a, b) => b.price - a.price);
    const tot = att.reduce((a, p) => a + p.price, 0);
    conc.push({ top: att[0], quota: att[0].price / tot, tot });
  }
  console.log('');
  console.log('CONCENTRAZIONE IN ATTACCO su 30 aste:');
  const q = conc.map((c) => c.quota).sort((a, b) => a - b);
  console.log('  quota del primo attaccante sul budget d attacco:');
  console.log('    minima', (q[0]*100).toFixed(0)+'%', '| mediana', (q[15]*100).toFixed(0)+'%',
              '| massima', (q[q.length-1]*100).toFixed(0)+'%');
  const oltre = conc.filter((c) => c.top.price > 115);
  console.log('  aste in cui ha pagato oltre 115 un attaccante:', oltre.length, 'su 30');
  const nomi = {};
  oltre.forEach((c) => { nomi[c.top.name] = (nomi[c.top.name]||0)+1; });
  console.log('  chi:', Object.entries(nomi).map(([n,c])=>n+' x'+c).join(', ') || 'nessuno');
}
