// =============================================================================
// AGENTE IA FANTACALCIO — v2.0
// Allineato a players_data.js del 2026-09-03 (megafile v3).
// Fonti: Fantaculo + Fantacalcio.it (4 stagioni) + Laudantes (2 stagioni).
// Tarato sulle regole della lega: 8 squadre, 500 crediti, 25 giocatori,
// modificatore difesa attivo con portiere incluso.
// =============================================================================

(function () {
  'use strict';

  const ROLES = ['POR', 'DIF', 'CEN', 'ATT'];

  const ROLE_ALIAS = {
    P: 'POR', D: 'DIF', C: 'CEN', A: 'ATT',
    POR: 'POR', DIF: 'DIF', CEN: 'CEN', ATT: 'ATT',
    PORTIERE: 'POR', DIFENSORE: 'DIF', CENTROCAMPISTA: 'CEN', ATTACCANTE: 'ATT'
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

      this.strategies = {
        conservativa:        { name: 'CONSERVATIVA',      POR: 0.07, DIF: 0.19, CEN: 0.32, ATT: 0.42 },
        bilanciata:          { name: 'BILANCIATA',        POR: 0.09, DIF: 0.17, CEN: 0.27, ATT: 0.47 },
        aggressiva:          { name: 'AGGRESSIVA',        POR: 0.06, DIF: 0.14, CEN: 0.24, ATT: 0.56 },
        'centrocampo-first': { name: 'CENTROCAMPO-FIRST', POR: 0.06, DIF: 0.18, CEN: 0.38, ATT: 0.38 }
      };
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
    bestValue(availables, opts) {
      const o = opts || {};
      const minQ = o.minQuality !== undefined ? o.minQuality : 55;
      const maxSpesa = o.maxSpesa !== undefined ? o.maxSpesa : null;
      const role = o.role ? normRole(o.role) : null;
      return availables
        .filter((p) => (p.qualityScore || 0) >= minQ && (p.valueScore || 0) >= 60)
        .filter((p) => !role || normRole(p.role) === role)
        .filter((p) => maxSpesa === null || num(p.pma) === null || p.pma <= maxSpesa)
        .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))
        .slice(0, o.limit || 8)
        .map((p) => this.playerCard(p));
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
    modificatoreBargains(availables, limit) {
      if (!this.defenseModifier) return [];
      return availables
        .filter((p) => p.modBargain)
        .sort((a, b) => (b.modMediaVoto || 0) - (a.modMediaVoto || 0))
        .slice(0, limit || 12)
        .map((p) => {
          const c = this.playerCard(p);
          c.perche = p.modBargainNote;
          return c;
        });
    }

    /** Rigoristi e specialisti dei piazzati liberi (gol e rigore valgono 3). */
    specialisti(availables, limit) {
      return availables
        .filter((p) => (p.setPieces || []).length > 0)
        .sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0))
        .slice(0, limit || 8)
        .map((p) => this.playerCard(p));
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
        prezzoMaxConsigliato: p.maxPriceLega !== undefined ? p.maxPriceLega : p.pfc,
        titolarita: p.expectedTitolarita,
        fantamediaAttesa: p.expectedFantamedia,
        trend: p.trend,
        consistenza: p.consistency,
        affidabilitaDati: p.dataQuality,
        modificatore: p.modLabel || null,
        mediaVoto: p.modMediaVoto || p.mvStorica || null,
        piazzati: p.setPieces || [],
        rischi: p.risks || [],
        livelloRischio: p.riskLevel
      };
    }

    /** Scheda completa: quando stai decidendo se rilanciare. */
    schedaCompleta(player) {
      const c = this.playerCard(player);
      c.dettaglio = {
        fasciaFantaculo: player.fasciaFc,
        tierLaudantes: player.tierLaudantes,
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
    quantoOffrire(player, team, strategyKey) {
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
      return {
        giocatore: player.name,
        ruolo: role,
        offertaMassima: Math.max(0, Math.floor(vincolante.tetto)),
        vincoloAttivo: vincolante.fonte,
        tuttiILimiti: limiti,
        slotRimanentiNelRuolo: a ? a.needed : null,
        verdetto: player.verdict,
        giudizio: this.giudizio(player)
      };
    }

    // ------------------------------------------------------------ avversari

    inferOpponentStrategy(team, key) {
      const players = (team && team.players) || [];
      const nome = (team && team.name) || ('Squadra ' + (key !== undefined ? key : '?'));
      if (!players.length) {
        return { squadra: nome, strategy: 'NESSUN ACQUISTO', confidence: 0,
                 acquisti: 0, spesaPerRuolo: {} };
      }
      const st = this.rosterState(team);
      const tot = st.spent || 1;
      const quote = {};
      ROLES.forEach((r) => { quote[r] = (st.spentByRole[r] / tot) * 100; });

      let best = null, bestDist = Infinity;
      Object.keys(this.strategies).forEach((k) => {
        const s = this.strategies[k];
        const dist = ROLES.reduce((d, r) => d + Math.abs(quote[r] - s[r] * 100), 0);
        if (dist < bestDist) { bestDist = dist; best = s; }
      });

      // Con pochi acquisti la deduzione non vale nulla: dichiaralo invece
      // di dare un numero che sembra preciso.
      const copertura = Math.min(1, players.length / 12);
      const confidence = Math.round(Math.max(0, 100 - bestDist) * copertura);

      return {
        squadra: nome,
        strategy: confidence < 25 ? 'TROPPO PRESTO PER DIRLO' : best.name,
        confidence: confidence,
        acquisti: players.length,
        residuo: st.residuo,
        spesaPerRuolo: {
          POR: round1(quote.POR), DIF: round1(quote.DIF),
          CEN: round1(quote.CEN), ATT: round1(quote.ATT)
        }
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

    consiglioPrincipale(team, strategyKey, availables) {
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

      // Ruolo piu' urgente: piu' slot mancanti rispetto al budget che gli resta.
      let urgente = null, peggiore = -Infinity;
      ROLES.forEach((r) => {
        const a = analysis[r];
        if (a.needed === 0) return;
        const tensione = a.needed - (a.budgetResiduoRuolo / 10);
        if (tensione > peggiore) { peggiore = tensione; urgente = r; }
      });

      if (urgente) {
        const a = analysis[urgente];
        const cand = this.bestValue(availables, {
          role: urgente, maxSpesa: st.maxOffertaOra, limit: 3
        });
        const nomi = cand.map((c) => c.nome + ' (max ' + c.prezzoMaxConsigliato + ')')
                         .join(', ');
        return {
          icon: '\u{1F3AF}', titolo: 'PRIORITA: ' + urgente,
          testo: 'Ti mancano ' + a.needed + ' ' + urgente + ' con ' +
                 a.budgetResiduoRuolo + ' crediti di budget di ruolo. ' +
                 (nomi ? 'Obiettivi con buon rapporto qualita/prezzo: ' + nomi + '.'
                       : 'Nessun candidato in questa fascia di prezzo tra i disponibili.')
        };
      }
      return { icon: '\u2139\uFE0F', titolo: 'SITUAZIONE STABILE',
               testo: 'Budget e ruoli in linea con la strategia.' };
    }

    generateFullReport(team, strategyKey, allTeams, allPlayers, myTeamNum) {
      const availables = this.availablePlayers(allPlayers, allTeams);
      const st = this.rosterState(team);
      const mine = myTeamNum || 1;

      return {
        timestamp: new Date().toISOString(),
        stato: st,
        analisiRuoli: this.analyzeTeam(team, strategyKey),
        avvisi: this.detectAnomalies(team, strategyKey),
        consiglio: this.consiglioPrincipale(team, strategyKey, availables),
        obiettivi: this.bestValue(availables, { maxSpesa: st.maxOffertaOra, limit: 8 }),
        occasioniModificatore: this.modificatoreBargains(availables, 8),
        specialistiPiazzati: this.specialisti(availables, 6),
        trappole: this.trappole(availables, 6),
        mercato: this.pressioneMercato(allTeams, mine),
        avversari: Object.keys(allTeams || {})
          .filter((k) => String(k) !== String(mine))
          .map((k) => this.inferOpponentStrategy(allTeams[k], k)),
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

  function getAIContext() {
    const t = getTeams();
    return AI_AGENT.generateFullReport(
      t[myTeamNum()], currentStrategy(), t, getPlayers(), myTeamNum());
  }

  /** "Quanto offro per Buongiorno?" — risposta diretta. */
  function quantoOffrirePer(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    if (!p) return { errore: '"' + nome + '" non trovato nel listone.' };
    const t = getTeams();
    return AI_AGENT.quantoOffrire(p, t[myTeamNum()], currentStrategy());
  }

  /** Scheda completa di un giocatore. */
  function scheda(nome) {
    const p = AI_AGENT.findPlayer(getPlayers(), nome);
    return p ? AI_AGENT.schedaCompleta(p) : { errore: '"' + nome + '" non trovato.' };
  }

  function formatReportForClaude(report) {
    const r = report || getAIContext();
    const st = r.stato;
    const L = [];

    L.push('ASTA IN CORSO — ' + new Date().toLocaleTimeString('it-IT'));
    L.push('');
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

    if (r.avvisi.length) {
      L.push('');
      L.push('AVVISI');
      r.avvisi.forEach((a) => L.push(a.icon + ' ' + a.message));
    }

    const card = (c) =>
      '- ' + c.nome + ' (' + c.ruolo + ', ' + c.squadra + ') tier ' + c.tier +
      ' | qualita ' + c.qualita + ' convenienza ' + c.convenienza +
      ' | mercato ~' + c.prezzoMercato + ', non superare ' + c.prezzoMaxConsigliato +
      (c.piazzati.length ? ' | ' + c.piazzati.join(', ') : '') +
      (c.rischi.length ? ' | rischi: ' + c.rischi.join('; ') : '');

    if (r.obiettivi.length) {
      L.push('');
      L.push('OBIETTIVI ALLA MIA PORTATA');
      r.obiettivi.forEach((c) => L.push(card(c)));
    }
    if (r.occasioniModificatore.length) {
      L.push('');
      L.push('OCCASIONI DA MODIFICATORE DIFESA');
      L.push('(media voto alta a prezzo basso: i listoni le sottovalutano perche');
      L.push('non conoscono le regole di questa lega)');
      r.occasioniModificatore.forEach((c) =>
        L.push('- ' + c.nome + ' (' + c.ruolo + ', ' + c.squadra + ') media voto ' +
               c.mediaVoto + ', mercato ~' + c.prezzoMercato + ' — ' + c.perche));
    }
    if (r.specialistiPiazzati.length) {
      L.push('');
      L.push('RIGORISTI E PIAZZATI ANCORA LIBERI (gol e rigore valgono 3)');
      r.specialistiPiazzati.forEach((c) =>
        L.push('- ' + c.nome + ' (' + c.ruolo + ') ' + c.piazzati.join(', ') +
               ' — mercato ~' + c.prezzoMercato));
    }
    if (r.trappole.length) {
      L.push('');
      L.push('DA NON RILANCIARE (il mercato li paga piu di quanto valgano)');
      r.trappole.forEach((c) =>
        L.push('- ' + c.nome + ' (' + c.ruolo + ') mercato ~' + c.prezzoMercato +
               ' ma il tetto sensato e ' + c.prezzoMaxConsigliato));
    }

    L.push('');
    L.push('AVVERSARI');
    L.push('- Rilancio massimo possibile da un avversario: ' +
           r.mercato.rilancioMassimoAvversario);
    r.avversari.forEach((o) =>
      L.push('- ' + o.squadra + ': ' + o.strategy + ' (confidenza ' + o.confidence +
             '%, ' + o.acquisti + ' acquisti)'));

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
    scheda: scheda,
    normRole: normRole,
    nameKey: nameKey
  };
  if (typeof window !== 'undefined') Object.assign(window, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
