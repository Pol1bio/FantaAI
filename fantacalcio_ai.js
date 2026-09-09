// =============================================================================
// AGENTE IA FANTACALCIO — v2.0
// Allineato a players_data.js del 2026-09-03 (megafile v3).
// Fonti: Fantaculo + Fantacalcio.it (4 stagioni) + Laudantes (2 stagioni).
// Tarato sulle regole della lega: 8 squadre, 500 crediti, 25 giocatori,
// modificatore difesa attivo con portiere incluso.
// =============================================================================

(function () {
  'use strict';

  // Comportamenti osservabili al tavolo. Sono ipotesi di partenza: vanno
  // corretti dopo la prima asta vera, quando si sa cosa si riconosce davvero.
  // "peso" corregge la pressione attesa da quell'avversario:
  //  > 1 rilancia piu' del previsto, < 1 meno, ~0 di fatto non compete.
  const PATTERN_AVVERSARI = {
    strapaga_top:    { label: 'Strapaga i top',                     peso: 1.4 },
    solo_minimo:     { label: 'Compra solo a 1-2 crediti',          peso: 0.1 },
    rilancia_sempre: { label: 'Rilancia sempre, anche per dispetto', peso: 1.3 },
    molla_subito:    { label: 'Molla appena sale il prezzo',        peso: 0.4 },
    accumula:        { label: 'Accumula per un reparto successivo', peso: 0.3 },
    tagliato_fuori:  { label: 'Ha gia\' speso troppo',              peso: 0.2 }
  };

  const ROLES = ['POR', 'DIF', 'CEN', 'ATT'];

  // Ordine di qualita' decrescente. Serve per contare quanti giocatori
  // "di livello almeno X" restano liberi in una fase.
  const TIER_ORDER = ['A+', 'A', 'A-', 'A--', 'B', 'C'];
  const tierRank = (t) => {
    const i = TIER_ORDER.indexOf(String(t || '').trim());
    return i === -1 ? TIER_ORDER.length : i;
  };

  const ROLE_ALIAS = {
    P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT',
    POR: 'POR', DIF: 'DIF', CEN: 'CEN', ATT: 'ATT',
    PORTIERE: 'POR', DIFENSORE: 'DIF', CENTROCAMPISTA: 'CEN', ATTACCANTE: 'ATT'
  };

  /**
   * AFFIDABILITA' DEL DATO STORICO
   *
   * La media voto su poche partite non predice nulla: Stankovic F. ha
   * mvStorica 6.60, la piu' alta fra i portieri, ma su 17 presenze in
   * quattro stagioni. Comprarlo per il modificatore sarebbe un errore.
   *
   * Nota: modPresenzeTotali NON si puo' usare come filtro generale,
   * perche' e' popolato solo per POR e DIF (vale 0 per tutti i 279
   * centrocampisti e attaccanti). Si sommano invece le presenze per
   * stagione, che esistono per ogni ruolo.
   */
  const PRESENZE_AFFIDABILI = 50;   // sotto: la media e' indicativa
  const PRESENZE_MINIME = 20;       // sotto: la media non dice nulla

  const presenzeTotali = (p) =>
    ['pv_2324', 'pv_2425', 'pv_2526', 'pv_2627']
      .reduce((a, k) => a + (Number(p && p[k]) || 0), 0);

  /** 'solida' | 'indicativa' | 'inaffidabile' */
  const affidabilita = (p) => {
    const n = presenzeTotali(p);
    if (n >= PRESENZE_AFFIDABILI) return 'solida';
    if (n >= PRESENZE_MINIME) return 'indicativa';
    return 'inaffidabile';
  };

  /** Avviso testuale, o null se il dato regge. */
  const avvisoCampione = (p) => {
    const n = presenzeTotali(p);
    if (n >= PRESENZE_AFFIDABILI) return null;
    if (n === 0) return 'nessuna presenza in archivio: media voto non verificabile';
    return 'media su sole ' + n + ' presenze: poco affidabile';
  };

  // L'app puo' usare P/D/C/A, il listone usa POR/DIF/CEN/ATT.
  function normRole(r) {
    if (!r) return '';
    return ROLE_ALIAS[String(r).trim().toUpperCase()] || '';
  }

  // Chiave nome robusta: serve per capire se un giocatore e' gia' stato venduto
  // anche quando l'app non conserva l'id del listone.
  function nameKey(n) {
    if (!n) return '';
    return String(n)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/['\u2019\-]/g, ' ')
      .replace(/[^A-Z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const round1 = (v) => Math.round(v * 10) / 10;
  const round2 = (v) => Math.round(v * 100) / 100;

  // ------------------------------------------------------------------ agente

  class FantacalcioAIAgent {
    constructor(rules) {
      const r = rules || (typeof LEAGUE_RULES !== 'undefined' ? LEAGUE_RULES : null);

      this.budgetTotal = (r && r.squads && r.squads.budgetPerSquad) || 500;
      this.squadSize = (r && r.squads && r.squads.playersPerSquad) || 25;
      this.roleLimits = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };
      if (r && r.squads && r.squads.roleRequirements) {
        ROLES.forEach((role) => {
          const req = r.squads.roleRequirements[role];
          if (req && req.max) this.roleLimits[role] = req.max;
        });
      }
      this.defenseModifier = !!(r && r.defenseModifier && r.defenseModifier.enabled);

      /**
       * Bonus e malus della lega. Servono a pesare correttamente gli
       * specialisti: un rigorista vale +3 a rigore segnato ma -3 se lo
       * sbaglia, e in questa lega il cartellino giallo costa solo -0.5
       * (meta' dello standard), quindi i giocatori falloso pesano meno.
       */
      const bm = (r && r.bonusAndMalus) || {};
      this.punteggi = {
        gol: bm.scoredGoal != null ? bm.scoredGoal : 3,
        rigoreSegnato: bm.scoredPenalty != null ? bm.scoredPenalty : 3,
        rigoreSbagliato: bm.missedPenalty != null ? bm.missedPenalty : -3,
        rigoreParato: bm.recoveredPenalty != null ? bm.recoveredPenalty : 3,
        assist: bm.assist != null ? bm.assist : 1,
        imbattibilita: bm.cleanSheet != null ? bm.cleanSheet : 1,
        golSubito: bm.goalConceded != null ? bm.goalConceded : -1,
        giallo: bm.yellowCard != null ? bm.yellowCard : -0.5,
        rosso: bm.redCard != null ? bm.redCard : -1,
        autogol: bm.ownGoal != null ? bm.ownGoal : -2
      };

      /**
       * Soglie gol: il fantavoto di squadra si converte in gol a scaglioni.
       * Con 11 titolari da 6 si arriva esattamente a 66, cioe' il primo gol:
       * ogni punto in piu' vale 1/5 di gol.
       */
      const gl = (r && r.goals && r.goals.thresholds) || {};
      this.soglieGol = {
        primo: (gl.firstGoal && gl.firstGoal.points) || 66,
        secondo: (gl.secondGoal && gl.secondGoal.points) || 71,
        passo: (gl.additionalGoals && gl.additionalGoals.perEvery) || 5
      };

      /**
       * Quote di budget per reparto.
       *
       * Ricalibrate sul regolamento reale della lega (modificatore difesa
       * con portiere incluso, media sui migliori 3 difensori + portiere).
       * Il primo scalino del modificatore (media >= 6.00, +1 punto) costa
       * 10-25 crediti; il secondo (>= 6.25, +1.5) ne costa ~56; il terzo
       * e' irraggiungibile. Quindi oltre il primo scalino i crediti in
       * difesa rendono molto meno che in attacco, dove il rendimento
       * cala in modo regolare (~+0.24 di fantamedia per raddoppio di prezzo).
       *
       * PORTIERI: quota bassa, ma non perche' i portieri si equivalgano.
       * Sul MODIFICATORE contano solo per il voto, e li' Falcone (3.75,
       * mv 6.307) vale quanto Svilar (44.4, mv 6.320). Sui PUNTI invece
       * la differenza esiste: il portiere prende -1 per gol subito e +1
       * per imbattibilita', quindi uno di una difesa solida rende di piu'
       * (Svilar fm 5.408 contro Falcone 4.973, ~16 punti stagione).
       * Ma quei 16 punti costano 40 crediti, e Skorupski (5.45, fm 5.217,
       * titolare al 91%) ne recupera la maggior parte spendendone 5.
       * Da qui la quota bassa: prendere un portiere titolare di buona
       * difesa senza pagare la fascia alta.
       *
       * CONSERVATIVA e' l'unica che punta al secondo scalino del
       * modificatore: per questo tiene 12% sulla difesa.
       */
      /**
       * Revisionate l'8 settembre 2026: la taratura precedente (POR 2-3%,
       * DIF 7-12%) ottimizzava solo il voto puro per il modificatore,
       * ignorando il rendimento fantacalcistico diretto del giocatore
       * (gol, assist, gol subiti). Verificato sui dati: un portiere A+ ha
       * una fantamedia di 0.80 punti/partita piu' alta di un A-- (24 punti
       * a stagione — paragonabile al guadagno marginale dell'attacco), e
       * un difensore A+ ha 0.33 punti/partita di bonus netto in piu' dei
       * tier bassi (~10 punti a stagione), a prescindere dal modificatore.
       * Due fonti indipendenti (guida Fantaculo, tabella budget Laudantes
       * per lega a 8 con modificatore) suggerivano entrambe piu' budget
       * su POR/DIF di quanto avessimo calibrato: la verifica sui dati ha
       * confermato che avevano ragione, non e' stato un adeguamento alla
       * cieca.
       */
      this.strategies = {
        conservativa:        { name: 'CONSERVATIVA',      POR: 0.06, DIF: 0.15, CEN: 0.27, ATT: 0.52 },
        bilanciata:          { name: 'BILANCIATA',        POR: 0.06, DIF: 0.13, CEN: 0.25, ATT: 0.56 },
        aggressiva:          { name: 'AGGRESSIVA',        POR: 0.04, DIF: 0.10, CEN: 0.20, ATT: 0.66 },
        'centrocampo-first': { name: 'CENTROCAMPO-FIRST', POR: 0.06, DIF: 0.12, CEN: 0.35, ATT: 0.47 }
      };

      /**
       * Quanti slot per reparto sono TITOLARI (vanno pagati) e quanti
       * sono panchinari (bastano 1-2 crediti).
       *
       * Il modificatore richiede di schierarne 4 in difesa, ma contano
       * solo i migliori 3 + portiere: il quarto serve a qualificarsi.
       * In campo vanno 11 giocatori su 25, quindi meta' rosa non gioca
       * mai e non va pagata.
       */
      this.slotTitolari = { POR: 1, DIF: 4, CEN: 5, ATT: 3 };
      this.prezzoPanchinaro = 1.5;
    }

    // -------------------------------------------------------- stato squadra

    rosterState(team) {
      const players = (team && team.players) || [];
      const spentByRole = { POR: 0, DIF: 0, CEN: 0, ATT: 0 };
      const countByRole = { POR: 0, DIF: 0, CEN: 0, ATT: 0 };

      players.forEach((p) => {
        const role = normRole(p.role || p.roleShort);
        if (!role) return;
        countByRole[role] += 1;
        spentByRole[role] += num(p.price) || 0;
      });

      const spent = ROLES.reduce((s, r) => s + spentByRole[r], 0);
      const b = num(team && team.budget);
      const residuo = b !== null ? b : this.budgetTotal - spent;
      const slotMancanti = ROLES.reduce(
        (s, r) => s + Math.max(0, this.roleLimits[r] - countByRole[r]), 0);

      return {
        spentByRole, countByRole,
        spent: round1(spent),
        residuo: round1(residuo),
        slotMancanti,
        // In asta non puoi spendere tutto: ogni slot rimanente costa almeno
        // 1 credito. Questo e' il vero tetto della prossima offerta.
        maxOffertaOra: Math.max(0, Math.floor(residuo - Math.max(0, slotMancanti - 1))),
        creditiPerSlot: slotMancanti > 0 ? round1(residuo / slotMancanti) : 0
      };
    }

    analyzeTeam(team, strategyKey) {
      const strat = this.strategies[strategyKey] || this.strategies.bilanciata;
      const st = this.rosterState(team);
      const out = {};

      ROLES.forEach((role) => {
        const actual = (st.spentByRole[role] / this.budgetTotal) * 100;
        const target = strat[role] * 100;
        const dev = actual - target;
        out[role] = {
          spent: round1(st.spentByRole[role]),
          count: st.countByRole[role],
          needed: Math.max(0, this.roleLimits[role] - st.countByRole[role]),
          actual: round1(actual),
          target: round1(target),
          deviation: round1(dev),
          budgetTarget: Math.round(this.budgetTotal * strat[role]),
          budgetResiduoRuolo: Math.max(
            0, Math.round(this.budgetTotal * strat[role] - st.spentByRole[role])),
          status: Math.abs(dev) < 2 ? 'in linea'
                : dev < 0 ? 'sotto il target' : 'sopra il target',
          severity: Math.abs(dev) < 2 ? 'ok'
                  : Math.abs(dev) < 5 ? 'warning' : 'critical'
        };
      });
      return out;
    }

    detectAnomalies(team, strategyKey) {
      const st = this.rosterState(team);
      const analysis = this.analyzeTeam(team, strategyKey);
      const alerts = [];

      // Il vincolo vero in asta non e' il budget assoluto, ma quanto resta
      // per ogni slot ancora da riempire.
      if (st.slotMancanti > 0 && st.creditiPerSlot < 2) {
        alerts.push({
          severity: 'critical', type: 'budget_per_slot', icon: '\u{1F534}',
          message: 'Restano ' + st.residuo + ' crediti per ' + st.slotMancanti +
                   ' slot (' + st.creditiPerSlot + ' a giocatore): puoi solo ' +
                   'completare la rosa al prezzo minimo.'
        });
      } else if (st.slotMancanti > 0 && st.creditiPerSlot < 5) {
        alerts.push({
          severity: 'warning', type: 'budget_per_slot', icon: '\u{1F7E1}',
          message: st.residuo + ' crediti per ' + st.slotMancanti + ' slot (' +
                   st.creditiPerSlot + ' a giocatore): margine ridotto.'
        });
      }

      if (st.slotMancanti > 1) {
        alerts.push({
          severity: 'info', type: 'max_offerta', icon: '\u{1F4B0}',
          message: 'Offerta massima possibile adesso: ' + st.maxOffertaOra +
                   ' crediti (tenendone 1 per ognuno degli altri ' +
                   (st.slotMancanti - 1) + ' slot).'
        });
      }

      ROLES.forEach((role) => {
        const a = analysis[role];
        if (a.needed > 0 && a.budgetResiduoRuolo < a.needed) {
          alerts.push({
            severity: 'high', type: 'role_underfunded', role: role, icon: '\u26A0\uFE0F',
            message: role + ': mancano ' + a.needed + ' giocatori ma il budget ' +
                     'di ruolo e\' quasi esaurito (' + a.budgetResiduoRuolo + ' crediti).'
          });
        }
      });

      if (ROLES.every((r) => analysis[r].needed === 0)) {
        alerts.push({
          severity: 'info', type: 'squad_complete', icon: '\u2705',
          message: 'Rosa completa in tutti i ruoli.'
        });
      }

      /**
       * DIVERSIFICAZIONE SQUADRA REALE (dalla guida Fantaculo).
       *
       * Troppi giocatori della stessa squadra di Serie A creano problemi di
       * schieramento veri: se quella squadra ha una giornata storta o un
       * turno di riposo per le coppe, ti si ferma mezza rosa insieme. La
       * guida suggerisce di non superare 5-6 giocatori totali e 3 titolari
       * (qui approssimati come "costati piu' del prezzo da panchina",
       * l'unico modo per dedurlo senza un flag esplicito titolare/riserva)
       * dalla stessa squadra reale.
       */
      const perSquadraReale = {};
      (team.players || []).forEach((p) => {
        const sq = p.team || p.squad;
        if (!sq) return;
        perSquadraReale[sq] = perSquadraReale[sq] || { totale: 0, titolari: 0 };
        perSquadraReale[sq].totale += 1;
        if ((p.price || 0) > this.prezzoPanchinaro) perSquadraReale[sq].titolari += 1;
      });
      Object.entries(perSquadraReale).forEach(([squadra, c]) => {
        const daSquadra = /^[AEIOU]/i.test(squadra) ? "dall'" + squadra : 'dal ' + squadra;
        if (c.totale >= 6) {
          alerts.push({
            severity: 'warning', type: 'concentrazione_squadra', icon: '\u{1F465}',
            message: c.totale + ' giocatori ' + daSquadra +
                     ': se ha un turno storto o gioca le coppe, ti si ferma mezza rosa insieme.'
          });
        } else if (c.titolari >= 4) {
          alerts.push({
            severity: 'info', type: 'concentrazione_squadra', icon: '\u{1F465}',
            message: c.titolari + ' titolari ' + daSquadra +
                     ': attento all\u2019undici ideale, la guida consiglia di non superare 3.'
          });
        }
      });

      return alerts;
    }

    // ------------------------------------------------------- disponibilita'

    /**
     * Giocatori ancora liberi. Esclude quelli acquistati da QUALSIASI squadra,
     * non solo dalla propria. Confronta per id e, se manca, per nome.
     */
    availablePlayers(allPlayers, allTeams) {
      const list = allPlayers || [];

      // Mappa id->nome del listone. Serve a fidarsi dell'id SOLO quando
      // corrisponde davvero: se l'app numera i giocatori per conto suo,
      // usare l'id alla cieca cancellerebbe giocatori a caso.
      const idToName = new Map();
      list.forEach((p) => {
        if (p.id !== undefined && p.id !== null) {
          idToName.set(String(p.id), nameKey(p.name));
        }
      });

      const takenIds = new Set();
      const takenNameRole = new Set();   // nome+ruolo: due omonimi di ruolo
                                         // diverso non si escludono a vicenda
      Object.keys(allTeams || {}).forEach((k) => {
        const t = allTeams[k];
        ((t && t.players) || []).forEach((p) => {
          const nk = nameKey(p.name);
          if (nk) takenNameRole.add(nk + '|' + normRole(p.role || p.roleShort));
          if (p.id !== undefined && p.id !== null) {
            const atteso = idToName.get(String(p.id));
            // l'id vale solo se punta allo stesso giocatore
            if (atteso && nk && atteso === nk) takenIds.add(String(p.id));
          }
        });
      });

      return list.filter((p) => {
        if (p.id !== undefined && takenIds.has(String(p.id))) return false;
        const nk = nameKey(p.name);
        return !(nk && takenNameRole.has(nk + '|' + normRole(p.role)));
      });
    }

    // --------------------------------------------------------- suggerimenti

    /** Migliori rapporti qualita/prezzo tra i giocatori ancora liberi. */
    /**
     * Obiettivi consigliati.
     *
     * Non usa piu' valueScore del listone (inaffidabile: escludeva
     * Buongiorno, fra i difensori piu' convenienti, perche' gli assegna 18).
     * Ordina sulla convenienza ricalcolata, scegliendo il criterio in base
     * al tipo di slot: sui titolari conta la resa assoluta, sui panchinari
     * la resa per credito.
     */
    bestValue(availables, opts) {
      const o = opts || {};
      const maxSpesa = o.maxSpesa !== undefined ? o.maxSpesa : null;
      const role = o.role ? normRole(o.role) : null;
      const perEfficienza = o.criterio === 'efficienza';

      const candidati = availables
        .filter((p) => !role || normRole(p.role) === role)
        .filter((p) => maxSpesa === null || num(p.pma) === null || p.pma <= maxSpesa)
        // Chi non gioca non rende, per quanto costi poco.
        .filter((p) => (p.expectedTitolarita || 0) >= 50);

      const conv = new Map();
      candidati.forEach((p) => conv.set(p.id, this.convenienza(p, candidati)));

      return candidati
        .sort((a, b) => {
          const ca = conv.get(a.id), cb = conv.get(b.id);
          return perEfficienza
            ? cb.puntiPerCredito - ca.puntiPerCredito
            : cb.puntiAttesi - ca.puntiAttesi;
        })
        .slice(0, o.limit || 8)
        .map((p) => {
          const c = this.playerCard(p);
          c.convenienza = conv.get(p.id);
          return c;
        });
    }

    /** I piu' forti disponibili in un ruolo, entro un tetto di spesa. */
    targetsForRole(availables, role, maxSpesa, limit) {
      const r = normRole(role);
      return availables
        .filter((p) => normRole(p.role) === r && p.qualityScore !== undefined)
        .filter((p) => maxSpesa === null || maxSpesa === undefined ||
                       num(p.pma) === null || p.pma <= maxSpesa)
        .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
        .slice(0, limit || 6)
        .map((p) => this.playerCard(p));
    }

    /**
     * Occasioni specifiche di QUESTA lega: difensori e portieri con media voto
     * alta e prezzo basso. I listoni li sottovalutano perche' ragionano su una
     * lega senza modificatore difesa.
     */
    modificatoreBargains(availables, limit, team, allPlayers) {
      if (!this.defenseModifier) return [];
      const lista = availables
        // Un'occasione da modificatore si fonda sulla media voto: se la
        // media viene da poche partite, l'occasione non esiste.
        .filter((p) => p.modBargain && affidabilita(p) !== 'inaffidabile')
        .sort((a, b) => (b.modMediaVoto || 0) - (a.modMediaVoto || 0));

      // Se conosco la rosa, un "affare" che non entra fra i migliori 3 non
      // e' un affare: il modificatore guarda il blocco, non il singolo.
      const conBlocco = [];
      const stato = team ? this.modificatoreAttuale(team, allPlayers) : null;
      lista.forEach((p) => {
        if (conBlocco.length >= (limit || 12)) return;
        const c = this.playerCard(p);
        c.perche = p.modBargainNote;
        const av = avvisoCampione(p);
        if (av) c.perche = c.perche + ' ATTENZIONE: ' + av + '.';

        if (stato && stato.completo) {
          const imp = this.impattoSulModificatore(p, team, allPlayers);
          if (imp && imp.applicabile) {
            c.impattoSulMioBlocco = imp.nota;
            c.miMigliora = imp.variazioneMedia > 0;
            // Chi non tocca il blocco resta fuori: e' rumore in asta.
            if (imp.variazioneMedia === 0) return;
          }
        }
        conBlocco.push(c);
      });
      return conBlocco;
    }

    /**
     * MODIFICATORE DIFESA: dove sei adesso.
     *
     * Il modificatore non e' una proprieta' dei singoli giocatori ma del
     * BLOCCO schierato: media fra il portiere e i migliori 3 difensori.
     * Per questo un secondo portiere forte non serve a niente, e il quinto
     * difensore buono nemmeno: contano solo i primi tre.
     *
     * Restituisce la media attuale, lo scaglione raggiunto e quanto manca
     * al successivo.
     */
    modificatoreAttuale(team, allPlayers) {
      if (!this.defenseModifier) return null;
      const players = (team && team.players) || [];
      const pool = allPlayers || [];

      // La rosa salva pochi campi: recupero la media voto dal listone.
      const arricchisci = (p) => {
        const full = pool.find((x) => x.id === p.id) || {};
        return {
          nome: p.name,
          mv: full.mvStorica != null ? full.mvStorica : null,
          presenze: presenzeTotali(full),
          affidabilita: affidabilita(full)
        };
      };

      const portieri = players.filter((p) => normRole(p.role) === 'POR')
        .map(arricchisci).filter((p) => p.mv != null)
        .sort((a, b) => b.mv - a.mv);
      const difensori = players.filter((p) => normRole(p.role) === 'DIF')
        .map(arricchisci).filter((p) => p.mv != null)
        .sort((a, b) => b.mv - a.mv);

      const por = portieri[0] || null;
      const primi3 = difensori.slice(0, 3);
      const completo = !!por && primi3.length === 3;

      const media = completo
        ? (por.mv + primi3.reduce((a, d) => a + d.mv, 0)) / 4
        : null;

      // Scala bonus della lega
      const SCALA = [
        { soglia: 7.00, bonus: 3 },   { soglia: 6.75, bonus: 2.5 },
        { soglia: 6.50, bonus: 2 },   { soglia: 6.25, bonus: 1.5 },
        { soglia: 6.00, bonus: 1 }
      ];
      const scaglione = media == null ? null
        : (SCALA.find((s) => media >= s.soglia) || { soglia: null, bonus: 0 });
      const prossimo = media == null ? null
        : SCALA.slice().reverse().find((s) => s.soglia > media) || null;

      // Quanto dovrebbe valere un difensore per farmi salire di scaglione:
      // deve sostituire il peggiore dei miei primi 3.
      let mvRichiesta = null;
      if (completo && prossimo) {
        const peggiore = primi3[primi3.length - 1].mv;
        const sommaAltri = por.mv + primi3.slice(0, 2).reduce((a, d) => a + d.mv, 0);
        mvRichiesta = round2(prossimo.soglia * 4 - sommaAltri);
        if (mvRichiesta <= peggiore) mvRichiesta = null; // gia' raggiungibile
      }

      const debole = primi3.filter((d) => d.affidabilita === 'inaffidabile');

      return {
        completo: completo,
        portiere: por,
        migliori3Difensori: primi3,
        mediaAttuale: media == null ? null : round2(media),
        bonusAttuale: scaglione ? scaglione.bonus : null,
        sogliaRaggiunta: scaglione ? scaglione.soglia : null,
        prossimaSoglia: prossimo ? prossimo.soglia : null,
        bonusProssimo: prossimo ? prossimo.bonus : null,
        distanzaDallaProssima: (media != null && prossimo)
          ? round2(prossimo.soglia - media) : null,
        mediaVotoRichiestaPerSalire: mvRichiesta,
        avvisoDatiDeboli: debole.length
          ? debole.map((d) => d.nome).join(', ') +
            ': media voto su poche partite, il calcolo e\' incerto.'
          : null,
        nota: !completo
          ? 'Servono un portiere e almeno 3 difensori con storico per ' +
            'calcolare il modificatore.'
          : (prossimo
              ? 'Sei a ' + round2(media) + ' (bonus ' + scaglione.bonus +
                '). Ti mancano ' + round2(prossimo.soglia - media) +
                ' di media per il bonus ' + prossimo.bonus + '.' +
                (mvRichiesta
                  ? ' Servirebbe un difensore da media voto ' + mvRichiesta +
                    ' al posto del tuo terzo.'
                  : '')
              : 'Sei al massimo scaglione: bonus ' + scaglione.bonus + '.')
      };
    }

    /**
     * Quanto sposterebbe il modificatore l'acquisto di questo giocatore.
     * E' la domanda vera in fase difensori: non "quanto vale" ma
     * "quanto cambia il mio blocco".
     */
    impattoSulModificatore(player, team, allPlayers) {
      if (!this.defenseModifier) return null;
      const role = normRole(player.role);
      if (role !== 'DIF' && role !== 'POR') return null;

      const prima = this.modificatoreAttuale(team, allPlayers);
      if (!prima) return null;

      const mv = player.mvStorica;
      if (mv == null) {
        return { applicabile: false,
                 nota: 'Nessuno storico per ' + player.name + ': impatto non calcolabile.' };
      }

      // Simulo la rosa con il giocatore dentro
      const finto = { players: ((team && team.players) || []).concat([
        { id: player.id, name: player.name, role: role }
      ])};
      const poolConLui = (allPlayers || []).some((x) => x.id === player.id)
        ? allPlayers : (allPlayers || []).concat([player]);
      const dopo = this.modificatoreAttuale(finto, poolConLui);

      const delta = (dopo.mediaAttuale != null && prima.mediaAttuale != null)
        ? round2(dopo.mediaAttuale - prima.mediaAttuale) : null;
      const deltaBonus = (dopo.bonusAttuale != null && prima.bonusAttuale != null)
        ? round2(dopo.bonusAttuale - prima.bonusAttuale) : null;

      let nota;
      if (!prima.completo && dopo.completo) {
        nota = 'Completa il blocco: media ' + dopo.mediaAttuale +
               ', bonus ' + dopo.bonusAttuale + '.';
      } else if (delta === null) {
        nota = 'Blocco ancora incompleto: impatto non misurabile.';
      } else if (delta === 0) {
        nota = 'Non entra fra i migliori 3: nessun effetto sul modificatore. ' +
               'Come difensore da modificatore non ti serve.';
      } else if (deltaBonus > 0) {
        nota = 'Ti fa salire di scaglione: media da ' + prima.mediaAttuale +
               ' a ' + dopo.mediaAttuale + ', bonus da ' + prima.bonusAttuale +
               ' a ' + dopo.bonusAttuale + '. Vale un rilancio.';
      } else {
        nota = 'Alza la media da ' + prima.mediaAttuale + ' a ' + dopo.mediaAttuale +
               ' ma resta nello stesso scaglione (bonus ' + dopo.bonusAttuale + ').';
      }

      const av = avvisoCampione(player);
      if (av) nota += ' Cautela: ' + av + '.';

      return {
        applicabile: true,
        giocatore: player.name,
        mediaPrima: prima.mediaAttuale,
        mediaDopo: dopo.mediaAttuale,
        variazioneMedia: delta,
        bonusPrima: prima.bonusAttuale,
        bonusDopo: dopo.bonusAttuale,
        variazioneBonus: deltaBonus,
        entraNeiMigliori3: dopo.migliori3Difensori
          .some((d) => d.nome === player.name) ||
          (dopo.portiere && dopo.portiere.nome === player.name),
        nota: nota
      };
    }

    /**
     * FORMATO A SCONTRI DIRETTI: quanto rischiare.
     *
     * Le soglie gol hanno un pavimento (sotto 66 punti prendi zero gol
     * comunque) e nessun tetto: questo rende la varianza vantaggiosa per
     * chi e' sotto la media e svantaggiosa per chi e' sopra. Simulando
     * 38 giornate contro un avversario medio:
     *
     *   rosa piu' debole:  costante 30.9 punti, esplosiva 40.5
     *   rosa pari:         costante 50.3,       esplosiva 54.1
     *   rosa piu' forte:   costante 82.0,       esplosiva 75.8
     *
     * Quindi il consiglio si ribalta a meta' asta, e dipende da come si
     * sta piazzando la mia rosa rispetto alle altre.
     */
    profiloRischio(team, allTeams, mineKey, allPlayers) {
      const conta = (t) => ((t && t.players) || []).length;
      const presiMiei = conta(team);

      /**
       * Misura la FORZA della rosa, non la spesa.
       *
       * Confrontare la spesa per giocatore e' sbagliato: chi segue il piano
       * magro spende poco di proposito e si ritrova con piu' crediti in
       * cassa, ma il profilo lo classificava "sotto la media" e gli
       * consigliava di rischiare. Esattamente al contrario del vero.
       *
       * Si stimano invece i punti attesi dei giocatori gia' presi, piu' il
       * potenziale dei crediti ancora disponibili (a un tasso di conversione
       * prudente ricavato dai prezzi correnti).
       */
      const pool = allPlayers || [];
      const puntiDi = (t) => {
        let p = 0;
        ((t && t.players) || []).forEach((g) => {
          const full = pool.find((x) => x.id === g.id);
          if (!full) return;
          const fm = full.fmStorica || full.expectedFantamedia || 6;
          const tit = (full.expectedTitolarita || 0) / 100;
          const n = presenzeTotali(full);
          const fiducia = Math.min(1, n / PRESENZE_AFFIDABILI);
          p += (fm - 6) * fiducia * 38 * tit;
        });
        return p;
      };
      // I crediti non spesi valgono punti futuri: ~0.06 punti per credito,
      // che e' il rendimento medio osservato sul listone.
      const TASSO = 0.06;
      const forza = (t) => puntiDi(t) + Math.max(0, (t && t.budget) || 0) * TASSO;

      const mia = forza(team);
      const altrui = [];
      Object.keys(allTeams || {}).forEach((k) => {
        if (String(k) === String(mineKey)) return;
        if (conta(allTeams[k]) > 0) altrui.push(forza(allTeams[k]));
      });
      if (altrui.length < 3 || presiMiei < 3 || !pool.length) {
        return { valutabile: false,
                 nota: 'Troppo presto per dire se la rosa e\' sopra o sotto la media.' };
      }

      const media = altrui.reduce((a, v) => a + v, 0) / altrui.length;
      const scarto = media !== 0 ? (mia - media) / Math.abs(media) : 0;

      /**
       * Una percentuale relativa ha senso solo se la base e' positiva e non
       * troppo vicina a zero: altrimenti "+273%" non comunica niente, e con
       * basi negative il segno puo' addirittura ingannare. In quei casi ci
       * si affida alla differenza assoluta in punti invece che al rapporto.
       */
      const baseUtile = Math.abs(media) > 15;
      const differenza = mia - media;
      const scartoUsabile = baseUtile ? scarto : null;
      const sopra = baseUtile ? scarto > 0.15 : differenza > 10;
      const sotto = baseUtile ? scarto < -0.15 : differenza < -10;

      let posizione, consiglio;
      if (sopra) {
        posizione = 'sopra la media';
        consiglio = 'La tua rosa e\' piu\' forte della media: conviene LIVELLARE. ' +
          'A scontri diretti il vantaggio si difende con la costanza — la ' +
          'varianza ti farebbe perdere partite gia\' vinte (75.8 punti contro ' +
          '82.0 nella simulazione). Preferisci due buoni giocatori a un ' +
          'fuoriclasse piu\' un riempitivo.';
      } else if (sotto) {
        posizione = 'sotto la media';
        consiglio = 'La tua rosa e\' piu\' debole della media: conviene RISCHIARE. ' +
          'Concentra i crediti su pochi fuoriclasse e accetta le giornate ' +
          'storte: le soglie gol premiano la varianza quando insegui ' +
          '(40.5 punti contro 30.9).';
      } else {
        posizione = 'in media';
        consiglio = 'Sei in linea con gli altri. Con rose pari la varianza ' +
          'aiuta ancora un poco (54.1 contro 50.3): a parita\' di prezzo ' +
          'preferisci il giocatore che puo\' esplodere.';
      }

      return {
        valutabile: true,
        forzaMia: round1(mia),
        forzaMediaAvversari: round1(media),
        differenzaPunti: round1(differenza),
        scartoPercentuale: scartoUsabile != null ? Math.round(scartoUsabile * 100) : null,
        creditiInCassa: (team && team.budget) || 0,
        posizione: posizione,
        consiglio: consiglio
      };
    }

    /**
     * CONVENIENZA, ricalcolata sulle regole di questa lega.
     *
     * Il campo valueScore del listone non e' affidabile: comprime il 57%
     * dei giocatori fra 20 e 40, ne satura 34 a 100 esatto, e assegna 18 a
     * Buongiorno contro 95.5 a Carlos Augusto, che a parita' di prezzo
     * rendono uguale. Qui si ricalcola da zero.
     *
     * Due misure diverse, perche' servono a decisioni diverse:
     *  - puntiAttesi: quanto rende in stagione. Conta sugli slot da
     *    TITOLARE, dove il budget c'e' e si cerca il massimo assoluto.
     *  - puntiPerCredito: quanto rende per credito speso. Conta sugli slot
     *    da PANCHINA e quando il budget stringe.
     *
     * Espressa come posizione nel ruolo ("4o fra i difensori liberi")
     * invece che come punteggio 0-100, che non dice nulla da solo.
     */
    convenienza(player, availables) {
      const stima = (p) => {
        const fm = p.fmStorica || p.expectedFantamedia || 6;
        const tit = (p.expectedTitolarita || 0) / 100;
        /**
         * Temperamento per campione piccolo.
         *
         * Una fantamedia costruita su 5 partite fortunate batte quella di
         * chi ne ha giocate 120, e senza correzione i giocatori senza
         * storico occupano tutte le prime posizioni. Si tira la stima
         * verso il 6 di base in proporzione a quanto poco sappiamo:
         * con 50+ presenze si crede al dato per intero, con 0 non gli si
         * crede affatto. E' un accorgimento standard, non una penalita'
         * arbitraria: la media di pochi dati va regredita verso la media
         * generale.
         */
        const n = presenzeTotali(p);
        const fiducia = Math.min(1, n / PRESENZE_AFFIDABILI);
        const fmTemperata = 6 + (fm - 6) * fiducia;
        return (fmTemperata - 6) * 38 * tit;
      };
      const punti = stima(player);
      const perCredito = punti / Math.max(1, player.pma || 1);

      const role = normRole(player.role);
      const pari = (availables || []).filter((p) => normRole(p.role) === role);
      const posPunti = pari.filter((p) => stima(p) > punti).length + 1;
      const posEff = pari.filter((p) =>
        stima(p) / Math.max(1, p.pma || 1) > perCredito).length + 1;

      const aff = affidabilita(player);
      return {
        puntiAttesi: round1(punti),
        puntiPerCredito: round2(perCredito),
        posizionePerResa: posPunti,
        posizionePerEfficienza: posEff,
        suQuanti: pari.length,
        affidabilita: aff,
        sintesi: pari.length
          ? posPunti + 'o per resa e ' + posEff + 'o per efficienza fra i ' +
            pari.length + ' ' + role + ' liberi' +
            (aff === 'inaffidabile' ? ' (ma i numeri vengono da poche partite)' : '')
          : null
      };
    }

    /**
     * COME STA ANDANDO IL MERCATO, e come approfittarne.
     *
     * L'asta e' sequenziale per reparto, quindi mentre si comprano portieri
     * e difensori si vedono gia' due segnali che dicono cosa succedera' in
     * attacco:
     *
     *  1) INFLAZIONE. Quanto si sta pagando sopra o sotto il listino, in
     *     ogni reparto gia' battuto. Se i difensori vanno al 130% del
     *     listino, chi li ha comprati ha meno crediti per l'attacco.
     *
     *  2) LIQUIDITA' TRATTENUTA. Quanti crediti hanno in mano gli avversari
     *     rispetto agli slot che devono ancora riempire. Chi tiene molto
     *     sta aspettando gli attaccanti: l'asta in attacco sara' cara, e i
     *     reparti intermedi si prendono a poco.
     *
     * E' esattamente il segnale difficile da leggere in diretta, perche'
     * richiede di sommare a mente 8 budget mentre si sta rilanciando.
     */
    mercatoPerReparto(allTeams, allPlayers, mineKey) {
      const pool = allPlayers || [];
      const listino = new Map();
      pool.forEach((p) => { if (p.pma != null) listino.set(p.id, p.pma); });

      const perRuolo = {};
      ROLES.forEach((r) => { perRuolo[r] = { pagato: 0, listino: 0, n: 0 }; });

      Object.values(allTeams || {}).forEach((t) => {
        ((t && t.players) || []).forEach((g) => {
          const r = normRole(g.role);
          const l = listino.get(g.id);
          if (!r || l == null) return;
          perRuolo[r].pagato += Number(g.price) || 0;
          perRuolo[r].listino += l;
          perRuolo[r].n += 1;
        });
      });

      const inflazione = {};
      ROLES.forEach((r) => {
        const d = perRuolo[r];
        inflazione[r] = (d.n >= 5 && d.listino > 0)
          ? { rapporto: round2(d.pagato / d.listino), giocatori: d.n,
              spesoTotale: round1(d.pagato) }
          : null;
      });

      // Liquidita' trattenuta dagli avversari
      const liquidi = [];
      Object.keys(allTeams || {}).forEach((k) => {
        if (String(k) === String(mineKey)) return;
        const t = allTeams[k];
        const mancanti = 25 - (((t && t.players) || []).length);
        if (mancanti <= 0) return;
        liquidi.push({
          squadra: (t && t.name) || k,
          residuo: (t && t.budget) || 0,
          slotMancanti: mancanti,
          perSlot: round1(((t && t.budget) || 0) / mancanti)
        });
      });
      liquidi.sort((a, b) => b.perSlot - a.perSlot);
      const mediaPerSlot = liquidi.length
        ? liquidi.reduce((a, x) => a + x.perSlot, 0) / liquidi.length : 0;

      // Quanti avversari stanno chiaramente tenendo i soldi
      const affamati = liquidi.filter((x) => x.perSlot > mediaPerSlot * 1.3);

      const letture = [];
      ROLES.forEach((r) => {
        const i = inflazione[r];
        if (!i) return;
        if (i.rapporto >= 1.15) {
          letture.push('I ' + r + ' stanno andando al ' + Math.round(i.rapporto * 100) +
            '% del listino: chi li ha presi ha meno crediti per i reparti successivi.');
        } else if (i.rapporto <= 0.85) {
          letture.push('I ' + r + ' vanno al ' + Math.round(i.rapporto * 100) +
            '% del listino: il mercato li sta regalando.');
        }
      });
      if (affamati.length >= 2) {
        letture.push(affamati.length + ' avversari tengono molti crediti (' +
          affamati.map((x) => x.squadra + ' ' + x.perSlot + '/slot').join(', ') +
          '): stanno aspettando gli attaccanti. Nei reparti intermedi ' +
          'troverai meno concorrenza, approfittane adesso.');
      } else if (liquidi.length && mediaPerSlot < 8) {
        letture.push('Gli avversari hanno poca cassa (' + round1(mediaPerSlot) +
          ' a slot): in attacco ci sara\' meno concorrenza del solito, ' +
          'puoi permetterti di aspettare.');
      }

      return {
        inflazionePerReparto: inflazione,
        liquiditaAvversari: liquidi.slice(0, 4),
        mediaCreditiPerSlotAvversari: round1(mediaPerSlot),
        avversariCheAspettano: affamati.length,
        letture: letture
      };
    }

    /**
     * PASSO DI SPESA: rischio di restare con crediti in mano.
     *
     * Nell'asta sequenziale per reparto i crediti risparmiati in un reparto
     * restano disponibili per i successivi, ma quelli che avanzano alla fine
     * sono persi. Il problema non e' quasi mai una scelta: si subisce
     * l'andamento, si tiene qualcosa "per sicurezza" e a fine asta resta
     * una somma che non serve piu' a niente.
     *
     * Qui si proietta in avanti: ai prezzi correnti, quanto costera'
     * riempire gli slot che restano? Se costa molto meno di quanto ho,
     * il surplus va speso ORA, non alla fine, perche' nei reparti finali
     * i giocatori buoni saranno gia' andati.
     */
    passoSpesa(team, strategyKey, allTeams, allPlayers) {
      const st = this.rosterState(team);
      if (st.slotMancanti <= 0) {
        return { completo: true,
                 nota: 'Rosa completa.' +
                       (st.residuo > 0 ? ' Ti sono rimasti ' + st.residuo +
                        ' crediti non spesi.' : '') };
      }

      const pool = allPlayers || [];
      const presi = new Set();
      Object.values(allTeams || {}).forEach((t) =>
        ((t && t.players) || []).forEach((g) => presi.add(g.id)));
      const liberi = pool.filter((p) => !presi.has(p.id));

      // Costo realistico per completare: per ogni ruolo mancante prendo la
      // mediana dei prezzi di chi e' ancora libero, non il minimo teorico.
      const mediana = (arr) => {
        if (!arr.length) return 1;
        const a = arr.slice().sort((x, y) => x - y);
        return a[Math.floor(a.length / 2)];
      };
      let costoStimato = 0;
      const dettaglio = {};
      const squadre = Object.keys(allTeams || {}).length || 8;
      ROLES.forEach((r) => {
        const mancano = Math.max(0, this.roleLimits[r] - st.countByRole[r]);
        if (!mancano) { dettaglio[r] = 0; return; }
        const titolari = Math.max(0, (this.slotTitolari[r] || 0) - st.countByRole[r]);
        const panchina = mancano - titolari;

        /**
         * Gli slot da titolare non si riempiono con la mediana di tutti i
         * liberi: quelli buoni se li contendono 8 squadre. Se mi mancano N
         * titolari, i miei bersagli realistici stanno nei primi N x squadre
         * giocatori per prezzo, e li' dentro paghero' intorno alla mediana.
         */
        const candidati = liberi
          .filter((p) => normRole(p.role) === r && (p.expectedTitolarita || 0) >= 50)
          .sort((a, b) => (b.pma || 0) - (a.pma || 0));
        const fascia = candidati.slice(0, Math.max(1, titolari * squadre));
        const med = titolari > 0 ? mediana(fascia.map((p) => p.pma || 1)) : 0;

        const costo = titolari * med + panchina * this.prezzoPanchinaro;
        dettaglio[r] = round1(costo);
        costoStimato += costo;
      });

      const avanzo = st.residuo - costoStimato;
      const rischio = avanzo > st.residuo * 0.15 && avanzo > 25;

      return {
        completo: false,
        residuo: st.residuo,
        slotMancanti: st.slotMancanti,
        costoStimatoPerCompletare: round1(costoStimato),
        avanzoPrevisto: round1(avanzo),
        costoPerRuolo: dettaglio,
        rischioCreditiInutilizzati: rischio,
        nota: rischio
          ? 'Ai prezzi correnti ti bastano ~' + Math.round(costoStimato) +
            ' crediti per completare la rosa, ma ne hai ' + st.residuo +
            '. Rischi di finire con ~' + Math.round(avanzo) + ' crediti in mano, ' +
            'che sono persi. Alza le offerte ORA sui giocatori che vuoi ' +
            'davvero: piu\' avanti resteranno solo gli scarti.'
          : (avanzo < 0
              ? 'Attenzione al contrario: ai prezzi correnti completare la rosa ' +
                'costerebbe ~' + Math.round(costoStimato) + ' crediti e ne hai ' +
                st.residuo + '. Devi risparmiare da qui in avanti.'
              : 'Passo di spesa in equilibrio: ai prezzi correnti chiuderai ' +
                'con circa ' + Math.round(Math.max(0, avanzo)) + ' crediti di margine.')
      };
    }

    /** Rigoristi e specialisti dei piazzati liberi (gol e rigore valgono 3). */
    specialisti(availables, limit) {
      const P = this.punteggi;
      return availables
        .filter((p) => (p.setPieces || []).length > 0)
        .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
        .slice(0, limit || 8)
        .map((p) => {
          const c = this.playerCard(p);
          const sp = (p.setPieces || []).map((x) => String(x).toUpperCase());
          const rigorista = sp.some((x) => x.indexOf('RIGOR') !== -1);
          // penaltyProbability = probabilita' di essere il rigorista
          // DESIGNATO (per squadra somma ~100), non la percentuale di
          // realizzazione. Calcolarci sopra un valore atteso darebbe
          // numeri falsi.
          const quota = p.penaltyProbability;
          if (rigorista || (quota != null && quota >= 40)) {
            c.rigori = (quota != null && quota > 0)
              ? 'Tira i rigori nel ' + quota + '% dei casi (quota di squadra). ' +
                'Rigore segnato ' + P.rigoreSegnato + ', sbagliato ' +
                P.rigoreSbagliato + '.'
              : 'Indicato fra i rigoristi. Rigore segnato ' + P.rigoreSegnato +
                ', sbagliato ' + P.rigoreSbagliato + '.';
          }
          return c;
        });
    }

    /** Giocatori che il mercato paghera' molto piu' di quanto valgono. */
    trappole(availables, limit) {
      return availables
        .filter((p) => (p.pma || 0) >= 8 &&
                       p.valueScore !== null && p.valueScore !== undefined &&
                       p.valueScore < 30)
        .sort((a, b) => (a.valueScore || 0) - (b.valueScore || 0))
        .slice(0, limit || 8)
        .map((p) => this.playerCard(p));
    }

    // --------------------------------------------------------------- schede

    /** Scheda sintetica: quello che serve leggere mentre il banditore chiama. */
    playerCard(p) {
      return {
        id: p.id,
        nome: p.name,
        ruolo: p.role,
        squadra: p.team,
        tier: p.tierConsensus || p.tier,
        accordoFonti: p.tierAgreement,
        qualita: p.qualityScore,
        convenienza: p.valueScore,
        verdetto: p.verdict,
        prezzoMercato: p.pma,
        /**
         * In asta si offrono solo interi da 1 in su: un tetto tipo "0.7"
         * non e' un prezzo, si legge come un consiglio d'acquisto quando in
         * realta' vuol dire "non conviene comprarlo". Si arrotonda a 1 come
         * minimo offribile e si segnala con soloRiempitivo.
         */
        prezzoMaxConsigliato: (() => {
          const t = p.maxPriceLega !== undefined ? p.maxPriceLega : p.pfc;
          return (t != null && t < 1) ? 1 : t;
        })(),
        soloRiempitivo: (() => {
          const t = p.maxPriceLega !== undefined ? p.maxPriceLega : p.pfc;
          return t != null && t < 1;
        })(),
        titolarita: p.expectedTitolarita,
        fantamediaAttesa: p.expectedFantamedia,
        trend: p.trend,
        consistenza: p.consistency,
        affidabilitaDati: p.dataQuality,
        modificatore: p.modLabel || null,
        mediaVoto: p.modMediaVoto || p.mvStorica || null,
        piazzati: p.setPieces || [],
        /**
         * Rischi aggiuntivi calcolati qui (non nel listone originale):
         * nuovo arrivo e infortunio attivo. Costruiti insieme perche'
         * entrambi si appendono a p.risks nello stesso modo.
         */
        rischi: (() => {
          const extra = [...(p.risks || [])];
          // Cautela sui nuovi arrivati (dalla guida Fantaculo/Fantaredazione):
          // quasi nessuno rende al meglio il primo anno in Italia, nemmeno i
          // campioni assoluti (solo Shevchenko e Platini hanno vinto la
          // classifica cannonieri al primo anno, non ci e' riuscito neppure
          // Cristiano Ronaldo). Motivo diverso dalla cautela sui campioni
          // statistici piccoli: qui non manca il dato, manca l'adattamento
          // al campionato.
          if (p.newArrival) {
            extra.push('Nuovo arrivo in Serie A: adattamento incerto, ' +
              'anche i migliori raramente rendono al meglio il primo anno.');
          }
          // Infortuni (aggiornato all'8 settembre 2026, due fonti incrociate:
          // vedi infortuni_serie_a.js). File opzionale: se non caricato,
          // questo blocco semplicemente non aggiunge nulla.
          const inf = (typeof INFORTUNI_SERIE_A !== 'undefined' &&
                       INFORTUNI_SERIE_A.infortuni) ? INFORTUNI_SERIE_A.infortuni[p.id] : null;
          if (inf) {
            if (inf.statusIncerto) {
              extra.push('Infortunio: ' + inf.nota + ' (nessuna data di rientro ufficiale ancora).');
            } else if (inf.rientroStimato) {
              let riga = 'Infortunio (' + inf.motivo + '): rientro stimato ' +
                inf.rientroStimato + ' (fonte: ' + inf.fonteRientro + ').';
              if (inf.discordanza) {
                riga += ' ATTENZIONE: un\'altra fonte stima "' + inf.notaSecondaFonte +
                  '", scarto di ' + inf.discordanzaGiorni + ' giorni — nessuna delle due e\' certa.';
              }
              extra.push(riga);
            }
          }
          return extra;
        })(),
        livelloRischio: p.riskLevel
      };
    }

    /**
     * Altri giocatori dello stesso ruolo nella stessa squadra (es. titolare/vice).
     * Utile per portieri e attaccanti: la forza del singolo dipende anche
     * da chi gli sta dietro e da quanto tiene la squadra nel suo complesso.
     */
    compagniDiReparto(player, allPlayers, limit) {
      if (!player || !allPlayers) return [];
      // In asta contano i concorrenti reali per il posto: chi ha titolarita'
      // molto bassa non toglie minuti. Elencarli tutti (fino a 9 per gli
      // attacchi) e' rumore che allunga il report senza aggiungere nulla.
      const tutti = allPlayers
        .filter((p) => p.team === player.team &&
                       p.role === player.role &&
                       p.id !== player.id)
        .sort((a, b) => (b.expectedTitolarita || 0) - (a.expectedTitolarita || 0));

      const max = limit || 3;
      const out = tutti.slice(0, max).map((p) => ({
        nome: p.name,
        tier: p.tierConsensus || p.tier,
        titolarita: p.expectedTitolarita,
        verdetto: p.verdict,
        prezzoMercato: p.pma
      }));
      out.altriNonMostrati = Math.max(0, tutti.length - max);
      return out;
    }

    /** Scheda completa: quando stai decidendo se rilanciare. */
    schedaCompleta(player, allPlayers) {
      const c = this.playerCard(player);
      c.compagniDiReparto = this.compagniDiReparto(player, allPlayers);
      c.dettaglio = {
        fasciaFantaculo: player.fasciaFc,
        tierLaudantes: player.tierLaudantes,
        // Lo slot Laudantes ordina per PREZZO di mercato, non per media
        // voto: Buongiorno e' slot 8 ma ha la quinta media voto della
        // categoria. Utile come riferimento di mercato, inutile per il
        // modificatore. Non guida nessun calcolo.
        slotDiMercato: player.slot,
        tierLaudantesAnnoScorso: player.tierLaudantes_2526,
        movimentoTier: player.tierMovement,
        budgetSuggeritoLaudantes: player.tierBudgetPct,
        pfcOriginale: player.pfc,
        correzioneLega: player.leagueAdjustNote || 'nessuna',
        margineSulMercato: player.priceEdgePct !== undefined
          ? player.priceEdgePct + '%' : null,
        stagioniStoriche: player.seasonsUsed,
        fantamediaStorica: player.fmStorica,
        mediaVotoStorica: player.mvStorica,
        presenzeMedie: player.pvMedia,
        presenzeTotali: presenzeTotali(player),
        affidabilitaDato: affidabilita(player),
        avvisoCampione: avvisoCampione(player),
        componentiQualita: player.qualityBreakdown
      };
      c.giudizio = this.giudizio(player);
      return c;
    }

    /** Frase secca da leggere in asta. */
    giudizio(p) {
      const parti = [];
      const max = p.maxPriceLega !== undefined ? p.maxPriceLega : p.pfc;

      parti.push(p.name + ': ' + (p.verdict || 'dati insufficienti') + '.');
      if (max !== null && max !== undefined) {
        parti.push('Non superare ' + max + ' crediti' +
          (p.leagueAdjustNote ? ' (' + p.leagueAdjustNote + ')' : '') + '.');
      }
      if (p.pma !== null && p.pma !== undefined) {
        parti.push('Il mercato lo paga intorno a ' + p.pma + '.');
      }
      if (p.modBargain) parti.push(p.modBargainNote + '.');
      const avvC = avvisoCampione(p);
      if (avvC && (p.mvStorica != null || p.fmStorica != null)) {
        parti.push('Cautela sui numeri: ' + avvC + '.');
      }
      if ((p.setPieces || []).length) parti.push('Batte: ' + p.setPieces.join(', ') + '.');
      if (p.trend === 'CALANTE') parti.push('Rendimento in calo nelle ultime stagioni.');
      if (p.trend === 'CRESCENTE') parti.push('In crescita nelle ultime stagioni.');
      if (p.tierAgreement === 'DISACCORDO') {
        parti.push('Le due fonti lo valutano in modo molto diverso: dato incerto.');
      }
      if ((p.risks || []).length) parti.push('Attenzione: ' + p.risks.join('; ') + '.');
      if (!p.seasonsUsed) {
        parti.push('Nessuno storico utilizzabile in Serie A: solo proiezioni.');
      }
      return parti.join(' ');
    }

    /** Cerca un giocatore per nome, anche parziale. */
    findPlayer(allPlayers, query) {
      const k = nameKey(query);
      if (!k) return null;
      const list = allPlayers || [];
      return list.find((p) => nameKey(p.name) === k) ||
             list.find((p) => nameKey(p.name).indexOf(k) === 0) ||
             list.find((p) => nameKey(p.name).indexOf(k) !== -1) || null;
    }

    /**
     * Quanto posso offrire davvero, adesso, per questo giocatore.
     * Prende il piu' stringente fra tre tetti e dice quale sta mordendo.
     */
    quantoOffrire(player, team, strategyKey, allPlayers, allTeams, mineKey) {
      const st = this.rosterState(team);
      const analysis = this.analyzeTeam(team, strategyKey);
      const role = normRole(player.role);
      const a = analysis[role];
      const max = player.maxPriceLega !== undefined ? player.maxPriceLega : player.pfc;

      const limiti = [];
      if (max !== null && max !== undefined) {
        limiti.push({ fonte: 'valore del giocatore nella tua lega', tetto: max });
      }
      limiti.push({
        fonte: 'crediti disponibili tenendone 1 per ogni altro slot',
        tetto: st.maxOffertaOra
      });
      if (a && a.needed > 0) {
        limiti.push({
          fonte: 'budget del ruolo ' + role + ' secondo la strategia',
          tetto: Math.max(0, a.budgetResiduoRuolo - Math.max(0, a.needed - 1))
        });
      }

      const vincolante = limiti.reduce((m, l) => (l.tetto < m.tetto ? l : m), limiti[0]);
      const offerta = Math.max(0, Math.floor(vincolante.tetto));

      /**
       * Soglia di rendimento marginale.
       * In attacco il rendimento cala col prezzo (~+0.24 di fantamedia per
       * raddoppio). Intorno ai 115 crediti il credito successivo rende quanto
       * renderebbe speso altrove: oltre quella soglia conviene fermarsi.
       * Non e' un divieto, e' un promemoria nel momento del rilancio.
       */
      const sogliaRendimento = (role === 'ATT' && offerta > 115)
        ? 'Sopra i ~115 crediti il rendimento marginale di una punta scende ' +
          'sotto quello di rinforzare un altro reparto. Puoi arrivarci, ma ' +
          'sappi che ogni credito oltre quella soglia rende poco.'
        : null;

      /**
       * I listoni non conoscono il modificatore difesa. Un giocatore che fa
       * salire di scaglione porta un bonus fisso OGNI giornata: mezzo punto
       * per 38 giornate sono ~19 punti, che a scontri diretti valgono circa
       * 2.5 punti di classifica. Su di lui conviene spingersi oltre il tetto
       * nominale, e l'agente deve dirlo.
       */
      let premioModificatore = null;
      let offertaConsigliata = offerta;
      if (this.defenseModifier && (role === 'DIF' || role === 'POR') &&
          Array.isArray(allPlayers) && allPlayers.length) {
        const im = this.impattoSulModificatore(player, team, allPlayers);
        if (im && im.applicabile && im.variazioneBonus > 0) {
          const puntiStagione = Math.round(im.variazioneBonus * 38);
          offertaConsigliata = offerta + Math.max(3, Math.round(puntiStagione / 2));
          premioModificatore = 'Ti fa salire di scaglione: +' + im.variazioneBonus +
            ' a giornata, circa ' + puntiStagione + ' punti stagione. ' +
            'I listoni non lo sanno, quindi su di lui puoi arrivare a ' +
            offertaConsigliata + ' invece di ' + offerta + '.';
        } else if (im && im.applicabile && im.variazioneMedia === 0) {
          premioModificatore = 'Non entrerebbe fra i tuoi migliori 3: ' +
            'per il modificatore non ti serve.';
        }
      }

      /**
       * TETTI DI PRUDENZA.
       *
       * Il tetto dei listoni dice quanto vale un giocatore sul mercato, non
       * quanto conviene a me spenderci sopra. Due correzioni:
       *
       * 1) Dato inaffidabile. Pagare 189 crediti un attaccante con 20
       *    presenze significa comprare una fantamedia che potrebbe essere
       *    un caso. Si taglia l'offerta in proporzione a quanto poco si sa.
       *
       * 2) Soglia di rendimento in attacco. Oltre ~115 crediti il credito
       *    successivo rende meno che altrove. Concentrare comunque ha senso
       *    SOLO se sono sotto la media della lega, perche' a scontri diretti
       *    la varianza aiuta chi insegue e danneggia chi guida. Quindi la
       *    decisione dipende dal profilo di rischio, non e' fissa.
       */
      /**
       * Le note che seguono AVVERTONO ma non tagliano l'offerta.
       * Un tetto automatico su un giocatore che il mercato considera
       * irrinunciabile fa perdere l'asta invece di farla vincere: la
       * decisione resta all'utente, che conosce il campo meglio del modello.
       */
      let cautela = null;
      const aff = affidabilita(player);
      if (aff !== 'solida' && offertaConsigliata > 20) {
        const n = presenzeTotali(player);
        const prudente = Math.floor(offertaConsigliata *
                                    Math.max(0.35, Math.min(1, n / PRESENZE_AFFIDABILI)));
        cautela = 'Solo ' + n + ' presenze in archivio: la sua media puo\' essere ' +
          'un caso. Un prezzo prudente sarebbe ' + prudente + ', ma se il mercato ' +
          'lo considera sicuro il sovrapprezzo puo\' avere senso: decidi tu.';
      }

      /**
       * CORRETTIVO PREZZI DI LEGA.
       *
       * Il tetto sopra viene dal listino nazionale, che non sa come si
       * comporta QUESTA lega in particolare. Confrontando il prezzo pagato
       * storicamente per lo stesso tier/ruolo nelle aste di Fantalissandria
       * col listino di oggi, si vede se il tetto nazionale e' tarato bene
       * per questa lega o no — ad esempio i difensori A- valgono qui 2.6x
       * il listino nazionale, coerente col fatto che il modificatore li
       * rivaluta rispetto a una lega generica che non ce l'ha.
       *
       * E' un'informazione, non una correzione automatica del tetto: la
       * baseline storica viene da appena 3 stagioni, campione piccolo per
       * essere presa come verita' assoluta.
       */
      let correttivoLega = null;
      if (typeof STORICO_MANAGER !== 'undefined' && STORICO_MANAGER.correttivoPrezzoPerTier &&
          player.tierLaudantes) {
        const chiave = role + '_' + player.tierLaudantes;
        const c = STORICO_MANAGER.correttivoPrezzoPerTier[chiave];
        if (c) {
          correttivoLega = c.rapporto > 1
            ? 'In questa lega gli ' + player.tierLaudantes + ' ' + role +
              ' sono andati storicamente piu\' cari del listino nazionale ' +
              '(mediana pagata qui ' + c.prezzoStoricoLega + ' contro ' +
              c.prezzoOggi + ' di listino, su ' + c.nCampioneOggi +
              ' giocatori attuali): non stupirti se serve piu\' del tetto.'
            : 'In questa lega gli ' + player.tierLaudantes + ' ' + role +
              ' sono andati storicamente piu\' economici del listino ' +
              'nazionale (mediana pagata qui ' + c.prezzoStoricoLega +
              ' contro ' + c.prezzoOggi + ' di listino): puo\' bastare meno del tetto.';

          /**
           * Affidabilita' verificata l'8 settembre 2026 (vedi mappa_dati_
           * players.md paragrafo 12): la FASCIA LARGA (S/A++/A+ contro
           * B/C) predice bene il rendimento reale su tutte e tre le
           * stagioni storiche. I sotto-tier di mezzo (A, A-, A--, B+, B,
           * B-) si sovrappongono o si invertono in due stagioni su tre —
           * il confronto sopra usa uno di questi sotto-tier specifici,
           * quindi vale ma con meno certezza di quanto sembri da un
           * singolo numero.
           */
          const TIER_AMBIGUI = ['A', 'A-', 'A--', 'B+', 'B', 'B-'];
          if (TIER_AMBIGUI.includes(player.tierLaudantes)) {
            correttivoLega += ' (attenzione: ' + player.tierLaudantes +
              ' e\' un sotto-tier di mezzo, storicamente meno affidabile ' +
              'della fascia larga alta/bassa.)';
          }
        }
      }

      if (role === 'ATT' && offertaConsigliata > 115) {
        const pr = allTeams ? this.profiloRischio(team, allTeams, mineKey, allPlayers) : null;
        const inseguo = pr && pr.valutabile && pr.posizione === 'sotto la media';
        cautela = (cautela ? cautela + ' ' : '') +
          (inseguo
            ? 'Sopra i 115 crediti il rendimento marginale cala, ma sei sotto la ' +
              'media della lega: a scontri diretti concentrare su un fuoriclasse ' +
              'e\' la scelta giusta.'
            : 'Sopra i 115 crediti ogni credito in piu\' rende meno che altrove. ' +
              'Se lo prendi comunque, sappi che stai comprando sicurezza, non resa: ' +
              'e su un bomber indiscusso puo\' essere il prezzo giusto.');
      }

      /**
       * CREDITI NON SPESI = CREDITI PERSI.
       *
       * I tetti di prudenza servono a non strapagare un giocatore, ma non
       * devono far chiudere l'asta con crediti in cassa: non si riportano.
       * Se il budget residuo per slot supera l'offerta consigliata, il
       * vincolo vero non e' piu' il valore del giocatore ma il dovere di
       * spendere quello che si ha.
       */
      const stB = this.rosterState(team);
      // Il surplus va misurato sul budget del REPARTO, non su tutta la cassa:
      // altrimenti nella fase portieri vede i crediti destinati all'attacco
      // e li spende li', sfondando il piano proprio dove andava risparmiato.
      const bfS = this.budgetFase(team, strategyKey, allTeams, role);
      const perSlot = (bfS && bfS.slotMancantiInFase > 0)
        ? bfS.spendibileSenzaSforare / bfS.slotMancantiInFase
        : 0;
      let surplus = null;
      if (perSlot > 0 && offertaConsigliata >= 1 &&
          perSlot > offertaConsigliata * 1.3) {
        const sostenibile = Math.min(stB.maxOffertaOra, Math.floor(perSlot * 1.5));
        if (sostenibile > offertaConsigliata) {
          surplus = 'Nel reparto ' + role + ' hai ' +
            Math.round(bfS.spendibileSenzaSforare) + ' crediti per ' +
            bfS.slotMancantiInFase + ' slot (' + round1(perSlot) + ' a slot): ' +
            'tenerli in cassa non serve a niente. Su di lui puoi arrivare a ' +
            sostenibile + '.';
          offertaConsigliata = sostenibile;
        }
      }

      return {
        giocatore: player.name,
        ruolo: role,
        offertaMassima: offerta,
        offertaConsigliata: offertaConsigliata,
        premioModificatore: premioModificatore,
        cautela: cautela,
        correttivoLega: correttivoLega,
        surplus: surplus,
        // In asta il minimo e' 1 credito: un tetto sotto 1 non e' un prezzo,
        // e' un "non comprarlo". Mostrare 0 confonde.
        nonConviene: offerta < 1
          ? 'Tetto sensato sotto 1 credito: non vale la pena, se non come ' +
            'riempitivo obbligato a 1.'
          : null,
        /**
         * Perche' il tetto e' cosi' basso rispetto al mercato.
         * Il modello sconta pesantemente chi ha poco storico: e' prudenza,
         * non un giudizio sul giocatore. Va detto, altrimenti si perdono
         * occasioni su giovani che il mercato paga e che possono valere.
         */
        perTettoBasso: (player.pma > 3 && offerta < player.pma * 0.4)
          ? (presenzeTotali(player) < PRESENZE_MINIME
              ? 'Tetto molto sotto il mercato (' + player.pma + ') perche\' non ' +
                'ha storico utilizzabile in Serie A: il modello e\' prudente per ' +
                'forza. Se lo conosci e credi valga di piu\', fidati del tuo occhio.'
              : 'Tetto molto sotto il mercato (' + player.pma + '): i suoi numeri ' +
                'non giustificano il prezzo di listino.')
          : null,
        vincoloAttivo: vincolante.fonte,
        sogliaRendimento: sogliaRendimento,
        tuttiILimiti: limiti,
        slotRimanentiNelRuolo: a ? a.needed : null,
        verdetto: player.verdict,
        giudizio: this.giudizio(player)
      };
    }

    // ------------------------------------------------------------ avversari

    /**
     * Deduce la strategia di un avversario.
     * In asta a reparti le quote di spesa per ruolo sono imposte dal formato
     * (durante la fase POR tutti hanno speso il 100% in portieri), quindi
     * confrontarle con le strategie non dice nulla. Il segnale vero e' quanta
     * parte del BUDGET TOTALE ha impegnato nei reparti gia' chiusi.
     */
    /**
     * PROFILO STORICO DEL MANAGER (opzionale).
     *
     * Legge STORICO_MANAGER se e' stato caricato (file separato, non
     * obbligatorio: senza di esso l'agente funziona come prima, dedotto
     * solo dal comportamento in diretta). Il confronto e' per nome squadra,
     * case-insensitive: se in questa asta il manager ha chiamato la sua
     * squadra con un nome diverso da quello storico, non lo trova, e va
     * bene cosi' — meglio nessun dato che un aggancio sbagliato.
     */
    profiloStoricoManager(nomeSquadra) {
      const store = (typeof STORICO_MANAGER !== 'undefined') ? STORICO_MANAGER
                   : (typeof window !== 'undefined' ? window.STORICO_MANAGER : null);
      if (!store || !nomeSquadra) return null;

      const norm = (s) => String(s || '').toUpperCase().trim().replace(/\s+/g, ' ');
      const chiave = Object.keys(store.manager).find((k) => norm(k) === norm(nomeSquadra));
      if (!chiave) return null;

      const p = store.manager[chiave];
      const media = store.mediaLega.quotePerRuolo;
      const ROLE_NAME = { P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT' };

      // Segnalo solo gli scarti che contano: sopra 6 punti percentuali di
      // differenza dalla media lega, altrimenti e' rumore.
      const scarti = [];
      Object.keys(media).forEach((r) => {
        const diff = p.quoteMediePesate[r] - media[r];
        if (Math.abs(diff) >= 6) {
          scarti.push(ROLE_NAME[r] + ' ' + p.quoteMediePesate[r] + '% (' +
                     (diff > 0 ? '+' : '') + round1(diff) + ' vs media lega)');
        }
      });

      const concDiff = p.concentrazioneMediaPesata - store.mediaLega.concentrazioneTop3;
      let notaConcentrazione = null;
      if (concDiff >= 8) {
        notaConcentrazione = 'concentra molto sui primi acquisti (' +
          p.concentrazioneMediaPesata + '% del budget sui primi 3, media lega ' +
          store.mediaLega.concentrazioneTop3 + '%): punta su pochi fuoriclasse.';
      } else if (concDiff <= -8) {
        notaConcentrazione = 'spalma la spesa (' + p.concentrazioneMediaPesata +
          '% sui primi 3, media lega ' + store.mediaLega.concentrazioneTop3 +
          '%): raramente fa un acquisto sproporzionato.';
      }

      /**
       * Sovrapprezzo per ruolo: quanto paga rispetto al prezzo mediano di
       * lega per quel tier, storicamente. Un manager puo' risultare "nella
       * norma" in generale ma nascondere due comportamenti opposti che si
       * compensano (visto con Antonio: sovrapprezzo forte in attacco 1.46,
       * occasioni nette a centrocampo 0.54 — la media dei due sarebbe 1.00,
       * un falso "nella norma" che nasconde l'informazione utile). Per
       * questo il dettaglio e' per ruolo, non un indice unico.
       */
      const noteSovrapprezzo = [];
      const perRuolo = p.indiceSovrapprezzoPerRuolo || {};
      Object.keys(perRuolo).forEach((r) => {
        const idx = perRuolo[r].indice;
        if (idx >= 1.2) {
          noteSovrapprezzo.push(r + ': sovrapprezzo (paga in media il ' +
            Math.round((idx - 1) * 100) + '% sopra il prezzo giusto per il tier)');
        } else if (idx <= 0.8) {
          noteSovrapprezzo.push(r + ': prende occasioni (paga in media il ' +
            Math.round((1 - idx) * 100) + '% sotto il prezzo giusto per il tier)');
        }
      });

      return {
        manager: chiave,
        stagioniDisponibili: p.stagioniDisponibili,
        quoteStoriche: p.quoteMediePesate,
        scartiRilevanti: scarti,
        notaConcentrazione: notaConcentrazione,
        sovrapprezzoPerRuolo: perRuolo,
        noteSovrapprezzo: noteSovrapprezzo,
        nota: scarti.length || notaConcentrazione || noteSovrapprezzo.length
          ? ('Storico (' + p.stagioniDisponibili.length + ' stagioni): ' +
             [...scarti, notaConcentrazione, ...noteSovrapprezzo].filter(Boolean).join('; '))
          : ('Storico (' + p.stagioniDisponibili.length +
             ' stagioni): nessuno scostamento marcato dalla media lega.')
      };
    }

    inferOpponentStrategy(team, key) {
      const players = (team && team.players) || [];
      const nome = (team && team.name) || ('Squadra ' + (key !== undefined ? key : '?'));
      const storico = this.profiloStoricoManager(nome);

      if (!players.length) {
        return { squadra: nome, strategy: 'NESSUN ACQUISTO', confidence: 0,
                 acquisti: 0, repartiChiusi: [], quotePerRuolo: {}, residuo: this.budgetTotal,
                 storico: storico };
      }

      const st = this.rosterState(team);
      const quote = {};
      ROLES.forEach((r) => {
        quote[r] = round1((st.spentByRole[r] / this.budgetTotal) * 100);
      });

      // Solo i reparti gia' completati sono confrontabili: sugli altri
      // la spesa e' ancora in corso e il dato e' parziale per costruzione.
      const chiusi = ROLES.filter((r) => st.countByRole[r] >= this.roleLimits[r]);

      if (!chiusi.length) {
        return {
          squadra: nome, strategy: 'TROPPO PRESTO PER DIRLO', confidence: 0,
          acquisti: players.length, residuo: st.residuo,
          repartiChiusi: [], quotePerRuolo: quote,
          nota: 'Nessun reparto ancora completato da questa squadra.' +
                (storico ? ' ' + storico.nota : ''),
          storico: storico
        };
      }

      let best = null, bestDist = Infinity, secondDist = Infinity;
      Object.keys(this.strategies).forEach((k) => {
        const cfg = this.strategies[k];
        const dist = chiusi.reduce(
          (d, r) => d + Math.abs(quote[r] - cfg[r] * 100), 0);
        if (dist < bestDist) { secondDist = bestDist; bestDist = dist; best = cfg; }
        else if (dist < secondDist) { secondDist = dist; }
      });

      // La confidenza cresce con i reparti chiusi e con quanto la strategia
      // vincente stacca la seconda: se due strategie spiegano i dati
      // altrettanto bene, la deduzione vale poco.
      const copertura = chiusi.length / ROLES.length;
      const aderenza = Math.max(0, 1 - bestDist / 20);
      const distacco = (isFinite(secondDist) && secondDist > 0)
        ? Math.min(1, (secondDist - bestDist) / secondDist) : 0.5;
      const confidence = Math.round(100 * copertura * aderenza * (0.5 + 0.5 * distacco));

      return {
        squadra: nome,
        strategy: confidence < 50 ? 'INDIZI DEBOLI' : best.name,
        ipotesi: best.name,
        confidence: confidence,
        acquisti: players.length,
        residuo: st.residuo,
        repartiChiusi: chiusi,
        quotePerRuolo: quote,
        dettaglio: chiusi.map((r) =>
          r + ' ' + quote[r] + '% (attesi ' + round1(best[r] * 100) + '%)').join(', '),
        storico: storico
      };
    }

    /** Chi ha ancora soldi: dice quanto rischi di essere rilanciato. */
    pressioneMercato(allTeams, myTeamNum) {
      const rivali = [];
      Object.keys(allTeams || {}).forEach((k) => {
        if (String(k) === String(myTeamNum)) return;
        const t = allTeams[k];
        const st = this.rosterState(t);
        rivali.push({
          squadra: (t && t.name) || ('Squadra ' + k),
          residuo: st.residuo,
          slotMancanti: st.slotMancanti,
          maxOfferta: st.maxOffertaOra,
          rosaCompleta: st.slotMancanti === 0
        });
      });
      rivali.sort((a, b) => b.maxOfferta - a.maxOfferta);
      const attivi = rivali.filter((r) => !r.rosaCompleta);
      return {
        rivali: rivali,
        rilancioMassimoAvversario: attivi.length ? attivi[0].maxOfferta : 0,
        avversariConRosaCompleta: rivali.length - attivi.length
      };
    }

    // --------------------------------------------------------------- report

    consiglioPrincipale(team, strategyKey, availables, fase) {
      const st = this.rosterState(team);
      const analysis = this.analyzeTeam(team, strategyKey);

      if (st.slotMancanti === 0) {
        return { icon: '\u2705', titolo: 'ROSA COMPLETA',
                 testo: 'Hai completato tutti i ruoli.' };
      }
      if (st.creditiPerSlot < 2) {
        return { icon: '\u{1F534}', titolo: 'CHIUDI AL MINIMO',
                 testo: 'Restano ' + st.residuo + ' crediti per ' + st.slotMancanti +
                        ' slot. Punta solo su titolari da 1 credito: nei ruoli ' +
                        'scoperti cerca chi ha titolarita alta e prezzo minimo.' };
      }

      // L'asta e' sequenziale per reparto: l'unico ruolo su cui si puo'
      // agire adesso e' quello in fase. Consigliare altri ruoli sarebbe
      // suggerire mosse che il regolamento non consente.
      let urgente = null;
      if (fase && analysis[fase] && analysis[fase].needed > 0) {
        urgente = fase;
      } else if (fase && analysis[fase] && analysis[fase].needed === 0) {
        const prossimo = ROLES[ROLES.indexOf(fase) + 1];
        return {
          icon: '\u23F8\uFE0F', titolo: 'REPARTO ' + fase + ' COMPLETATO',
          testo: 'Hai gia\' i tuoi ' + this.roleLimits[fase] + ' ' + fase +
                 '. Devi attendere che anche le altre squadre completino il ' +
                 'reparto prima di passare' +
                 (prossimo ? ' ai ' + prossimo : ' oltre') +
                 '. Usa il tempo per studiare i prossimi reparti.'
        };
      } else {
        // Nessuna fase nota: ripiego sul ruolo piu' teso.
        let peggiore = -Infinity;
        ROLES.forEach((r) => {
          const a = analysis[r];
          if (a.needed === 0) return;
          const tensione = a.needed - (a.budgetResiduoRuolo / 10);
          if (tensione > peggiore) { peggiore = tensione; urgente = r; }
        });
      }

      if (urgente) {
        const a = analysis[urgente];

        // Stesso filtro degli obiettivi: il consiglio deve rispettare il
        // budget dello slot in corso, non tutta la cassa disponibile.
        const bf = this.budgetFase(team, strategyKey, null, urgente);
        let tetto = st.maxOffertaOra;
        let qualeSlot = '';
        if (bf && bf.fase === urgente) {
          if (bf.titolariMancanti > 0 && bf.budgetPerTitolare >= 1) {
            tetto = Math.min(tetto, Math.ceil(bf.budgetPerTitolare * 1.4));
            qualeSlot = ' Ti restano ' + bf.titolariMancanti +
                        ' slot da titolare (~' + bf.budgetPerTitolare +
                        ' crediti l\'uno) e ' + bf.panchinariMancanti +
                        ' da panchina (1-2 crediti).';
          } else if (bf.budgetRuoloEsaurito) {
            tetto = Math.min(tetto, 3);
            qualeSlot = ' Hai finito il budget del reparto ma ti mancano ancora ' +
                        bf.titolariMancanti + ' titolari: o sfori, o chiudi a ' +
                        '1-2 crediti e recuperi nei reparti successivi.';
          } else if (bf.panchinariMancanti > 0) {
            tetto = Math.min(tetto, 3);
            qualeSlot = ' I titolari li hai gia\' presi: restano ' +
                        bf.panchinariMancanti +
                        ' slot da panchina, da chiudere a 1-2 crediti.';
          }
        }

        const cand = this.bestValue(availables, {
          role: urgente, maxSpesa: tetto, limit: 3,
          criterio: (bf && bf.fase === urgente && bf.titolariMancanti === 0)
                    ? 'efficienza' : 'resa'
        });
        const nomi = cand.map((c) => c.nome + ' (' +
                     (c.soloRiempitivo ? 'solo riempitivo a 1' : 'max ' + c.prezzoMaxConsigliato) +
                     ')').join(', ');
        return {
          icon: '\u{1F3AF}', titolo: 'PRIORITA: ' + urgente,
          testo: 'Ti mancano ' + a.needed + ' ' + urgente + ' con ' +
                 a.budgetResiduoRuolo + ' crediti di budget di ruolo.' +
                 qualeSlot + ' ' +
                 (nomi ? 'Obiettivi con buon rapporto qualita/prezzo: ' + nomi + '.'
                       : 'Nessun candidato in questa fascia di prezzo tra i disponibili.')
        };
      }
      return { icon: '\u2139\uFE0F', titolo: 'SITUAZIONE STABILE',
               testo: 'Budget e ruoli in linea con la strategia.' };
    }

    /**
     * Traduce le crocette osservate al tavolo in un fattore di pressione.
     * Serve a distinguere gli avversari che rilanciano davvero da quelli
     * che sono affamati solo sulla carta.
     */
    pesoAvversario(nota) {
      const pattern = (nota && nota.pattern) || [];
      if (!pattern.length) return 1;
      // Il comportamento piu' estremo domina: chi compra solo al minimo
      // non torna competitivo perche' ogni tanto rilancia.
      let peso = 1;
      pattern.forEach((p) => {
        const def = PATTERN_AVVERSARI[p];
        if (!def) return;
        if (Math.abs(def.peso - 1) > Math.abs(peso - 1)) peso = def.peso;
      });
      return peso;
    }

    /** Etichette leggibili dei pattern marcati su una squadra. */
    etichettePattern(nota) {
      return ((nota && nota.pattern) || [])
        .map((p) => PATTERN_AVVERSARI[p] && PATTERN_AVVERSARI[p].label)
        .filter(Boolean);
    }

    // ------------------------------------------------- asta per reparto

    /**
     * L'asta e' sequenziale per ruolo: si passa al reparto successivo solo
     * quando TUTTE le squadre hanno completato quello corrente.
     * Restituisce la fase in corso e quanto manca a chiuderla.
     */
    faseCorrente(allTeams) {
      const keys = Object.keys(allTeams || {});
      if (!keys.length) {
        return { fase: 'POR', completa: false, slotTotali: 0, slotRiempiti: 0,
                 slotResidui: 0, percentuale: 0, faseSuccessiva: 'DIF',
                 prontaAlCambio: false };
      }

      for (let i = 0; i < ROLES.length; i++) {
        const role = ROLES[i];
        const limite = this.roleLimits[role];
        let riempiti = 0;
        keys.forEach((k) => {
          const st = this.rosterState(allTeams[k]);
          riempiti += Math.min(limite, st.countByRole[role]);
        });
        const totali = limite * keys.length;
        if (riempiti < totali) {
          return {
            fase: role,
            completa: false,
            slotTotali: totali,
            slotRiempiti: riempiti,
            slotResidui: totali - riempiti,
            percentuale: Math.round((riempiti / totali) * 100),
            faseSuccessiva: ROLES[i + 1] || null,
            prontaAlCambio: false
          };
        }
      }

      return { fase: null, completa: true, slotTotali: 0, slotRiempiti: 0,
               slotResidui: 0, percentuale: 100, faseSuccessiva: null,
               prontaAlCambio: true, messaggio: 'Tutte le rose sono complete.' };
    }

    /**
     * Il cuore della strategia in asta a reparti: quante squadre devono
     * ancora comprare in questa fase, e quanti giocatori restano per fascia.
     * Con questi due numeri si decide se un nome va chiamato subito o atteso.
     */
    scarsitaFase(allTeams, allPlayers, faseOverride, note) {
      const info = this.faseCorrente(allTeams);
      const fase = faseOverride || info.fase;
      if (!fase) return { fase: null, completa: true };

      const N = note || {};
      const limite = this.roleLimits[fase];
      const affamate = [];
      Object.keys(allTeams || {}).forEach((k) => {
        const t = allTeams[k];
        const st = this.rosterState(t);
        const mancanti = Math.max(0, limite - st.countByRole[fase]);
        if (mancanti > 0) {
          const nt = N[k] || N[String(k)];
          affamate.push({
            squadra: (t && t.name) || ('Squadra ' + k),
            chiave: k,
            mancanti: mancanti,
            residuo: st.residuo,
            // Quanto puo' davvero offrire ORA: i crediti che gli restano
            // meno 1 per ogni altro slot che dovra' comunque riempire.
            maxOfferta: st.maxOffertaOra,
            peso: this.pesoAvversario(nt),
            osservazioni: this.etichettePattern(nt),
            nota: (nt && nt.testo) || null
          });
        }
      });
      affamate.sort((a, b) => b.maxOfferta - a.maxOfferta);

      // Quante squadre rilanceranno DAVVERO, non solo sulla carta.
      const competitive = affamate.filter((a) => a.peso >= 0.5);
      const pressioneReale = round1(affamate.reduce((s, a) => s + a.peso, 0));

      const liberi = this.availablePlayers(allPlayers, allTeams)
        .filter((p) => normRole(p.role || p.roleShort) === fase);

      const perFascia = {};
      TIER_ORDER.forEach((t) => { perFascia[t] = 0; });
      liberi.forEach((p) => {
        const t = p.tierConsensus || p.tier;
        if (perFascia[t] !== undefined) perFascia[t] += 1;
      });

      // Quanti restano "di livello almeno X": e' il numero che conta,
      // perche' chi cerca un A+ ripiega volentieri su un A.
      const cumulativi = {};
      let acc = 0;
      TIER_ORDER.forEach((t) => { acc += perFascia[t]; cumulativi[t] = acc; });

      const domandaTotale = affamate.reduce((s, a) => s + a.mancanti, 0);
      const fasciaAlta = perFascia['A+'] + perFascia['A'];

      return {
        fase: fase,
        completamento: info.percentuale,
        slotResidui: info.slotResidui,
        squadreAffamate: affamate,
        numeroSquadreAffamate: affamate.length,
        // Con le note compilate questo e' il numero che conta: quante
        // rilanciano sul serio. Senza note coincide con le affamate.
        squadreCompetitive: competitive.length,
        pressioneReale: pressioneReale,
        noteCompilate: affamate.some((a) => a.osservazioni.length || a.nota),
        domandaTotale: domandaTotale,
        offertaTotale: liberi.length,
        rapportoDomandaOfferta: liberi.length > 0
          ? round1(domandaTotale / liberi.length) : null,
        liberiPerFascia: perFascia,
        liberiAlmenoFascia: cumulativi,
        rilancioMassimoRealistico: competitive.length
          ? competitive[0].maxOfferta
          : (affamate.length ? affamate[0].maxOfferta : 0),
        tensioneFasciaAlta: affamate.length > 0 && fasciaAlta < affamate.length,
        nota: affamate.length === 0
          ? 'Nessuna squadra deve ancora comprare in questo reparto.'
          : (fasciaAlta === 0
              ? 'Fascia alta (A+ e A) esaurita: restano solo A- e sotto. ' +
                'Nessuna asta al rialzo attesa, punta sul rapporto qualita/prezzo.'
              : (fasciaAlta < affamate.length
                  ? fasciaAlta + ' giocatori di fascia alta per ' + affamate.length +
                    ' squadre affamate: ' +
                    ((affamate.length - fasciaAlta) === 1
                      ? 'una restera\' senza'
                      : (affamate.length - fasciaAlta) + ' resteranno senza') +
                    '. Aste al rialzo probabili.'
                  : (fasciaAlta === affamate.length
                      ? 'Fascia alta in equilibrio esatto (' + fasciaAlta + ' per ' +
                        affamate.length + ' squadre): margine zero, non temporeggiare.'
                      : 'Fascia alta abbondante (' + fasciaAlta + ' per ' +
                        affamate.length + ' squadre): puoi attendere.')))
      };
    }

    /**
     * PIANO FASCE DENTRO IL RUOLO.
     *
     * Il budget di ruolo (es. "9% alla difesa") dice quanto spendere in
     * totale, ma non come dividerlo fra i titolari: un top da 40 e tre
     * onesti da 3 hanno la stessa media di un quartetto omogeneo da 12,5
     * l'uno, ma sono due strategie diverse. Questo colma quel buco.
     *
     * Il criterio: parte dal tier piu' alto (A+) per il primo slot e
     * scende, MA solo se dopo aver preso quel tier resta budget
     * sufficiente a coprire tutti gli slot restanti almeno al tier piu'
     * economico (C) — altrimenti scende subito, per non promettere un
     * top e poi restare senza soldi per completare il reparto.
     *
     * BASELINE_PREZZO_TIER viene dal prezzo mediano REALE (pma) di
     * questo listone per ruolo+tierConsensus (tutti i 531 giocatori,
     * soglia minima 3 osservazioni per cella). Incrociato con le fasce
     * di prezzo di Laudantes (tierBudgetPct, dove esiste: solo DIF e
     * CEN) per verifica: coincidono bene (es. DIF A+ noi 5.4% del
     * budget, Laudantes dice 3-9%; CEN A+ noi 9.2%, Laudantes 6-13%).
     * Laudantes non copre POR e ATT: per quei ruoli la baseline e'
     * solo quella calcolata qui.
     */
    BASELINE_PREZZO_TIER = {
      POR: { 'A+': 32, A: 2.2, 'A-': 1.3, B: 0.8, C: 0.9 },
      DIF: { 'A+': 27, A: 12.6, 'A-': 4.8, 'A--': 1.4, B: 1.2, C: 1 },
      CEN: { 'A+': 46, A: 25.4, 'A-': 8.4, 'A--': 2.7, B: 1.2, C: 1 },
      ATT: { 'A+': 130.5, A: 61.3, 'A-': 22.5, 'A--': 7.4, B: 1.2, C: 1.1 }
    };

    /**
     * Cuore condiviso dell'assegnazione fasce: dato un budget e un numero
     * di slot da riempire, scende dal tier piu' alto finche' non trova
     * quello che lascia abbastanza per finire tutti gli slot restanti al
     * tier minimo. Usata sia per il piano "da zero" (pianoFasce) sia per
     * "cosa mi manca adesso" (prossimaFasciaConsigliata) — stessa logica,
     * cambia solo il budget/slot di partenza.
     */
    assegnaFasce(residuoIniziale, numSlot, prezzi) {
      const tierDisponibili = TIER_ORDER.filter((t) => prezzi[t] != null);
      const tierMinimo = tierDisponibili[tierDisponibili.length - 1];
      const prezzoMinimo = prezzi[tierMinimo] || 1;
      let residuo = residuoIniziale;

      const assegnati = [];
      for (let slot = 0; slot < numSlot; slot++) {
        const slotRestantiDopo = numSlot - slot - 1;
        let scelto = tierMinimo;
        for (const t of tierDisponibili) {
          const costo = prezzi[t];
          const bastaPerIlResto = residuo - costo >= slotRestantiDopo * prezzoMinimo;
          if (costo <= residuo && bastaPerIlResto) { scelto = t; break; }
        }
        assegnati.push({ tier: scelto, prezzoStimato: prezzi[scelto] || prezzoMinimo });
        residuo -= (prezzi[scelto] || prezzoMinimo);
      }
      return { assegnazioni: assegnati, residuoFinale: residuo };
    }

    descriviFasce(assegnazioni) {
      const conteggio = {};
      assegnazioni.forEach((a) => { conteggio[a.tier] = (conteggio[a.tier] || 0) + 1; });
      return TIER_ORDER
        .filter((t) => conteggio[t])
        .map((t) => conteggio[t] + 'x ' + t)
        .join(' + ');
    }

    pianoFasce(role, strategyKey) {
      const strat = this.strategies[strategyKey] || this.strategies.bilanciata;
      const budgetRuolo = this.budgetTotal * strat[role];
      const titolari = this.slotTitolari[role] || this.roleLimits[role];
      const panchina = this.roleLimits[role] - titolari;
      const costoPanchina = panchina * this.prezzoPanchinaro;
      const residuo = Math.max(0, budgetRuolo - costoPanchina);

      const prezzi = this.BASELINE_PREZZO_TIER[role] || {};
      const { assegnazioni, residuoFinale } = this.assegnaFasce(residuo, titolari, prezzi);
      const descrizione = this.descriviFasce(assegnazioni);

      return {
        role: role,
        budgetRuolo: round1(budgetRuolo),
        titolari: titolari,
        panchina: panchina,
        costoPanchinaStimato: round1(costoPanchina),
        assegnazioni: assegnazioni,
        descrizione: descrizione,
        residuoDopoTitolari: round1(residuoFinale),
        fonte: 'Prezzo mediano reale del listone per tier (tierConsensus), ' +
               'incrociato con le fasce di Laudantes dove disponibili (DIF, CEN).'
      };
    }

    /**
     * PROSSIMA FASCIA CONSIGLIATA — in tempo reale durante l'asta.
     *
     * Diverso da pianoFasce(): quello pianifica il reparto da zero, questo
     * guarda cosa hai GIA' comprato in questo ruolo (tier + prezzo reali,
     * non stimati) e ricalcola il piano sui soli slot e sul budget che
     * restano DAVVERO. Se hai gia' preso un A+ a poco, il prossimo target
     * si abbassa di conseguenza; se hai speso piu' del previsto, si alza
     * la cautela invece di continuare a suggerire tier alti che non puoi
     * piu' permetterti.
     */
    prossimaFasciaConsigliata(team, strategyKey, role, allPlayers, inflazioneRuolo, scarsita) {
      const strat = this.strategies[strategyKey] || this.strategies.bilanciata;
      const budgetRuolo = this.budgetTotal * strat[role];
      const titolariTot = this.slotTitolari[role] || this.roleLimits[role];
      const panchinaTot = this.roleLimits[role] - titolariTot;

      const posseduti = (team.players || []).filter((p) => p.role === role);
      const speso = posseduti.reduce((s, p) => s + (p.price || 0), 0);

      // Un giocatore e' "titolare" se costato piu' del prezzo minimo da
      // panchina: e' una soglia, non una certezza, ma e' l'unico modo per
      // dedurre dal solo prezzo quanti titolari sono gia' stati presi
      // (lo storico non salva un flag esplicito titolare/panchina).
      const titolariPresi = posseduti.filter((p) => (p.price || 0) > this.prezzoPanchinaro).length;
      const panchinaPresi = posseduti.length - titolariPresi;

      const titolariMancanti = Math.max(0, titolariTot - titolariPresi);
      const panchinaMancanti = Math.max(0, panchinaTot - panchinaPresi);
      const costoPanchinaResidua = panchinaMancanti * this.prezzoPanchinaro;
      const residuoRuolo = Math.max(0, budgetRuolo - speso - costoPanchinaResidua);

      // Tier gia' assicurati, per mostrare "hai preso: 1x A+" nel messaggio
      const idByName = {};
      (allPlayers || []).forEach((p) => { idByName[p.id] = p; });
      const tierPresi = posseduti
        .filter((p) => (p.price || 0) > this.prezzoPanchinaro)
        .map((p) => (idByName[p.id] || {}).tierConsensus)
        .filter(Boolean);

      if (titolariMancanti === 0) {
        return {
          role: role, completo: true,
          messaggio: 'Titolari di ' + role + ' completi (' +
                     this.descriviFasce(tierPresi.map((t) => ({ tier: t }))) +
                     '). Quello che manca e\' panchina, 1-2 crediti.'
        };
      }

      /**
       * Il prezzo di riferimento e' il listino nazionale, ma QUESTA asta
       * puo' correre piu' calda o piu' fredda. mercatoPerReparto() confronta
       * gia' prezzo pagato vs listino su tutte le squadre (richiede
       * n>=5 acquisti nel ruolo per essere considerato affidabile): se
       * disponibile, scala la baseline su quel rapporto reale invece di
       * usare il prezzo nazionale come se questa fosse un'asta qualunque.
       */
      const rapportoMercato = (inflazioneRuolo && inflazioneRuolo.rapporto) || 1;
      const prezziBase = this.BASELINE_PREZZO_TIER[role] || {};
      const prezzi = {};
      Object.keys(prezziBase).forEach((t) => { prezzi[t] = round1(prezziBase[t] * rapportoMercato); });

      const { assegnazioni } = this.assegnaFasce(residuoRuolo, titolariMancanti, prezzi);
      const prossimo = assegnazioni[0];
      const restoDescrizione = this.descriviFasce(assegnazioni.slice(1));

      const descrizioneGiaPresi = tierPresi.length
        ? this.descriviFasce(tierPresi.map((t) => ({ tier: t })))
        : null;
      const base = 'Prossimo ' + role + ': punta a un ' + (prossimo ? prossimo.tier : '?') +
        (prossimo ? ' (~' + prossimo.prezzoStimato + ' crediti)' : '');
      const dopo = restoDescrizione ? ', poi ' + restoDescrizione : '';
      const primaNota = descrizioneGiaPresi ? 'Preso finora: ' + descrizioneGiaPresi + '. ' : '';
      const notaMercato = (rapportoMercato < 0.85 || rapportoMercato > 1.15)
        ? " (prezzi corretti sull'andamento reale di questa asta: " +
          Math.round(rapportoMercato * 100) + '% del listino, su ' +
          inflazioneRuolo.giocatori + " acquisti gia' visti in " + role + ")"
        : '';

      /**
       * SCARSITA' sul tier specifico che sto per consigliare: quanti ce ne
       * sono ancora liberi di quel livello o superiore ("liberiAlmenoFascia",
       * gia' cumulativo — chi cerca un A+ ripiega su un A) contro quante
       * squadre competono davvero per questo ruolo. Non e' la stessa
       * informazione dell'inflazione: i prezzi possono essere ancora bassi
       * ma il tier che voglio puo' sparire comunque per pura scarsita'.
       */
      let notaScarsita = '';
      if (scarsita && scarsita.fase === role && prossimo) {
        const liberi = (scarsita.liberiAlmenoFascia || {})[prossimo.tier];
        const competitor = scarsita.squadreCompetitive || 0;
        if (liberi != null && competitor > 0) {
          if (liberi <= competitor) {
            notaScarsita = ' ⚠️ Solo ' + liberi + ' liberi di livello ' + prossimo.tier +
              ' o superiore per ' + competitor + ' squadre in corsa su ' + role +
              ': se lo vuoi, non temporeggiare.';
          } else if (liberi >= competitor * 2) {
            notaScarsita = ' ' + liberi + ' liberi di livello ' + prossimo.tier +
              ' o superiore per ' + competitor + ' squadre in corsa: puoi aspettare un prezzo migliore.';
          }
        }
      }

      /**
       * COMPORTAMENTO di un avversario specifico: non cambia il MIO target
       * (la tendenza di un manager non e' un fatto sul ruolo, e' un fatto
       * su quella persona), ma se fra le squadre ancora a caccia di questo
       * ruolo ce n'e' una con uno storico di sovrapprezzo marcato proprio
       * qui, vale la pena saperlo prima di entrare in un rilancio con lei.
       * Funziona solo se STORICO_MANAGER e' caricato (Fantalissandria) e i
       * nomi squadra corrispondono: altrimenti non aggiunge nulla, senza
       * errori.
       */
      let notaComportamento = '';
      if (scarsita && scarsita.fase === role && scarsita.squadreAffamate) {
        const sospetti = [];
        scarsita.squadreAffamate.forEach((sq) => {
          const profilo = this.profiloStoricoManager(sq.squadra);
          const idx = profilo && profilo.sovrapprezzoPerRuolo &&
                      profilo.sovrapprezzoPerRuolo[role];
          if (idx && idx.indice >= 1.2) sospetti.push(sq.squadra);
        });
        if (sospetti.length) {
          notaComportamento = ' 👀 ' + sospetti.join(', ') +
            (sospetti.length > 1 ? ' hanno' : ' ha') +
            ' storicamente sovrapagato su ' + role + ': occhio ai rilanci.';
        }
      }

      return {
        role: role,
        completo: false,
        tierGiaPresi: tierPresi,
        descrizioneGiaPresi: descrizioneGiaPresi,
        titolariMancanti: titolariMancanti,
        residuoRuolo: round1(residuoRuolo),
        rapportoMercato: rapportoMercato,
        prossimoTarget: prossimo ? prossimo.tier : null,
        prossimoPrezzoStimato: prossimo ? prossimo.prezzoStimato : null,
        restoDelPiano: restoDescrizione,
        messaggio: primaNota + base + dopo + '.' + notaMercato + notaScarsita + notaComportamento
      };
    }

    /**
     * Budget del reparto in corso, ricalcolato sugli slot che restano DAVVERO
     * in questa fase. Segnala lo sforamento invece di impedirlo.
     */
    budgetFase(team, strategyKey, allTeams, faseOverride) {
      const strat = this.strategies[strategyKey] || this.strategies.bilanciata;
      const fase = faseOverride || this.faseCorrente(allTeams).fase;
      if (!fase) return { fase: null, completa: true };

      const st = this.rosterState(team);
      const mancanti = Math.max(0, this.roleLimits[fase] - st.countByRole[fase]);
      const target = this.budgetTotal * strat[fase];
      const speso = st.spentByRole[fase];
      const residuoRuolo = target - speso;

      // --- Titolari e panchinari -------------------------------------
      // Dividere il budget in parti uguali sugli slot e' sbagliato: in
      // campo va meno di meta' della rosa. I panchinari costano 1-2
      // crediti, quindi quasi tutto il residuo spetta ai titolari.
      const titolariTot = this.slotTitolari[fase] || this.roleLimits[fase];
      const presi = st.countByRole[fase];
      const titolariMancanti = Math.max(0, titolariTot - presi);
      const panchinariMancanti = Math.max(0, mancanti - titolariMancanti);
      const costoPanchina = panchinariMancanti * this.prezzoPanchinaro;
      const perTitolari = Math.max(0, residuoRuolo - costoPanchina);
      const perTitolare = titolariMancanti > 0
        ? round1(perTitolari / titolariMancanti) : 0;

      // Quanto va tenuto da parte per i reparti non ancora iniziati.
      const indice = ROLES.indexOf(fase);
      const daRiservare = ROLES.slice(indice + 1).reduce((s, r) => {
        const manc = Math.max(0, this.roleLimits[r] - st.countByRole[r]);
        return s + (manc > 0 ? this.budgetTotal * strat[r] - st.spentByRole[r] : 0);
      }, 0);

      const disponibileDavvero = Math.max(0, st.residuo - Math.max(0, daRiservare));

      return {
        fase: fase,
        slotMancantiInFase: mancanti,
        budgetTargetRuolo: Math.round(target),
        spesoNelRuolo: round1(speso),
        residuoDiRuolo: round1(residuoRuolo),
        mediaPerSlotRimanente: mancanti > 0 ? round1(residuoRuolo / mancanti) : 0,
        titolariMancanti: titolariMancanti,
        panchinariMancanti: panchinariMancanti,
        budgetPerTitolare: perTitolare,
        costoPanchinaStimato: round1(costoPanchina),
        // Il budget del reparto puo' essere finito pur restando slot da
        // titolare: e' una situazione diversa dall'aver gia' preso i titolari
        // e va detta come tale, non mascherata da "titolari da ~0 crediti".
        budgetRuoloEsaurito: titolariMancanti > 0 && perTitolare < 1,
        pianoSlot: titolariMancanti > 0
          ? (perTitolare >= 1
              ? titolariMancanti + ' titolari da ~' + perTitolare + ' crediti + ' +
                panchinariMancanti + ' panchinari da 1-2'
              : 'budget del reparto finito: ti restano ' + titolariMancanti +
                ' slot da titolare e ' + panchinariMancanti + ' da panchina, ' +
                'ma niente crediti destinati. O sfori sul reparto, o li chiudi ' +
                'tutti a 1-2 crediti e recuperi altrove')
          : (panchinariMancanti > 0
              ? 'restano solo ' + panchinariMancanti + ' panchinari: 1-2 crediti l\'uno'
              : 'reparto completo'),

        riservatoPerReparteSuccessivi: Math.round(Math.max(0, daRiservare)),
        spendibileSenzaSforare: Math.round(Math.max(0, residuoRuolo)),
        spendibileSforando: Math.round(disponibileDavvero),
        sforamento: residuoRuolo < 0 ? round1(-residuoRuolo) : 0,
        avviso: residuoRuolo < 0
          ? 'Hai gia\' sforato di ' + round1(-residuoRuolo) + ' crediti sul ' +
            fase + ': i reparti successivi ne pagheranno il conto.'
          : (mancanti > 0 && residuoRuolo / mancanti < 2
              ? 'Restano ' + round1(residuoRuolo) + ' crediti per ' + mancanti +
                ' slot in questa fase: puoi solo completare al minimo.'
              : null)
      };
    }

    /**
     * Chiamare adesso o aspettare?
     * Se i giocatori di livello pari o superiore sono meno delle squadre
     * ancora affamate, il nome e' conteso: chiamalo tu o restane fuori con
     * lucidita'. Se invece l'offerta abbonda, conviene lasciarlo chiamare
     * ad altri e rilanciare in coda con piu' informazioni.
     */
    chiamaOraOAspetta(player, allTeams, allPlayers, note) {
      if (!player) return { errore: 'giocatore non trovato' };
      const ruolo = normRole(player.role || player.roleShort);
      const sc = this.scarsitaFase(allTeams, allPlayers, ruolo, note);
      const info = this.faseCorrente(allTeams);

      if (info.fase && ruolo !== info.fase) {
        return {
          giocatore: player.name,
          ruolo: ruolo,
          faseInCorso: info.fase,
          verdetto: 'FUORI FASE',
          motivo: 'Si stanno chiamando i ' + info.fase + ': questo giocatore ' +
                  'non e\' ancora in asta.'
        };
      }

      // Se e' gia' stato comprato non c'e' nulla da decidere.
      const liberi = this.availablePlayers(allPlayers, allTeams);
      const ancoraLibero = liberi.some((p) =>
        (p.id !== undefined && p.id === player.id) ||
        nameKey(p.name) === nameKey(player.name));
      if (!ancoraLibero) {
        return {
          giocatore: player.name,
          ruolo: ruolo,
          tier: player.tierConsensus || player.tier,
          verdetto: 'GIA\' ACQUISTATO',
          motivo: 'Questo giocatore e\' gia\' stato comprato: non e\' piu\' in asta.'
        };
      }

      const tier = player.tierConsensus || player.tier;
      const almeno = sc.liberiAlmenoFascia ? sc.liberiAlmenoFascia[tier] : null;
      // Se hai osservato il tavolo, conta chi rilancia davvero.
      const suCarta = sc.numeroSquadreAffamate || 0;
      const affamate = sc.noteCompilate ? (sc.squadreCompetitive || 0) : suCarta;
      const chiarimento = (sc.noteCompilate && affamate !== suCarta)
        ? ' (' + suCarta + ' affamate sulla carta, ' + affamate +
          ' che rilanciano davvero secondo le tue note)'
        : '';

      let verdetto, motivo;
      if (almeno === null || affamate === 0) {
        verdetto = 'NESSUNA PRESSIONE';
        motivo = 'Nessuna squadra deve ancora comprare in questo reparto.';
      } else if (almeno < affamate) {
        verdetto = 'CHIAMALO TU ORA';
        const esclusi = affamate - almeno;
        motivo = 'Restano ' + almeno + ' giocatori di livello ' + tier +
          ' o superiore per ' + affamate + ' squadre ancora affamate' +
          chiarimento + ': ' +
          (esclusi === 1 ? 'una restera\'' : esclusi + ' resteranno') +
          ' a bocca asciutta. Se lo vuoi, chiamalo tu adesso; ' +
          'altrimenti mettilo in conto perso.';
      } else if (almeno === affamate) {
        verdetto = 'MARGINE ZERO';
        motivo = 'Ci sono esattamente ' + almeno + ' giocatori di livello ' +
          tier + ' o superiore per ' + affamate + ' squadre affamate' +
          chiarimento + ': basta che una squadra ne prenda due e qualcuno ' +
          'resta fuori. Puoi aspettare un giro, non di piu\'.';
      } else {
        verdetto = 'PUOI ASPETTARE';
        motivo = 'Ci sono ' + almeno + ' giocatori di livello ' + tier +
          ' o superiore per sole ' + affamate + ' squadre affamate' +
          chiarimento + ': lascialo chiamare ad altri e inserisciti in coda, ' +
          'il prezzo restera\' basso.';
      }

      return {
        giocatore: player.name,
        ruolo: ruolo,
        tier: tier,
        squadreAffamate: affamate,
        liberiDiPariLivelloOSuperiore: almeno,
        margine: almeno !== null ? almeno - affamate : null,
        tettoMassimoAvversario: sc.rilancioMassimoRealistico,
        verdetto: verdetto,
        motivo: motivo
      };
    }

    generateFullReport(team, strategyKey, allTeams, allPlayers, myTeamNum, note) {
      const availables = this.availablePlayers(allPlayers, allTeams);
      const st = this.rosterState(team);
      const mine = myTeamNum || 1;
      const infoFase = this.faseCorrente(allTeams);
      const fase = infoFase.fase;

      // In asta a reparti solo i giocatori della fase in corso sono
      // chiamabili: mostrare gli altri come "obiettivi" e' fuorviante.
      const inFase = fase
        ? availables.filter((p) => normRole(p.role || p.roleShort) === fase)
        : availables;

      /**
       * Gli obiettivi devono rispettare il budget dello SLOT in corso, non
       * tutta la cassa. Se il piano dice che restano solo panchinari da 1-2
       * crediti, proporre un titolare da 40 e' una contraddizione.
       */
      const bf = this.budgetFase(team, strategyKey, allTeams);
      let tettoObiettivi = st.maxOffertaOra;
      let notaObiettivi = null;
      if (bf && bf.fase) {
        if (bf.titolariMancanti > 0 && bf.budgetPerTitolare >= 1) {
          // margine del 40%: in asta si paga sopra il piano
          tettoObiettivi = Math.min(tettoObiettivi,
                                    Math.ceil(bf.budgetPerTitolare * 1.4));
          notaObiettivi = 'filtrati sul budget per titolare (~' +
                          bf.budgetPerTitolare + ' crediti, +40% di margine)';
        } else if (bf.budgetRuoloEsaurito) {
          // Restano slot da titolare ma non c'e' piu' budget di reparto:
          // e' diverso dall'aver gia' completato i titolari.
          tettoObiettivi = Math.min(tettoObiettivi, 3);
          notaObiettivi = 'budget del reparto finito ma ti mancano ancora ' +
                          bf.titolariMancanti + ' titolari: questi sono i migliori ' +
                          'sotto i 3 crediti';
        } else if (bf.panchinariMancanti > 0) {
          tettoObiettivi = Math.min(tettoObiettivi, 3);
          notaObiettivi = 'restano solo slot da panchina: sotto i 3 crediti';
        }
      }

      // Calcolato una volta come variabile, cosi' l'inflazione del ruolo in
      // corso puo' essere passata a prossimaFasciaConsigliata invece di
      // essere ricalcolata due volte o ignorata.
      const mercato2 = this.mercatoPerReparto(allTeams, allPlayers, mine);
      const inflazioneFase = fase ? (mercato2.inflazionePerReparto || {})[fase] : null;
      const scarsita = this.scarsitaFase(allTeams, allPlayers, null, note);

      return {
        timestamp: new Date().toISOString(),
        stato: st,
        fase: infoFase,
        scarsita: scarsita,
        budgetFase: bf,
        analisiRuoli: this.analyzeTeam(team, strategyKey),
        avvisi: this.detectAnomalies(team, strategyKey),
        consiglio: this.consiglioPrincipale(team, strategyKey, inFase, fase),
        obiettivi: this.bestValue(inFase, {
          maxSpesa: tettoObiettivi, limit: 8,
          // Sui titolari conta la resa assoluta, sui panchinari l'efficienza
          criterio: (bf && bf.fase && bf.titolariMancanti === 0) ? 'efficienza' : 'resa'
        }),
        notaObiettivi: notaObiettivi,
        modificatore: this.modificatoreAttuale(team, allPlayers),
        profiloRischio: this.profiloRischio(team, allTeams, mine, allPlayers),
        mercato2: mercato2,
        passoSpesa: this.passoSpesa(team, strategyKey, allTeams, allPlayers),
        // La scarsita' descrive il mercato, non la mia situazione: se mi
        // restano solo slot da panchina, l'asta al rialzo sui top non mi
        // riguarda e "non temporeggiare" sarebbe un consiglio sbagliato.
        scarsitaMiRiguarda: !(bf && bf.fase &&
                              bf.titolariMancanti === 0 &&
                              bf.panchinariMancanti > 0),
        occasioniModificatore: this.modificatoreBargains(inFase, 8, team, allPlayers),
        specialistiPiazzati: this.specialisti(inFase, 6),
        trappole: this.trappole(inFase, 6),
        mercato: this.pressioneMercato(allTeams, mine),
        avversari: Object.keys(allTeams || {})
          .filter((k) => String(k) !== String(mine))
          .map((k) => this.inferOpponentStrategy(allTeams[k], k)),
        prossimaFascia: fase
          ? this.prossimaFasciaConsigliata(team, strategyKey, fase, allPlayers, inflazioneFase, scarsita)
          : null,
        giocatoriDisponibili: availables.length
      };
    }
  }

  // ---------------------------------------------------------- integrazione

  const AI_AGENT = new FantacalcioAIAgent();

  const getPlayers = () =>
    (typeof PLAYERS_DATA !== 'undefined' && PLAYERS_DATA) ? PLAYERS_DATA : [];
  const getTeams = () => (typeof teams !== 'undefined' && teams) ? teams : {};
  const currentStrategy = () =>
    (typeof window !== 'undefined' && window.currentStrategy) || 'bilanciata';
  const myTeamNum = () =>
    (typeof window !== 'undefined' && window.myTeamNum) || 1;

  // Note sugli avversari: crocette + testo libero, scritte dall'app.
  // Vivono in localStorage cosi' sopravvivono a un refresh in piena asta.
  const getNote = () => {
    if (typeof window !== 'undefined' && window.noteAvversari) {
      return window.noteAvversari;
    }
    try {
      const raw = localStorage.getItem('noteAvversari');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  };

  const salvaNote = (n) => {
    if (typeof window !== 'undefined') window.noteAvversari = n;
    try { localStorage.setItem('noteAvversari', JSON.stringify(n)); }
    catch (e) { /* localStorage non disponibile: resta in memoria */ }
  };

  function getAIContext() {
    const t = getTeams();
    return AI_AGENT.generateFullReport(
      t[myTeamNum()], currentStrategy(), t, getPlayers(), myTeamNum(), getNote());
  }

  /** "Quanto offro per Buongiorno?" — risposta diretta. */
  function quantoOffrirePer(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    if (!p) return { errore: '"' + nome + '" non trovato nel listone.' };
    const t = getTeams();
    return AI_AGENT.quantoOffrire(p, t[myTeamNum()], currentStrategy(), getPlayers(), t, myTeamNum());
  }

  /** Profilo storico di un manager (se disponibile) fuori da un'asta in corso. */
  function profiloManager(nomeSquadra) {
    return AI_AGENT.profiloStoricoManager(nomeSquadra);
  }

  /** Come sta andando il mercato per reparto, e come approfittarne. */
  function mercato() {
    const t = getTeams();
    return AI_AGENT.mercatoPerReparto(t, getPlayers(), myTeamNum());
  }

  /** Rischio di restare con crediti in mano a fine asta. */
  function passoSpesa() {
    const t = getTeams();
    return AI_AGENT.passoSpesa(t[myTeamNum()], currentStrategy(), t, getPlayers());
  }

  /** Sto costruendo una rosa sopra o sotto la media? Quanto rischiare. */
  function rischio() {
    const t = getTeams();
    return AI_AGENT.profiloRischio(t[myTeamNum()], t, myTeamNum(), getPlayers());
  }

  /** Dove sono col modificatore difesa: portiere + migliori 3 difensori. */
  function modificatore() {
    const t = getTeams();
    const m = AI_AGENT.modificatoreAttuale(t[myTeamNum()], getPlayers());
    if (!m) return { errore: 'Modificatore difesa non attivo in questa lega.' };
    return m;
  }

  /** Quanto sposterebbe il mio modificatore comprare questo giocatore. */
  function impattoModificatore(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    if (!p) return { errore: '"' + nome + '" non trovato nel listone.' };
    const t = getTeams();
    const i = AI_AGENT.impattoSulModificatore(p, t[myTeamNum()], getPlayers());
    if (!i) return { errore: p.name + ' non e\' POR ne\' DIF: non tocca il modificatore.' };
    return i;
  }

  /** Segna un comportamento osservato su una squadra avversaria. */
  function nota(squadra, pattern, testo) {
    const n = getNote();
    const k = String(squadra);
    const prec = n[k] || {};
    n[k] = {
      pattern: pattern === undefined ? (prec.pattern || [])
             : (Array.isArray(pattern) ? pattern : [pattern]),
      testo: testo === undefined ? (prec.testo || null) : testo
    };
    salvaNote(n);
    return n[k];
  }

  /** Tutte le note, o quelle di una squadra. */
  function note(squadra) {
    const n = getNote();
    return squadra === undefined ? n : (n[String(squadra)] || null);
  }

  /** Cancella le note di una squadra, o tutte. */
  function azzeraNote(squadra) {
    if (squadra === undefined) { salvaNote({}); return {}; }
    const n = getNote();
    delete n[String(squadra)];
    salvaNote(n);
    return n;
  }

  /** Elenco dei pattern disponibili: l'app ci costruisce le crocette. */
  function patternDisponibili() {
    return Object.keys(PATTERN_AVVERSARI).map((k) => ({
      id: k, label: PATTERN_AVVERSARI[k].label, peso: PATTERN_AVVERSARI[k].peso
    }));
  }

  /** Chiamare adesso o aspettare? Decisione tattica sul singolo nome. */
  function chiamaOAspetta(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    if (!p) return { errore: '"' + nome + '" non trovato nel listone.' };
    return AI_AGENT.chiamaOraOAspetta(p, getTeams(), getPlayers(), getNote());
  }

  /** Stato della fase di reparto in corso. */
  function faseAsta() {
    return AI_AGENT.faseCorrente(getTeams());
  }

  /** Scarsita' del reparto in corso: chi e' ancora affamato, cosa resta. */
  function scarsita(ruolo) {
    return AI_AGENT.scarsitaFase(getTeams(), getPlayers(), normRole(ruolo) || null, getNote());
  }

  /** Scheda completa di un giocatore. */
  function scheda(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    return p ? AI_AGENT.schedaCompleta(p, getPlayers()) : { errore: '"' + nome + '" non trovato.' };
  }

  /** Solo l'infortunio, se c'e': piu' rapido di scheda() quando serve solo quello. */
  function infortunio(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    if (!p) return { errore: '"' + nome + '" non trovato.' };
    if (typeof INFORTUNI_SERIE_A === 'undefined' || !INFORTUNI_SERIE_A.infortuni) {
      return { nota: 'Modulo infortuni non caricato.' };
    }
    const inf = INFORTUNI_SERIE_A.infortuni[p.id];
    if (!inf) {
      return { nota: p.name + ': nessun infortunio segnalato (aggiornato al ' +
               INFORTUNI_SERIE_A.generato + ').' };
    }
    return inf.squadra ? inf : Object.assign({}, inf, { squadra: p.team });
  }

  function formatReportForClaude(report) {
    const r = report || getAIContext();
    const st = r.stato;
    const L = [];

    L.push('ASTA IN CORSO — ' + new Date().toLocaleTimeString('it-IT'));
    L.push('');

    const f = r.fase || {};
    const sc = r.scarsita || {};
    if (f.completa) {
      L.push('FASE: ASTA CONCLUSA — tutte le rose sono complete.');
    } else if (f.fase) {
      L.push('FASE IN CORSO: ' + f.fase +
             ' — ' + f.slotRiempiti + '/' + f.slotTotali + ' slot (' +
             f.percentuale + '%)');
      if (sc.numeroSquadreAffamate !== undefined) {
        L.push('- Squadre ancora affamate: ' + sc.numeroSquadreAffamate + ' su 8');
        L.push('- Tetto massimo teorico di un avversario affamato: ' +
               sc.rilancioMassimoRealistico +
               ' (limite di budget, non previsione di spesa)');
        const pf = sc.liberiPerFascia || {};
        L.push('- Liberi per fascia: ' +
               TIER_ORDER.map((t) => t + ':' + (pf[t] || 0)).join('  '));
        if (sc.nota) {
          L.push('- ' + sc.nota);
          if (r.scarsitaMiRiguarda === false) {
            L.push('  (non ti riguarda: i tuoi titolari in questo reparto sono gia\' presi, ' +
                   'ti restano solo slot da panchina)');
          }
        }
      }
      const bf = r.budgetFase || {};
      if (bf.fase) {
        L.push('- Budget di fase: ' + bf.spendibileSenzaSforare +
               ' crediti per ' + bf.slotMancantiInFase + ' slot tuoi');
        L.push('  Come distribuirli: ' + bf.pianoSlot);
        if (bf.avviso) L.push('  ⚠️ ' + bf.avviso);
      }
      if (r.prossimaFascia && !r.prossimaFascia.completo) {
        L.push('  🎯 ' + r.prossimaFascia.messaggio);
      } else if (r.prossimaFascia && r.prossimaFascia.completo) {
        L.push('  ✅ ' + r.prossimaFascia.messaggio);
      }
      if (f.slotResidui <= 3 && f.slotResidui > 0) {
        L.push('- ⚠️ Mancano solo ' + f.slotResidui +
               ' slot alla chiusura della fase ' + f.fase +
               (f.faseSuccessiva ? ': prepara la fase ' + f.faseSuccessiva : ''));
      }
      L.push('');
    }

    L.push('LA MIA SQUADRA');
    L.push('- Speso ' + st.spent + ' / ' + AI_AGENT.budgetTotal +
           ', residuo ' + st.residuo);
    L.push('- Slot da riempire: ' + st.slotMancanti +
           ' (' + st.creditiPerSlot + ' crediti a slot)');
    L.push('- Offerta massima possibile adesso: ' + st.maxOffertaOra);
    L.push('');
    L.push('RUOLI');
    ROLES.forEach((role) => {
      const a = r.analisiRuoli[role];
      L.push('- ' + role + ': ' + a.count + '/' + AI_AGENT.roleLimits[role] +
             ' presi, ' + a.spent + ' crediti (' + a.actual + '% vs ' +
             a.target + '% target), budget di ruolo residuo ' + a.budgetResiduoRuolo);
    });

    L.push('');
    L.push('PIANO FASCE (come dividere il budget di ruolo fra i titolari)');
    ROLES.forEach((role) => {
      const pf = AI_AGENT.pianoFasce(role, currentStrategy());
      L.push('- ' + role + ': ' + pf.descrizione + ' (+ ' + pf.panchina +
             " panchinari a 1-2 crediti l'uno)");
      if (pf.residuoDopoTitolari > 3) {
        L.push('  margine di ' + pf.residuoDopoTitolari +
               ' crediti: puoi spingerti sopra il prezzo tipico su un obiettivo preciso');
      }
    });
    L.push('(Nota: il tier qui è quello generale del giocatore, non è detto coincida ' +
           'con chi conviene per il modificatore — incrocia con modBargain/scheda prima di puntarci.)');

    if (r.avvisi.length) {
      L.push('');
      L.push('AVVISI');
      r.avvisi.forEach((a) => L.push(a.icon + ' ' + a.message));
    }

    const card = (c) =>
      '- ' + c.nome + ' (' + c.ruolo + ', ' + c.squadra + ') tier ' + c.tier +
      ' | qualita ' + c.qualita +
      ' | mercato ~' + c.prezzoMercato +
      (c.soloRiempitivo
        ? ', tetto sensato sotto 1 credito: non conviene, prendilo solo se ti serve come riempitivo a 1'
        : ', non superare ' + c.prezzoMaxConsigliato) +
      (c.piazzati.length ? ' | ' + c.piazzati.join(', ') : '') +
      (c.rischi.length ? ' | rischi: ' + c.rischi.join('; ') : '');

    if (r.obiettivi.length) {
      L.push('');
      L.push('OBIETTIVI ALLA MIA PORTATA' + (r.fase && r.fase.fase ? ' (reparto ' + r.fase.fase + ', in asta ora)' : ''));
      if (r.notaObiettivi) L.push('(' + r.notaObiettivi + ')');
      r.obiettivi.forEach((c) => {
        L.push(card(c));
        if (c.convenienza && c.convenienza.sintesi) L.push('  ' + c.convenienza.sintesi);
      });
    }
    // Passo di spesa: rischio di restare con crediti in mano
    const ps = r.passoSpesa;
    if (ps && !ps.completo) {
      L.push('');
      L.push('PASSO DI SPESA');
      L.push('- Hai ' + ps.residuo + ' crediti per ' + ps.slotMancanti +
             ' slot; completare ai prezzi correnti ne costa ~' +
             ps.costoStimatoPerCompletare);
      L.push('- ' + ps.nota);
    }

    // Come sta andando il mercato e come approfittarne
    const mk = r.mercato2;
    if (mk && mk.letture && mk.letture.length) {
      L.push('');
      L.push('LETTURA DEL MERCATO');
      mk.letture.forEach((x) => L.push('- ' + x));
      const inf = mk.inflazionePerReparto || {};
      const righe = Object.keys(inf).filter((k) => inf[k])
        .map((k) => k + ' ' + Math.round(inf[k].rapporto * 100) + '%');
      if (righe.length) L.push('- Prezzi sul listino: ' + righe.join('  '));
    }

    // Scontri diretti: quanto conviene rischiare adesso
    const pr = r.profiloRischio;
    if (pr && pr.valutabile) {
      L.push('');
      L.push('QUANTO RISCHIARE (campionato a scontri diretti)');
      const misuraScarto = pr.scartoPercentuale != null
        ? (pr.scartoPercentuale > 0 ? '+' : '') + pr.scartoPercentuale + '%'
        : (pr.differenzaPunti > 0 ? '+' : '') + pr.differenzaPunti + ' punti';
      L.push('- Forza stimata della rosa: ' + pr.forzaMia + ' punti contro ' +
             pr.forzaMediaAvversari + ' degli avversari (crediti in cassa ' +
             pr.creditiInCassa + ' inclusi): sei ' + pr.posizione +
             ' (' + misuraScarto + ')');
      L.push('- ' + pr.consiglio);
    }

    // Stato del modificatore: dove sono adesso col blocco difensivo
    const md = r.modificatore;
    if (md) {
      L.push('');
      L.push('MODIFICATORE DIFESA — IL MIO BLOCCO');
      if (!md.completo) {
        L.push('- ' + md.nota);
        if (md.portiere) L.push('  portiere: ' + md.portiere.nome + ' (mv ' + md.portiere.mv + ')');
        md.migliori3Difensori.forEach((d) =>
          L.push('  difensore: ' + d.nome + ' (mv ' + d.mv + ')'));
      } else {
        L.push('- ' + md.portiere.nome + ' (POR, mv ' + md.portiere.mv + ') + ' +
               md.migliori3Difensori.map((d) => d.nome + ' ' + d.mv).join(', '));
        L.push('- Media ' + md.mediaAttuale + ' -> bonus ' + md.bonusAttuale +
               ' a giornata');
        if (md.prossimaSoglia) {
          L.push('- Prossimo scaglione a ' + md.prossimaSoglia + ' (bonus ' +
                 md.bonusProssimo + '): mancano ' + md.distanzaDallaProssima +
                 (md.mediaVotoRichiestaPerSalire
                   ? '. Serve un difensore da mv ' + md.mediaVotoRichiestaPerSalire +
                     ' al posto del terzo'
                   : ''));
        }
        if (md.avvisoDatiDeboli) L.push('- ⚠️ ' + md.avvisoDatiDeboli);
      }
    }
    if (r.occasioniModificatore.length) {
      L.push('');
      L.push('OCCASIONI DA MODIFICATORE DIFESA');
      L.push('(media voto alta a prezzo basso: i listoni le sottovalutano perche');
      L.push('non conoscono le regole di questa lega)');
      r.occasioniModificatore.forEach((c) => {
        L.push('- ' + c.nome + ' (' + c.ruolo + ', ' + c.squadra + ') media voto ' +
               c.mediaVoto + ', mercato ~' + c.prezzoMercato + ' — ' + c.perche);
        if (c.impattoSulMioBlocco) L.push('  SUL MIO BLOCCO: ' + c.impattoSulMioBlocco);
      });
    }
    if (r.specialistiPiazzati.length) {
      L.push('');
      L.push('RIGORISTI E PIAZZATI ANCORA LIBERI' + (r.fase && r.fase.fase ? ' — reparto ' + r.fase.fase : '') + ' (gol e rigore valgono 3)');
      r.specialistiPiazzati.forEach((c) => {
        L.push('- ' + c.nome + ' (' + c.ruolo + ') ' + c.piazzati.join(', ') +
               ' — mercato ~' + c.prezzoMercato);
        if (c.rigori) L.push('  ' + c.rigori);
      });
    }
    if (r.trappole.length) {
      L.push('');
      L.push('DA NON RILANCIARE' + (r.fase && r.fase.fase ? ' — reparto ' + r.fase.fase : '') + ' (il mercato li paga piu di quanto valgano)');
      r.trappole.forEach((c) =>
        L.push('- ' + c.nome + ' (' + c.ruolo + ') mercato ~' + c.prezzoMercato +
               ' ma il tetto sensato e ' + c.prezzoMaxConsigliato));
    }

    L.push('');
    L.push('AVVERSARI');
    r.avversari.forEach((o) => {
      if (o.strategy === 'NESSUN ACQUISTO') {
        L.push('- ' + o.squadra + ': nessun acquisto');
        if (o.storico) L.push('  ' + o.storico.nota);
        return;
      }
      let riga = '- ' + o.squadra + ': ';
      if (o.repartiChiusi && o.repartiChiusi.length) {
        riga += o.dettaglio;
        riga += o.confidence >= 50
          ? ' → ' + o.ipotesi + ' (confidenza ' + o.confidence + '%)'
          : ' → indizi ancora deboli';
      } else {
        riga += o.acquisti + ' acquisti, nessun reparto chiuso';
      }
      riga += ' | residuo ' + o.residuo;
      L.push(riga);
      if (o.storico) L.push('  ' + o.storico.nota);
    });

    const scN = r.scarsita || {};
    if (scN.noteCompilate) {
      L.push('');
      L.push('OSSERVAZIONI AL TAVOLO (annotate da me durante l\'asta)');
      (scN.squadreAffamate || []).forEach((a) => {
        if (!a.osservazioni.length && !a.nota) return;
        const parti = [];
        if (a.osservazioni.length) parti.push(a.osservazioni.join('; '));
        if (a.nota) parti.push('"' + a.nota + '"');
        L.push('- ' + a.squadra + ': ' + parti.join(' — '));
      });
      L.push('(pressione reale: ' + scN.squadreCompetitive +
             ' squadre rilanciano davvero su ' + scN.numeroSquadreAffamate +
             ' affamate)');
    }

    L.push('');
    L.push('CONSIGLIO: ' + r.consiglio.icon + ' ' + r.consiglio.titolo + ' — ' +
           r.consiglio.testo);
    L.push('');
    L.push('Giocatori ancora liberi nel listone: ' + r.giocatoriDisponibili);
    return L.join('\n');
  }

  const api = {
    FantacalcioAIAgent: FantacalcioAIAgent,
    AI_AGENT: AI_AGENT,
    getAIContext: getAIContext,
    formatReportForClaude: formatReportForClaude,
    quantoOffrirePer: quantoOffrirePer,
    modificatore: modificatore,
    rischio: rischio,
    mercato: mercato,
    passoSpesa: passoSpesa,
    profiloManager: profiloManager,
    impattoModificatore: impattoModificatore,
    scheda: scheda,
    infortunio: infortunio,
    chiamaOAspetta: chiamaOAspetta,
    faseAsta: faseAsta,
    scarsita: scarsita,
    nota: nota,
    note: note,
    azzeraNote: azzeraNote,
    patternDisponibili: patternDisponibili,
    normRole: normRole,
    nameKey: nameKey,
    getPlayers: getPlayers
  };
  if (typeof window !== 'undefined') Object.assign(window, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
