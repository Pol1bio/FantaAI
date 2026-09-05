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
       * CONSERVATIVA e' l'unica che punta al secondo scalino: per questo
       * tiene 12% sulla difesa. Le altre si accontentano del primo.
       */
      this.strategies = {
        conservativa:        { name: 'CONSERVATIVA',      POR: 0.07, DIF: 0.12, CEN: 0.29, ATT: 0.52 },
        bilanciata:          { name: 'BILANCIATA',        POR: 0.06, DIF: 0.09, CEN: 0.25, ATT: 0.60 },
        aggressiva:          { name: 'AGGRESSIVA',        POR: 0.05, DIF: 0.07, CEN: 0.20, ATT: 0.68 },
        'centrocampo-first': { name: 'CENTROCAMPO-FIRST', POR: 0.06, DIF: 0.09, CEN: 0.35, ATT: 0.50 }
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

    /**
     * Altri giocatori dello stesso ruolo nella stessa squadra (es. titolare/vice).
     * Utile per portieri e attaccanti: la forza del singolo dipende anche
     * da chi gli sta dietro e da quanto tiene la squadra nel suo complesso.
     */
    compagniDiReparto(player, allPlayers) {
      if (!player || !allPlayers) return [];
      return allPlayers
        .filter((p) => p.team === player.team &&
                       p.role === player.role &&
                       p.id !== player.id)
        .sort((a, b) => (b.expectedTitolarita || 0) - (a.expectedTitolarita || 0))
        .map((p) => ({
          nome: p.name,
          tier: p.tierConsensus || p.tier,
          titolarita: p.expectedTitolarita,
          verdetto: p.verdict,
          prezzoMercato: p.pma
        }));
    }

    /** Scheda completa: quando stai decidendo se rilanciare. */
    schedaCompleta(player, allPlayers) {
      const c = this.playerCard(player);
      c.compagniDiReparto = this.compagniDiReparto(player, allPlayers);
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

      return {
        giocatore: player.name,
        ruolo: role,
        offertaMassima: offerta,
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
    inferOpponentStrategy(team, key) {
      const players = (team && team.players) || [];
      const nome = (team && team.name) || ('Squadra ' + (key !== undefined ? key : '?'));
      if (!players.length) {
        return { squadra: nome, strategy: 'NESSUN ACQUISTO', confidence: 0,
                 acquisti: 0, repartiChiusi: [], quotePerRuolo: {}, residuo: this.budgetTotal };
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
          nota: 'Nessun reparto ancora completato da questa squadra.'
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
          r + ' ' + quote[r] + '% (attesi ' + round1(best[r] * 100) + '%)').join(', ')
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
        pianoSlot: titolariMancanti > 0
          ? titolariMancanti + ' titolari da ~' + perTitolare + ' crediti + ' +
            panchinariMancanti + ' panchinari da 1-2'
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
        if (bf.titolariMancanti > 0 && bf.budgetPerTitolare > 0) {
          // margine del 40%: in asta si paga sopra il piano
          tettoObiettivi = Math.min(tettoObiettivi,
                                    Math.ceil(bf.budgetPerTitolare * 1.4));
          notaObiettivi = 'filtrati sul budget per titolare (~' +
                          bf.budgetPerTitolare + ' crediti, +40% di margine)';
        } else if (bf.panchinariMancanti > 0) {
          tettoObiettivi = Math.min(tettoObiettivi, 3);
          notaObiettivi = 'restano solo slot da panchina: sotto i 3 crediti';
        }
      }

      return {
        timestamp: new Date().toISOString(),
        stato: st,
        fase: infoFase,
        scarsita: this.scarsitaFase(allTeams, allPlayers, null, note),
        budgetFase: bf,
        analisiRuoli: this.analyzeTeam(team, strategyKey),
        avvisi: this.detectAnomalies(team, strategyKey),
        consiglio: this.consiglioPrincipale(team, strategyKey, inFase, fase),
        obiettivi: this.bestValue(inFase, { maxSpesa: tettoObiettivi, limit: 8 }),
        notaObiettivi: notaObiettivi,
        occasioniModificatore: this.modificatoreBargains(inFase, 8),
        specialistiPiazzati: this.specialisti(inFase, 6),
        trappole: this.trappole(inFase, 6),
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
    return AI_AGENT.quantoOffrire(p, t[myTeamNum()], currentStrategy());
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
        if (sc.nota) L.push('- ' + sc.nota);
      }
      const bf = r.budgetFase || {};
      if (bf.fase) {
        L.push('- Budget di fase: ' + bf.spendibileSenzaSforare +
               ' crediti per ' + bf.slotMancantiInFase + ' slot tuoi');
        L.push('  Come distribuirli: ' + bf.pianoSlot);
        if (bf.avviso) L.push('  ⚠️ ' + bf.avviso);
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
      L.push('OBIETTIVI ALLA MIA PORTATA' + (r.fase && r.fase.fase ? ' (reparto ' + r.fase.fase + ', in asta ora)' : ''));
      if (r.notaObiettivi) L.push('(' + r.notaObiettivi + ')');
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
      L.push('RIGORISTI E PIAZZATI ANCORA LIBERI' + (r.fase && r.fase.fase ? ' — reparto ' + r.fase.fase : '') + ' (gol e rigore valgono 3)');
      r.specialistiPiazzati.forEach((c) =>
        L.push('- ' + c.nome + ' (' + c.ruolo + ') ' + c.piazzati.join(', ') +
               ' — mercato ~' + c.prezzoMercato));
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
    scheda: scheda,
    chiamaOAspetta: chiamaOAspetta,
    faseAsta: faseAsta,
    scarsita: scarsita,
    nota: nota,
    note: note,
    azzeraNote: azzeraNote,
    patternDisponibili: patternDisponibili,
    normRole: normRole,
    nameKey: nameKey
  };
  if (typeof window !== 'undefined') Object.assign(window, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
