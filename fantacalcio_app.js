        // ==========================================
        // FANTACALCIO v3.9.9.44 - APP LOGIC
        // ==========================================

        // COSTANTI
        let BUDGET_TOTAL = 500;
        /* ==========================================================
         * CONFIGURAZIONE DI LEGA
         *
         * L'app serve due leghe con regole diverse. Tutto cio' che cambia
         * sta qui; il resto del codice legge queste variabili e non sa da
         * quale lega venga.
         *
         * Differenze fra le due:
         *   - rosa: 25 giocatori (3/8/8/6) contro 24 (3/7/8/6)
         *   - budget: 500 uguali per tutti contro 400 piu' il residuo
         *     dell'anno prima, diverso per squadra
         *   - turno di chiamata: ordine fisso contro "dopo chi compra"
         *   - modificatore difesa: attivo contro assente
         * ========================================================== */
        const LEGHE = {
            fantalissandria: {
                nome: 'Fantalissandria',
                titolo: 'ASTA FANTALISSANDRIA',
                playersPerSquad: 25,
                roleLimits: { POR: 3, DIF: 8, CEN: 8, ATT: 6 },
                budgetBase: 500,
                budgetPerSquadra: null,      // uguale per tutte
                regolaTurno: 'chiamante',
                modificatoreDifesa: true,
                storico: 'STORICO_MANAGER'
            },
            lega1996: {
                nome: 'Lega Fantacalcio 1996',
                titolo: 'ASTA LEGA FANTACALCIO 1996',
                playersPerSquad: 24,
                roleLimits: { POR: 3, DIF: 7, CEN: 8, ATT: 6 },
                budgetBase: 400,
                // 400 piu' il residuo della stagione precedente
                budgetPerSquadra: {
                    'MARCHINHOS': 418, 'BOCA MOMIX': 405, 'ATLETICO JACK': 405,
                    'DINAMO BOSH': 443, 'REAL PIX': 400, 'MOTTENTUS': 412,
                    'SPARTA BRAGA': 401, 'FANTAMACHO': 406
                },
                regolaTurno: 'acquirente',
                modificatoreDifesa: false,
                storico: 'STORICO_MANAGER_1996'
            }
        };

        let legaCorrente = 'fantalissandria';
        try {
            const lg = localStorage.getItem('legaCorrente');
            if (lg && LEGHE[lg]) legaCorrente = lg;
        } catch (e) { /* predefinito */ }

        function lega() { return LEGHE[legaCorrente]; }

        /** Il modulo storico della lega scelta, se caricato. */
        function storicoLega() {
            const nome = lega().storico;
            if (typeof window !== 'undefined' && window[nome]) return window[nome];
            return null;
        }

        /**
         * Applica la configurazione della lega scelta.
         *
         * Non tocca le rose: chiamata con azzera=false serve a riallineare
         * le costanti al caricamento della pagina. Con azzera=true azzera
         * tutto, perche' passare da una lega all'altra significa iniziare
         * un'asta diversa, con rosa e budget diversi.
         */
        function applicaLega(chiave, azzera) {
            if (!LEGHE[chiave]) return;
            legaCorrente = chiave;
            try { localStorage.setItem('legaCorrente', chiave); } catch (e) {}

            const L = lega();
            PLAYERS_PER_SQUAD = L.playersPerSquad;
            ROLE_LIMITS = Object.assign({}, L.roleLimits);
            BUDGET_TOTAL = L.budgetBase;
            regolaTurno = L.regolaTurno;
            try { localStorage.setItem('regolaTurno', regolaTurno); } catch (e) {}

            // Riconfigura anche l'agente: rosa, budget e soprattutto il
            // modificatore difesa, che nella 1996 non esiste e va spento.
            try {
                if (typeof AI_AGENT !== 'undefined' && AI_AGENT.configuraLega) {
                    AI_AGENT.configuraLega(L);
                }
            } catch (e) { console.warn('configuraLega non riuscita:', e); }

            const titolo = document.getElementById('appTitle');
            if (titolo) titolo.textContent = L.titolo;

            const btn = document.getElementById('btnManagerReali');
            const st = storicoLega();
            if (btn) btn.style.display = (st && st.partecipanti202627) ? 'block' : 'none';

            if (azzera) {
                teams = {};
                initializeTeams();
                applicaBudgetDiLega();
                teamOrder = [];
                orderConfirmed = false;
                teamNamesConfirmed = false;
                undoStack = [];
                try {
                    localStorage.removeItem('fantacalcio_config_completed');
                    localStorage.removeItem('astaReports');
                    localStorage.removeItem('giocatoriManuali');
                } catch (e) {}
                azzeraNoteAvversari();
                azzeraEsitoReport();
                saveData();
            }

            aggiornaBottoniRegolaTurno();
            aggiornaBottoniLega();
        }
        window.applicaLega = applicaLega;

        /** Assegna a ogni squadra il proprio budget di partenza, se la lega ne prevede di diversi. */
        function applicaBudgetDiLega() {
            const perSquadra = lega().budgetPerSquadra;
            for (let i = 1; i <= 8; i++) {
                if (!teams[i]) continue;
                let b = lega().budgetBase;
                if (perSquadra) {
                    const trovato = perSquadra[String(teams[i].name).toUpperCase()];
                    if (typeof trovato === 'number') b = trovato;
                }
                const speso = teams[i].spent || 0;
                teams[i].budgetIniziale = b;
                teams[i].budget = b - speso;
            }
        }
        window.applicaBudgetDiLega = applicaBudgetDiLega;

        function cambiaLega(chiave) {
            if (!LEGHE[chiave] || chiave === legaCorrente) return;
            if (!confirm('Passare a ' + LEGHE[chiave].nome +
                         '? Rose, ordine e report della lega attuale verranno azzerati.')) return;
            applicaLega(chiave, true);
            location.reload();
        }
        window.cambiaLega = cambiaLega;

        function aggiornaBottoniLega() {
            Object.keys(LEGHE).forEach(k => {
                const b = document.getElementById('btnLega_' + k);
                if (b) b.classList.toggle('active', k === legaCorrente);
            });
        }

        // Non piu' costanti: dipendono dalla lega scelta. Restano con gli
        // stessi nomi perche' sono lette in una trentina di punti.
        let PLAYERS_PER_SQUAD = lega().playersPerSquad;
        let ROLE_LIMITS = Object.assign({}, lega().roleLimits);

        // Liste per generazione nomi casuali (generaSquadreRandom)
        const PAROLE_NOMI = [
            'Falco', 'Orso', 'Leone', 'Tigre', 'Lupo', 'Aquila', 'Drago', 'Serpente',
            'Fuoco', 'Ghiaccio', 'Tempesta', 'Fulmine', 'Nebbia', 'Ombra', 'Luce', 'Oscurità',
            'Rosso', 'Blu', 'Verde', 'Oro', 'Argento', 'Nero', 'Bianco', 'Viola',
            'Nord', 'Sud', 'Est', 'Ovest', 'Caos', 'Ordine', 'Vuoto', 'Eterno'
        ];

        // VARIABILI GLOBALI - Stato dell'applicazione
        let teams = {};
        let selectedPlayer = null;
        let selectedTeam = null;
        let orderConfirmed = false;
        let teamOrder = [];
        // Posizione in teamOrder di chi chiama adesso. Non persistita
        // separatamente, come teamOrder: vive solo per la sessione corrente.
        let turnoIndex = 0;
        let conversationHistory = [];
        let teamNamesConfirmed = false;

        // Fase in corso: calcolata dai dati, sovrascrivibile manualmente
        // se c'è un errore di registrazione.
        let phaseOverride = null;

        // Quali pannelli note sono aperti (sopravvive ai re-render della griglia)
        const notePanelAperti = new Set();

        // Storico degli acquisti registrati, per annullarli in caso di errore
        // (prezzo sbagliato, squadra sbagliata). Ogni voce e' tutto cio' che
        // serve a rimettere lo stato com'era PRIMA di quell'acquisto: il
        // giocatore, chi l'aveva preso, quanto era stato pagato, e la
        // posizione del turno di chiamata. Tenuto a 30 voci: serve a
        // correggere un errore appena fatto, non a rifare l'asta.
        let undoStack = [];
        const UNDO_MAX = 30;

        // Filtro sui calciatori specialisti dei piazzati (campo setPieces)
        const activeSetPieces = new Set();

        /**
         * Versione di questo file. Confrontata con quella dichiarata
         * nell'HTML: se non coincidono, il browser sta usando file di
         * versioni diverse — quasi sempre per una cache non aggiornata.
         */
        const APP_VERSION = '3.9.9.44';

        /**
         * REGOLA DEL TURNO DI CHIAMATA — cambia fra le due leghe.
         *
         *   'chiamante' (Fantalissandria): l'ordine e' prestabilito e fisso.
         *       Il turno avanza di una posizione rispetto a CHI HA CHIAMATO;
         *       chi si aggiudica il giocatore non conta.
         *
         *   'acquirente' (Lega Fantacalcio 1996): il turno avanza di una
         *       posizione rispetto a CHI HA COMPRATO. Chiama il fantallenatore
         *       che, nell'ordine estratto, viene subito dopo chi si e' appena
         *       aggiudicato il giocatore.
         *
         * Conseguenza tattica della seconda, che vale la pena ricordare:
         * aggiudicarsi un giocatore costa anche la chiamata, che passa al
         * proprio vicino d'ordine. Chi compra molto la regala sempre allo
         * stesso. E lo stesso fantallenatore puo' chiamare due volte di
         * fila in modo del tutto legittimo — se chiama A e compra la squadra
         * che precede A nell'ordine, tocca di nuovo ad A.
         */
        let regolaTurno = 'chiamante';
        try {
            const rt = localStorage.getItem('regolaTurno');
            if (rt === 'chiamante' || rt === 'acquirente') regolaTurno = rt;
        } catch (e) { /* predefinito */ }

        function impostaRegolaTurno(regola) {
            if (regola !== 'chiamante' && regola !== 'acquirente') return;
            regolaTurno = regola;
            try { localStorage.setItem('regolaTurno', regola); } catch (e) {}
            aggiornaBottoniRegolaTurno();
            aggiornaTurnoChiamata();
        }

        function aggiornaBottoniRegolaTurno() {
            const a = document.getElementById('btnTurnoChiamante');
            const b = document.getElementById('btnTurnoAcquirente');
            if (a) a.classList.toggle('active', regolaTurno === 'chiamante');
            if (b) b.classList.toggle('active', regolaTurno === 'acquirente');
        }
        window.impostaRegolaTurno = impostaRegolaTurno;

        /**
         * BUDGET DI PARTENZA, PER SQUADRA.
         *
         * A Fantalissandria tutte partono da 500 e BUDGET_TOTAL bastava.
         * Nella Lega Fantacalcio 1996 si parte da 400 piu' il residuo della
         * stagione precedente, che e' diverso per ciascuno: Dinamo Bosh 443,
         * Real Pix 400, e cosi' via. Da qui in poi il valore va chiesto alla
         * squadra, non alla costante — che resta come valore predefinito.
         */
        function budgetIniziale(teamNum) {
            const t = teams[teamNum];
            if (t && typeof t.budgetIniziale === 'number') return t.budgetIniziale;
            return BUDGET_TOTAL;
        }
        window.budgetIniziale = budgetIniziale;

        /** Come sopra, quando si ha gia' l'oggetto squadra invece del numero. */
        function budgetInizialeDi(team) {
            return (team && typeof team.budgetIniziale === 'number')
                ? team.budgetIniziale : BUDGET_TOTAL;
        }

        // Vista della Panoramica Squadre: 'expanded' o 'compact'.
        // Dichiarata qui, insieme agli altri globali, perche' ora la legge
        // anche renderTeamsOverview(): con 'let' piu' in basso nel file
        // sarebbe finita in temporal dead zone se un render fosse partito
        // prima che quella riga venisse eseguita.
        let overviewMode = 'expanded';

        // ==========================================
        // LOGICA DI FASE (asta per reparto)
        // ==========================================
        const ROLE_ORDER = ['POR', 'DIF', 'CEN', 'ATT'];

        /**
         * Ritorna il ruolo attualmente in asta, o null se la rosa è completa.
         * La fase avanza quando TUTTE le 8 squadre hanno riempito
         * tutti gli slot del ruolo in corso.
         * Se phaseOverride è impostato (manuale), usa quello.
         */
        function calcolaFaseCorrente() {
            if (phaseOverride) return phaseOverride;
            for (const role of ROLE_ORDER) {
                const limite = ROLE_LIMITS[role];
                let riempiti = 0;
                for (let k = 1; k <= 8; k++) {
                    if (!teams[k]) continue;
                    const count = teams[k].players.filter(p => p.role === role).length;
                    riempiti += Math.min(limite, count);
                }
                if (riempiti < limite * 8) return role;
            }
            return null; // asta completata
        }

        /**
         * Chi chiama adesso.
         *
         * turnoIndex e' solo un punto di partenza: dopo ogni acquisto
         * avanza di un passo, ma non deve essere sempre valido di per se'.
         * Questa funzione lo VERIFICA e lo corregge scorrendo in avanti
         * (al massimo 8 passi) finche' non trova una squadra che ha ancora
         * slot liberi nella fase corrente. Questo la rende robusta ai
         * cambi di fase (una squadra esclusa nella fase difensori torna
         * regolarmente in gioco quando si passa ai centrocampisti) senza
         * dover gestire quel caso a parte.
         */
        function prossimoChiamante() {
            if (!orderConfirmed || !teamOrder.length) return null;
            const fase = calcolaFaseCorrente();
            if (!fase) return null; // asta completata

            for (let passo = 0; passo < 8; passo++) {
                const idx = (turnoIndex + passo) % 8;
                const squadNum = teamOrder[idx];
                const team = teams[squadNum];
                if (!team) continue;
                const count = team.players.filter(p => p.role === fase).length;
                if (count < ROLE_LIMITS[fase]) {
                    return { idx, squadNum, team, fase };
                }
            }
            return null; // nessuna squadra ha slot liberi (non dovrebbe succedere)
        }

        /** Aggiorna il testo "e' il turno di chiamata di ..." nel pannello acquisto. */
        function aggiornaTurnoChiamata() {
            const el = document.getElementById('turnoChiamata');
            if (!el) return;
            const prossimo = prossimoChiamante();
            if (!prossimo) {
                el.textContent = '';
                el.style.display = 'none';
                return;
            }
            el.style.display = 'block';
            el.innerHTML = '📣 È il turno di chiamata di <strong>' +
                escapeAttr(prossimo.team.name) + '</strong>' +
                (regolaTurno === 'acquirente'
                    ? '<span style="color:#64748b;font-size:11px;"> · turno dopo l\'acquirente</span>'
                    : '');
        }
        window.aggiornaTurnoChiamata = aggiornaTurnoChiamata;

        /**
         * Override manuale della fase in caso di errore.
         * Uso da console: forzaFase('DIF') oppure forzaFase(null) per tornare automatico.
         */
        function forzaFase(ruolo) {
            const validi = ['POR', 'DIF', 'CEN', 'ATT', null];
            if (!validi.includes(ruolo)) {
                console.error('Ruolo non valido. Usa: POR, DIF, CEN, ATT, o null per automatico');
                return;
            }
            phaseOverride = ruolo;
            showMessage(ruolo
                ? `⚠️ Fase forzata manualmente: ${ruolo}`
                : '✅ Fase tornata in modalità automatica', 'error');
            updateDisplay();
        }
        window.forzaFase = forzaFase;
        window.calcolaFaseCorrente = calcolaFaseCorrente;

        // ==========================================
        // STRATEGIE DI BUDGET
        // ==========================================
        /**
         * RIPARTIZIONE DEL BUDGET PER REPARTO — fonte unica: l'agente.
         *
         * Qui c'era una tabella propria dell'app, rimasta alla taratura
         * precedente e divergente da quella dell'agente di 45-50 crediti
         * sull'attacco (BILANCIATA: app 235, agente 280). Le due vivevano
         * nello stesso riquadro a schermo dicendo cose diverse: il
         * "Budget di fase" contava su una ripartizione, il "Prossimo
         * target" una riga sotto su un'altra, e i consigli segnalavano
         * sforamenti su spese che il dashboard aveva appena autorizzato.
         *
         * La tabella dell'agente e' quella giusta per due conferme
         * indipendenti: la revisione fatta verificando fmStorica contro
         * mvStorica (un portiere o un difensore economico ha voto simile
         * a uno costoso, ma non rendimento simile), e la tabella Laudantes
         * "FANTA A 8 CON MODIFICATORE" — POR 27-35, DIF 70-75, CEN max 120,
         * ~300 per gli attaccanti. Scostamento dal centro di quelle bande:
         * 17 crediti per l'agente, 83 per la vecchia tabella dell'app.
         *
         * Ora l'app legge da AI_AGENT.strategies. La copia locale resta
         * solo come rete di sicurezza se l'agente non fosse caricato.
         */
        const STRATEGIE_FALLBACK = {
            conservativa:        { name: 'CONSERVATIVA',      POR: 0.06, DIF: 0.15, CEN: 0.27, ATT: 0.52 },
            bilanciata:          { name: 'BILANCIATA',        POR: 0.06, DIF: 0.13, CEN: 0.25, ATT: 0.56 },
            aggressiva:          { name: 'AGGRESSIVA',        POR: 0.04, DIF: 0.10, CEN: 0.20, ATT: 0.66 },
            'centrocampo-first': { name: 'CENTROCAMPO-FIRST', POR: 0.06, DIF: 0.12, CEN: 0.35, ATT: 0.47 }
        };

        /** Le strategie in uso: quelle dell'agente se disponibile. */
        function strategie() {
            if (typeof AI_AGENT !== 'undefined' && AI_AGENT.strategies) return AI_AGENT.strategies;
            return STRATEGIE_FALLBACK;
        }

        var currentStrategy = 'bilanciata'; // default

        // Mappa di squadre Serie A → abbreviazioni
        const TEAM_ABBR = {
            'Atalanta': 'ATA',
            'Bologna': 'BOL',
            'Cagliari': 'CAG',
            'Como': 'CMO',
            'Fiorentina': 'FIO',
            'Frosinone': 'FRO',
            'Genoa': 'GEN',
            'Inter': 'INT',
            'Juventus': 'JUV',
            'Lazio': 'LAZ',
            'Lecce': 'LEC',
            'Milan': 'MIL',
            'Monza': 'MON',
            'Napoli': 'NAP',
            'Parma': 'PAR',
            'Roma': 'ROM',
            'Sassuolo': 'SAS',
            'Torino': 'TOR',
            'Udinese': 'UDI',
            'Venezia': 'VEN'
        };

        function getTeamAbbr(teamName) {
            return TEAM_ABBR[teamName] || teamName;
        }

        // ==========================================
        // SWITCH STRATEGIA
        // ==========================================
        function switchStrategy(strategyName) {
            currentStrategy = strategyName;
            
            // Sincronizza TUTTI i bottoni (sia in "La mia squadra" che in "Panoramica")
            document.querySelectorAll('.strategy-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelectorAll(`[data-strategy="${strategyName}"]`).forEach(btn => {
                btn.classList.add('active');
            });
            
            // Aggiorna il dashboard e la panoramica
            updateDisplay();
            renderTeamsOverview();
        }

        // ==========================================
        // CALCOLO BUDGET INTELLIGENTE PER RUOLI
        // ==========================================

        function calculateSmartBudget(teamNum) {
            const team = teams[teamNum];
            const strategy = strategie()[currentStrategy];
            
            // Ruoli mancanti
            const missingRoles = {};
            ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                const current = team.players.filter(p => p.role === role).length;
                const limit = ROLE_LIMITS[role];
                missingRoles[role] = limit - current;
            });
            
            // Budget rimanente
            const budgetLeft = team.budget;
            
            // Per ogni ruolo, calcola quanto riservare agli altri
            const smartBudgets = {};
            const targetBudgets = {};
            
            ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                const targetPct = strategy[role];
                const targetAmount = Math.round(budgetInizialeDi(team) * targetPct);
                const spent = team.players.filter(p => p.role === role).reduce((sum, p) => sum + p.price, 0);
                
                targetBudgets[role] = targetAmount;
                
                if (missingRoles[role] > 0) {
                    // Se mancano giocatori in questo ruolo, calcola quanto puoi spendere
                    // risparmiando il target per gli altri ruoli mancanti
                    
                    let reservedForOthers = 0;
                    ['POR', 'DIF', 'CEN', 'ATT'].forEach(otherRole => {
                        if (otherRole !== role && missingRoles[otherRole] > 0) {
                            const otherTarget = Math.round(budgetInizialeDi(team) * strategy[otherRole]);
                            const otherSpent = team.players.filter(p => p.role === otherRole).reduce((sum, p) => sum + p.price, 0);
                            const otherNeeded = Math.max(0, otherTarget - otherSpent);
                            reservedForOthers += otherNeeded;
                        }
                    });
                    
                    smartBudgets[role] = Math.max(1, budgetLeft - reservedForOthers);
                } else {
                    smartBudgets[role] = 0; // Ruolo completo
                }
            });
            
            return { smartBudgets, targetBudgets, missingRoles, budgetLeft };
        }

        // ==========================================
        // FUNZIONI DI SETUP E CONFIGURAZIONE
        // ==========================================

        // Inizializza squadre con nomi di default
        function initializeTeams(names = null) {
            teams = {};
            for (let i = 1; i <= 8; i++) {
                // Conserva il budget iniziale gia' impostato per questa
                // squadra (es. corretto a mano nella schermata dei residui),
                // altrimenti parte dal predefinito.
                const precedente = teams && teams[i] && typeof teams[i].budgetIniziale === 'number'
                    ? teams[i].budgetIniziale : BUDGET_TOTAL;
                teams[i] = {
                    name: names ? names[i-1] : `Squadra ${i}`,
                    budgetIniziale: precedente,
                    budget: precedente,
                    spent: 0,
                    players: []
                };
            }
        }

        initializeTeams();

        // SETUP NOMI SQUADRE
        function initTeamNamesSetup() {
            const grid = document.getElementById('setupNamesGrid');
            grid.innerHTML = '';
            for (let i = 1; i <= 8; i++) {
                grid.innerHTML += `
                    <div class="setup-input-group">
                        <label>Squadra ${i}</label>
                        <input type="text" id="teamName${i}" placeholder="Nome squadra" value="Squadra ${i}">
                    </div>
                `;
            }
        }

        function confirmTeamNames() {
            const names = [];
            for (let i = 1; i <= 8; i++) {
                const name = document.getElementById(`teamName${i}`).value.trim();
                if (!name) {
                    alert('Inserisci un nome per ogni squadra');
                    return;
                }
                names.push(name);
            }

            initializeTeams(names);
            teamNamesConfirmed = true;
            // classList.add('hidden') da solo non bastava: una regola .hidden
            // generica non e' mai esistita nel CSS (c'era solo
            // .order-display.hidden, che non si applica a questa sezione).
            // Si imposta anche display, come fanno tutti gli altri punti.
            nascondiSetupNomi();
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('myTeamName').textContent = teams[1].name;
            initSetup();
            saveData();
            
            // Salva lo stato di configurazione completata
            localStorage.setItem('fantacalcio_config_completed', 'true');
        }

        function resetAll() {
            if (!confirm('Cancellare TUTTO (asta, dati, squadre)? Non si può annullare!')) {
                return;
            }
            
            localStorage.removeItem('fantacalcio_v3_1');
            localStorage.removeItem('fantacalcio_config_completed');
            localStorage.removeItem('astaReports');
            localStorage.removeItem('giocatoriManuali');
            azzeraNoteAvversari();
            azzeraEsitoReport();
            undoStack = [];
            teamNamesConfirmed = false;
            orderConfirmed = false;
            teamOrder = [];
            turnoIndex = 0;
            conversationHistory = [];
            initializeTeams();
            
            // Ripulisci i report live dal DOM
            const reportBody = document.getElementById('reportLiveBody');
            if (reportBody) reportBody.innerHTML = '';
            const reportCount = document.getElementById('reportLiveCount');
            if (reportCount) {
                reportCount.textContent = '0';
                reportCount.style.display = 'none';
            }
            
            document.getElementById('setupNamesSection').style.display = 'block';
            document.getElementById('setupSection').style.display = 'none';
            
            initTeamNamesSetup();
            updateDisplay();
            renderTeamsOverview();
            clearForm();
            
            showMessage('Tutto azzerato! ✨', 'success');
        }

        // GENERATORE SQUADRE RANDOM
        function generaSquadreRandom() {
            if (!confirm('Generare 8 nomi casuali e sorteggio? Sostituisce la configurazione attuale.')) {
                return;
            }
            
            // Genera 8 nomi casuali
            const nomi = [];
            const usate = new Set();
            while (nomi.length < 8) {
                const idx = Math.floor(Math.random() * PAROLE_NOMI.length);
                const parola = PAROLE_NOMI[idx];
                if (!usate.has(idx)) {
                    nomi.push(parola);
                    usate.add(idx);
                }
            }
            
            // Assegna nomi alle 8 squadre, ripartendo da rose vuote
            initializeTeams(nomi);
            teamNamesConfirmed = true;

            // Genera sorteggio casuale dell'ordine di estrazione
            const ordine = Array.from({length: 8}, (_, i) => i + 1);
            for (let i = ordine.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
            }
            teamOrder = ordine;
            orderConfirmed = true;
            turnoIndex = 0;

            /**
             * Salvare PRIMA di ricaricare.
             * loadData() rilegge tutto da localStorage: se i nomi non sono
             * ancora stati scritti li' sopra, sovrascrive quelli appena
             * generati con i vecchi. Era questo il bug per cui i nomi
             * casuali non comparivano nei bottoni e nella panoramica.
             */
            saveData();
            localStorage.setItem('fantacalcio_config_completed', 'true');

            // Nuova asta di prova: i report della precedente non servono piu'
            localStorage.removeItem('astaReports');
            const rb = document.getElementById('reportLiveBody');
            if (rb) rb.innerHTML = '';
            const rc = document.getElementById('reportLiveCount');
            if (rc) { rc.textContent = '0'; rc.style.display = 'none'; }
            conversationHistory = [];

            // Mostra il setup completato
            document.getElementById('setupNamesSection').style.display = 'none';
            document.getElementById('setupSection').style.display = 'none';
            const mine = document.getElementById('myTeamName');
            if (mine) mine.textContent = teams[1].name;

            initTeamButtons();
            renderTeamsOverview();
            updateDisplay();
            filterAvailable();
            aggiornaTurnoChiamata();

            showMessage('✨ ' + nomi.join(', ') + ' — Pronto a giocare!', 'success');
        }

        /**
         * Carica gli 8 manager reali della lega, se e' disponibile un
         * modulo storico (STORICO_MANAGER.partecipanti202627). A differenza
         * di generaSquadreRandom() i nomi non sono a caso: sono quelli con
         * cui l'agente riconosce i profili comportamentali storici. Usare
         * nomi diversi (o il generatore casuale) in asta vera vanificherebbe
         * tutto il lavoro di profilazione, perche' il match e' per nome
         * esatto (case-insensitive).
         *
         * L'ordine di chiamata NON viene sorteggiato qui: il metodo del
         * sorteggio reale non e' ancora deciso, quindi si compilano solo i
         * nomi e si passa alla schermata di scelta ordine manuale gia'
         * esistente (stesso punto in cui arriva il flusso con nomi digitati
         * a mano).
         */
        /** Chiude la schermata "Configurazione Squadre". */
        function nascondiSetupNomi() {
            const el = document.getElementById('setupNamesSection');
            if (!el) return;
            el.classList.add('hidden');
            el.style.display = 'none';
        }

        function caricaManagerReali() {
            const st = storicoLega();
            if (!st || !st.partecipanti202627) {
                showMessage('Nessun elenco manager disponibile per ' + lega().nome + '.', 'error');
                return;
            }
            const nomi = st.partecipanti202627;
            if (!confirm('Impostare le 8 squadre con i nomi reali (' + nomi.join(', ') +
                         ")? L'ordine di chiamata lo scegli tu nella schermata successiva.")) {
                return;
            }

            // 'IO' e' sempre la squadra di Polibio: va in prima posizione,
            // dove myTeamNum punta di default.
            // La squadra di Polibio va in prima posizione, dove punta
            // myTeamNum: si chiama 'IO' a Fantalissandria e 'MARCHINHOS'
            // nella Lega Fantacalcio 1996.
            const ordinati = nomi.slice();
            const idxIo = ordinati.findIndex(
                (n) => ['IO', 'MARCHINHOS'].includes(String(n).toUpperCase()));
            if (idxIo > 0) {
                const io = ordinati.splice(idxIo, 1)[0];
                ordinati.unshift(io);
            }

            // Stesso identico passo del flusso a nomi manuali: compila i
            // nomi, poi passa alla schermata di scelta ordine (initSetup),
            // senza toccare teamOrder ne' orderConfirmed.
            initializeTeams(ordinati);
            // Con i nomi noti si possono assegnare i budget di partenza
            // previsti dalla lega (nella 1996 sono diversi per squadra).
            applicaBudgetDiLega();
            teamNamesConfirmed = true;
            // classList.add('hidden') da solo non bastava: una regola .hidden
            // generica non e' mai esistita nel CSS (c'era solo
            // .order-display.hidden, che non si applica a questa sezione).
            // Si imposta anche display, come fanno tutti gli altri punti.
            nascondiSetupNomi();
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('myTeamName').textContent = teams[1].name;
            initSetup();
            // Senza questo, ricaricando la pagina la schermata dei nomi
            // tornava a comparire: gli altri due percorsi lo facevano gia',
            // questo no.
            localStorage.setItem('fantacalcio_config_completed', 'true');
            saveData();

            // Nuova asta: i report della sessione precedente non servono piu'
            localStorage.removeItem('astaReports');
            const rb = document.getElementById('reportLiveBody');
            if (rb) rb.innerHTML = '';
            const rc = document.getElementById('reportLiveCount');
            if (rc) { rc.textContent = '0'; rc.style.display = 'none'; }
            conversationHistory = [];

            showMessage('✨ Manager caricati: ' + ordinati.join(', ') +
                        '. Scegli l\u2019ordine di chiamata qui sotto.', 'success');
        }
        window.caricaManagerReali = caricaManagerReali;
        function initSetup() {
            const grid = document.getElementById('setupGrid');
            grid.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                let options = '<option value="">-- Seleziona --</option>';
                for (let j = 1; j <= 8; j++) {
                    options += `<option value="${j}">${teams[j].name}</option>`;
                }
                grid.innerHTML += `
                    <div class="setup-input-group">
                        <label>Posizione ${i + 1}</label>
                        <select id="setupInput${i}">
                            ${options}
                        </select>
                    </div>
                `;
            }
        }

        function confirmOrder() {
            const inputs = [];
            for (let i = 0; i < 8; i++) {
                const val = parseInt(document.getElementById(`setupInput${i}`).value);
                if (!val || val < 1 || val > 8) {
                    alert('Inserisci numeri validi da 1 a 8');
                    return;
                }
                inputs.push(val);
            }

            // Controlla duplicati
            if (new Set(inputs).size !== 8) {
                alert('Ogni squadra deve apparire una sola volta');
                return;
            }

            teamOrder = inputs;
            orderConfirmed = true;
            turnoIndex = 0;
            document.getElementById('setupSection').style.display = 'none';
            initTeamButtons();
            renderTeamsOverview();
            loadData();
            aggiornaTurnoChiamata();
        }

        function resetSetup() {
            teamOrder = [];
            turnoIndex = 0;
            orderConfirmed = false;
            document.getElementById('setupSection').style.display = 'block';
            initSetup();
        }


        // TEAM BUTTONS
        function initTeamButtons() {
            const container = document.getElementById('teamButtons');
            container.innerHTML = '';
            teamOrder.forEach((squad, idx) => {
                container.innerHTML += `
                    <button class="team-button" onclick="selectTeam(${squad}, this)">
                        ${teams[squad].name}
                    </button>
                `;
            });
        }

        // DOWNLOAD ASTA
        function downloadAstaJSON() {
            const data = {
                timestamp: new Date().toISOString(),
                teams: teams,
                teamOrder: teamOrder,
                conversationHistory: conversationHistory,
                configCompleted: localStorage.getItem('fantacalcio_config_completed') === 'true'
            };

            const dataStr = JSON.stringify(data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `asta_fantacalcio_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);

            showMessage('Asta salvata! 💾', 'success');
        }

        function loadAstaJSON(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Ripristina i dati
                    teams = data.teams || teams;
                    teamOrder = data.teamOrder || teamOrder;
                    conversationHistory = data.conversationHistory || conversationHistory;
                    orderConfirmed = true; // Marca l'ordine come confermato
                    
                    // MIGRAZIONE: Riempi il campo 'team' mancante per giocatori vecchi
                    for (let i = 1; i <= 8; i++) {
                        if (teams[i] && teams[i].players) {
                            teams[i].players.forEach(p => {
                                if (!p.team && typeof PLAYERS_DATA !== 'undefined') {
                                    // Cerca il giocatore nel dataset e recupera il team
                                    const playerData = PLAYERS_DATA.find(pd => pd.id === p.id);
                                    if (playerData) {
                                        p.team = playerData.team;
                                    }
                                }
                            });
                        }
                    }
                    
                    // Ripristina il flag di configurazione completata
                    if (data.configCompleted) {
                        localStorage.setItem('fantacalcio_config_completed', 'true');
                    }
                    
                    // La conferma a schermo si riferiva all'asta precedente
                    azzeraEsitoReport();

                    // Salva in localStorage
                    saveData();
                    
                    // Nascondi il setup dal DOM
                    const setupElement = document.getElementById('setupNamesSection');
                    if (setupElement) {
                        setupElement.style.display = 'none';
                    }
                    
                    // L'ordine di chiamata non ha piu' un riquadro dedicato:
                    // chi chiama adesso lo dice aggiornaTurnoChiamata() nel
                    // pannello Registra Acquisto, aggiornandosi da solo.
                    if (teamOrder && teamOrder.length > 0) {
                        document.getElementById('setupSection').style.display = 'none';
                        orderConfirmed = true;
                    }
                    
                    // Reinizializza i bottoni squadre
                    initTeamButtons();
                    
                    // Aggiorna il nome della mia squadra
                    document.getElementById('myTeamName').textContent = teams[1].name;
                    
                    // Aggiorna la visualizzazione
                    updateDisplay();
                    renderTeamsOverview();
                    filterAvailable();
                    aggiornaTurnoChiamata();
                    
                    showMessage('Asta caricata con successo! 📤', 'success');
                } catch (error) {
                    showMessage('Errore nel caricamento del file: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }

        function selectTeam(teamNum, btn) {
            // La classe evidenziata dal CSS e' '.team-button.active'.
            // Qui si usava 'selected', che nel foglio di stile non esiste:
            // la squadra veniva selezionata davvero, ma il bottone non si
            // accendeva e non si capiva quale fosse scelta.
            document.querySelectorAll('.team-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTeam = teamNum;
        }

        // AUTOCOMPLETE
        document.addEventListener('DOMContentLoaded', function() {
            initTeamNamesSetup();
            if (typeof PLAYERS_DATA !== 'undefined') {
                setupAutocomplete();
            }
        });

        function getRolesInDeficit() {
            // Conta quanti giocatori per ruolo sono stati comprati in TUTTE le squadre
            const roleCounts = { POR: 0, DIF: 0, CEN: 0, ATT: 0 };
            const roleMaxes = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };
            
            // Somma i giocatori per ruolo in tutte le squadre
            for (let i = 1; i <= 8; i++) {
                teams[i].players.forEach(p => {
                    if (roleCounts[p.role] !== undefined) {
                        roleCounts[p.role]++;
                    }
                });
            }
            
            // Ritorna i ruoli che NON sono ancora completi in tutte le squadre (8 * limite)
            const deficitRoles = new Set();
            for (const role in roleCounts) {
                const totalNeeded = 8 * roleMaxes[role]; // 8 squadre x limite per ruolo
                if (roleCounts[role] < totalNeeded) {
                    deficitRoles.add(role);
                }
            }
            
            return deficitRoles.size > 0 ? deficitRoles : new Set(['POR', 'DIF', 'CEN', 'ATT']);
        }

        function clearPlayerSearch() {
            document.getElementById('playerSearch').value = '';
            document.getElementById('clearSearchBtn').style.display = 'none';
            document.getElementById('autocompleteList').classList.remove('active');
            selectedPlayer = null;
            document.getElementById('playerInfo').style.display = 'none';
        }

        function setupAutocomplete() {
            const input = document.getElementById('playerSearch');
            const list = document.getElementById('autocompleteList');
            const clearBtn = document.getElementById('clearSearchBtn');

            input.addEventListener('input', function() {
                const query = this.value.toLowerCase();
                
                // Mostra/nascondi il bottone x
                clearBtn.style.display = query.length > 0 ? 'block' : 'none';
                
                if (query.length < 1) {
                    list.classList.remove('active');
                    return;
                }

                // Escludi giocatori già comprati
                const soldIds = new Set(
                    Object.values(teams).flatMap(t => t.players.map(p => p.id))
                );

                // Ottieni i ruoli in deficit
                const rolesInDeficit = getRolesInDeficit();

                const filtered = PLAYERS_DATA.filter(p => {
                    if (soldIds.has(p.id)) return false;
                    if (!rolesInDeficit.has(p.role)) return false; // Filtra per ruoli in deficit
                    return p.name.toLowerCase().includes(query) ||
                           p.team.toLowerCase().includes(query);
                }).slice(0, 10);

                if (filtered.length === 0) {
                    list.classList.remove('active');
                    return;
                }

                list.innerHTML = filtered.map(p => `
                    <div class="autocomplete-item" onclick="selectPlayer(${p.id}, '${escapeAttr(p.name)}', '${p.role}', '${escapeAttr(p.team)}')">
                        <div class="name">${p.name}</div>
                        <div class="info">${p.team} • ${p.role}</div>
                    </div>
                `).join('');
                list.classList.add('active');
            });
        }

        /**
         * Pannello informativo del giocatore selezionato.
         * Legge i dati dal listone e, se l'agente è caricato, la scheda
         * tattica completa. Pensato per la lettura a colpo d'occhio
         * durante l'asta: prima il tetto di prezzo, poi il resto.
         */
        function renderPlayerInfo(id, name, role, team) {
            const box = document.getElementById('playerInfo');
            if (!box) return;
            box.style.display = 'block';

            const p = (typeof PLAYERS_DATA !== 'undefined')
                ? PLAYERS_DATA.find(x => x.id === id) : null;

            if (!p) {
                box.innerHTML = `
                    <div style="color:#94a3b8;">Squadra: <span style="color:#60a5fa;">${escapeHtml(team || '')}</span></div>
                    <div style="color:#94a3b8;margin-top:4px;">Ruolo: <span style="color:#60a5fa;">${escapeHtml(role || '')}</span></div>`;
                return;
            }

            // Scheda tattica dall'agente (se disponibile)
            let sch = null;
            try {
                if (typeof AI_AGENT !== 'undefined' && AI_AGENT.schedaCompleta) {
                    sch = AI_AGENT.schedaCompleta(p, PLAYERS_DATA);
                }
            } catch (e) { sch = null; }

            const tier = p.tierConsensus || p.tier || '—';
            const tierCls = 'tier-' + String(tier).replace(/\+/g, 'plus').replace(/-/g, 'minus');
            const pma = (p.pma != null) ? Math.round(p.pma * 10) / 10 : '—';
            const tetto = sch && sch.prezzoMaxConsigliato != null ? sch.prezzoMaxConsigliato : null;
            const tit = (p.expectedTitolarita != null) ? Math.round(p.expectedTitolarita) : null;

            const verdColor = {
                'PRIORITA MASSIMA': '#4ade80',
                'OCCASIONE DA MODIFICATORE': '#38bdf8',
                'EVITA': '#f87171'
            };
            const verd = sch && sch.verdetto ? sch.verdetto : (p.verdict || null);

            let html = '';

            // Riga 1: nome, tier, verdetto
            html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
                <span style="color:#60a5fa;font-weight:700;font-size:15px;">${escapeHtml(p.name)}</span>
                <span class="${tierCls}" style="font-weight:700;font-size:12px;padding:2px 6px;border-radius:3px;">${tier}</span>
                <span style="color:#94a3b8;font-size:12px;">${escapeHtml(p.team || '')} · ${p.role}</span>
            </div>`;

            // Riga 2: i due numeri che contano in asta
            html += `<div style="display:flex;gap:8px;margin-bottom:8px;">
                <div style="flex:1;background:#1e293b;padding:6px 8px;border-radius:4px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Mercato</div>
                    <div style="font-size:16px;color:#e2e8f0;font-weight:700;">${pma}</div>
                </div>
                <div style="flex:1;background:#1e293b;padding:6px 8px;border-radius:4px;${tetto != null ? 'border:1px solid #4ade8055;' : ''}">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Non superare</div>
                    <div style="font-size:16px;color:${tetto != null ? '#4ade80' : '#64748b'};font-weight:700;">${tetto != null ? tetto : '—'}</div>
                </div>
            </div>`;

            // Riga 3: indicatori
            const chip = (label, val, color) =>
                `<span style="font-size:11px;color:#94a3b8;">${label} <b style="color:${color};">${val}</b></span>`;
            const chips = [];
            if (p.qualityScore != null) chips.push(chip('Qualità', Math.round(p.qualityScore), '#e2e8f0'));

            /**
             * "Convenienza" mostrava Math.round(p.valueScore), cioe' il campo
             * inaffidabile del listone: due giocatori quasi identici per
             * prezzo e resa risultavano 18 e 95. Ora l'indicatore e' la resa
             * attesa a stagione calcolata da AI_AGENT.convenienza(), la stessa
             * che ordina il bottone VALORE — cosi' scheda e ordinamento
             * dicono la stessa cosa invece di contraddirsi.
             */
            try {
                if (typeof AI_AGENT !== 'undefined' && AI_AGENT.convenienza &&
                    typeof PLAYERS_DATA !== 'undefined') {
                    const pari = PLAYERS_DATA.filter(x => x.role === p.role);
                    const cv = AI_AGENT.convenienza(p, pari);
                    if (cv && cv.puntiAttesi != null) {
                        chips.push(chip('Resa attesa', cv.puntiAttesi + ' pt',
                            cv.puntiAttesi >= 25 ? '#4ade80'
                          : cv.puntiAttesi >= 10 ? '#fbbf24' : '#e2e8f0'));
                    }
                    if (cv && cv.posizionePerEfficienza && cv.suQuanti) {
                        chips.push(chip('Efficienza',
                            cv.posizionePerEfficienza + 'º/' + cv.suQuanti, '#e2e8f0'));
                    }
                }
            } catch (e) { /* scheda comunque utilizzabile senza questi indicatori */ }
            if (tit != null) chips.push(chip('Titolarità', tit + '%',
                tit >= 80 ? '#4ade80' : tit >= 60 ? '#fbbf24' : '#f87171'));
            if (chips.length) {
                html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">${chips.join('')}</div>`;
            }

            if (verd) {
                html += `<div style="font-size:12px;font-weight:700;color:${verdColor[verd] || '#cbd5e1'};margin-bottom:8px;">${escapeHtml(verd)}</div>`;
            }

            // Rigoristi e piazzati: valgono punti veri
            if (sch && sch.piazzati && sch.piazzati.length) {
                html += `<div style="font-size:11px;color:#fbbf24;margin-bottom:6px;">⚽ ${sch.piazzati.map(escapeHtml).join(', ')}</div>`;
            }
            if (sch && sch.rischi && sch.rischi.length) {
                html += `<div style="font-size:11px;color:#f87171;margin-bottom:6px;">⚠️ ${sch.rischi.map(escapeHtml).join(', ')}</div>`;
            }

            // Compagni di reparto: l'agente ne restituisce gia' i primi 3
            if (sch && sch.compagniDiReparto && sch.compagniDiReparto.length) {
                const top = sch.compagniDiReparto;
                const altri = sch.compagniDiReparto.altriNonMostrati || 0;
                html += `<div style="border-top:1px solid #334155;padding-top:6px;margin-top:6px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Stesso ruolo, stessa squadra</div>`;
                top.forEach(c => {
                    html += `<div style="font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;">
                        <span>${escapeHtml(c.nome)} <span style="color:#64748b;">${c.tier}</span></span>
                        <span>${c.titolarita}% · ${c.prezzoMercato}</span>
                    </div>`;
                });
                if (altri > 0) {
                    html += `<div style="font-size:10px;color:#475569;margin-top:2px;">+${altri} altri</div>`;
                }
                html += `</div>`;
            }

            box.innerHTML = html;
        }

        function selectPlayer(id, name, role, team) {
            selectedPlayer = { id, name, role, team };
            document.getElementById('playerSearch').value = name;
            document.getElementById('autocompleteList').classList.remove('active');
            renderPlayerInfo(id, name, role, team);
        }

        // REGISTRA ACQUISTO
        // ==========================================
        // FUNZIONI DI ACQUISTO E REGISTRAZIONE
        // ==========================================

        function registerPurchase() {
            if (!selectedPlayer) {
                showMessage('Seleziona un giocatore', 'error');
                return;
            }
            if (!selectedTeam) {
                showMessage('Seleziona una squadra', 'error');
                return;
            }
            const price = parseInt(document.getElementById('playerPrice').value);
            if (!price || price < 1) {
                showMessage('Inserisci un prezzo valido', 'error');
                return;
            }

            const team = teams[selectedTeam];

            // Chi aveva davvero il turno di chiamata PRIMA di questo acquisto.
            // Serve piu' avanti per far avanzare il turno dalla posizione
            // giusta: turnoIndex da solo puo' essere rimasto indietro su una
            // squadra che nel frattempo ha completato il reparto.
            const chiamanteCorrente = prossimoChiamante();

            if (team.budget < price) {
                showMessage('Budget insufficiente', 'error');
                return;
            }

            // Controlla se già comprato
            if (team.players.some(p => p.id === selectedPlayer.id)) {
                showMessage('Giocatore già nella squadra', 'error');
                return;
            }

            // CONTROLLA VINCOLI DI RUOLO
            const roleCount = team.players.filter(p => p.role === selectedPlayer.role).length;
            const roleLimit = ROLE_LIMITS[selectedPlayer.role];
            if (roleCount >= roleLimit) {
                showMessage(`Hai già ${roleLimit} ${selectedPlayer.role}! Limite raggiunto.`, 'error');
                return;
            }

            // LOCK DI FASE: in asta a reparti si registra solo il ruolo in corso.
            // Il blocco si applica quando il ruolo del giocatore non corrisponde
            // alla fase attiva — ma non impedisce di completare acquisti del
            // proprio reparto anche se altre squadre sono indietro.
            const faseCorrente = calcolaFaseCorrente();
            if (faseCorrente && selectedPlayer.role !== faseCorrente) {
                const prossimaFase = ROLE_ORDER[ROLE_ORDER.indexOf(selectedPlayer.role)];
                showMessage(
                    `Fase ${faseCorrente}: puoi registrare solo ${faseCorrente} adesso. ` +
                    `I ${selectedPlayer.role} si chiamano dopo. ` +
                    `(Console: forzaFase('${selectedPlayer.role}') per override manuale)`,
                    'error'
                );
                return;
            }

            team.players.push({
                id: selectedPlayer.id,
                name: selectedPlayer.name,
                role: selectedPlayer.role,
                squad: selectedPlayer.squad,
                team: selectedPlayer.team,
                price: price
            });

            team.spent += price;
            team.budget -= price;

            // Salva quanto serve ad annullare questo acquisto (P1)
            undoStack.push({
                teamNum: selectedTeam,
                playerId: selectedPlayer.id,
                playerName: selectedPlayer.name,
                price: price,
                turnoIndexPrima: turnoIndex,
                phaseOverridePrima: phaseOverride
            });
            if (undoStack.length > UNDO_MAX) undoStack.shift();

            const playerName = selectedPlayer.name; // salva prima di clearForm
            saveData();

            // AVANZAMENTO DEL TURNO.
            //
            // Prima qui c'era 'turnoIndex = (turnoIndex + 1) % 8', contando
            // sul fatto che prossimoChiamante() sarebbe andato avanti da solo
            // saltando le squadre che hanno gia' chiuso il reparto. Ma quel
            // salto non veniva mai riscritto in turnoIndex: se il chiamante
            // reale era due posizioni piu' avanti (perche' le squadre in mezzo
            // avevano completato il ruolo), l'indice avanzava di uno solo e
            // finiva per fermarsi di nuovo sulla stessa squadra, che chiamava
            // due volte di fila.
            //
            // Adesso il turno riparte dalla posizione giusta, quindi le
            // squadre che hanno finito il reparto restano fuori dal giro
            // finche' non si apre la fase successiva.
            //
            // Da quale posizione si riparte dipende dalla lega (vedi
            // regolaTurno): dal chiamante a Fantalissandria, da chi ha
            // comprato nella Lega Fantacalcio 1996.
            let idxPartenza = null;
            if (regolaTurno === 'acquirente') {
                const posAcquirente = teamOrder.indexOf(selectedTeam);
                if (posAcquirente !== -1) idxPartenza = posAcquirente;
            } else if (chiamanteCorrente) {
                idxPartenza = chiamanteCorrente.idx;
            }
            turnoIndex = (idxPartenza !== null)
                ? (idxPartenza + 1) % 8
                : (turnoIndex + 1) % 8;

            updateDisplay();
            renderTeamsOverview();
            filterAvailable();
            setupAutocomplete(); // Aggiorna il filtro autocomplete
            clearForm();
            aggiornaTurnoChiamata();
            showMessage(`${playerName} aggiunto a ${team.name}`, 'success');

            // AVANZAMENTO FASE: controlla se questo acquisto ha completato il reparto.
            // Mostra una notifica persistente — l'asta è a reparti, è il momento
            // più importante dell'asta, non deve sparire dopo 2 secondi.
            const nuovaFase = calcolaFaseCorrente();
            if (nuovaFase !== faseCorrente) {
                const msg = nuovaFase
                    ? `✅ Fase ${faseCorrente} completata! Tutte le squadre hanno i loro ${faseCorrente}. Si passa ai ${nuovaFase}.`
                    : `🏆 Asta completata! Tutte le rose sono piene.`;
                // Timeout breve per non sovrascrivere il success del singolo acquisto
                setTimeout(() => showMessage(msg, 'error'), 2200);
            }
        }

        /**
         * P1 — ANNULLA L'ULTIMO ACQUISTO REGISTRATO.
         *
         * Serve a correggere un errore di battitura sul prezzo o
         * un'assegnazione alla squadra sbagliata: si annulla e si
         * ri-registra corretto, invece di dover azzerare la rosa.
         *
         * Rimette esattamente lo stato precedente: toglie il giocatore,
         * restituisce i crediti, e riporta indietro il turno di chiamata
         * (altrimenti l'ordine slitterebbe di una posizione a ogni
         * correzione). Si puo' premere piu' volte per risalire indietro.
         */
        function annullaUltimoAcquisto() {
            if (!undoStack.length) {
                showMessage('Nessun acquisto da annullare.', 'error');
                return;
            }

            const ultimo = undoStack[undoStack.length - 1];
            const team = teams[ultimo.teamNum];
            if (!team) {
                undoStack.pop();
                showMessage('Squadra non trovata: voce scartata.', 'error');
                return;
            }

            const idx = team.players.map(p => p.id).lastIndexOf(ultimo.playerId);
            if (idx === -1) {
                undoStack.pop();
                showMessage('Il giocatore non risulta piu\' in rosa: voce scartata.', 'error');
                updateDisplay();
                return;
            }

            const rimosso = team.players[idx];
            if (!confirm('Annullare l\'acquisto di ' + rimosso.name +
                         ' (' + rimosso.price + 'M) da parte di ' + team.name + '?')) {
                return;
            }

            team.players.splice(idx, 1);
            team.spent -= rimosso.price;
            team.budget += rimosso.price;

            // Riporta indietro anche il turno e l'eventuale fase forzata,
            // cosi' l'annullamento e' davvero un ritorno allo stato di prima
            // e non lascia l'ordine di chiamata sfalsato.
            turnoIndex = ultimo.turnoIndexPrima;
            phaseOverride = ultimo.phaseOverridePrima;

            undoStack.pop();
            saveData();
            updateDisplay();
            renderTeamsOverview();
            filterAvailable();
            setupAutocomplete();
            aggiornaTurnoChiamata();
            showMessage('Annullato: ' + rimosso.name + ' torna disponibile, ' +
                        rimosso.price + 'M restituiti a ' + team.name + '.', 'success');
        }
        window.annullaUltimoAcquisto = annullaUltimoAcquisto;

        /**
         * P5 — A CHE PUNTO SIAMO.
         *
         * Due numeri diversi e complementari: quanto manca a chiudere il
         * REPARTO in corso (che e' quello che detta il ritmo, perche' l'asta
         * e' a reparti in sequenza) e quanto manca a chiudere TUTTA l'asta.
         * Il totale e' il numero di slot che le 8 squadre devono riempire,
         * non il listone: 24 portieri, 64 difensori, 64 centrocampisti,
         * 48 attaccanti, 200 in tutto.
         */
        function calcolaAvanzamento() {
            const nSquadre = 8;
            let presiTot = 0, slotTot = 0;
            const perRuolo = {};

            ROLE_ORDER.forEach(role => {
                const limite = ROLE_LIMITS[role];
                const slotRuolo = limite * nSquadre;
                let presiRuolo = 0;
                for (let k = 1; k <= nSquadre; k++) {
                    if (!teams[k]) continue;
                    presiRuolo += Math.min(limite, teams[k].players.filter(p => p.role === role).length);
                }
                perRuolo[role] = { presi: presiRuolo, slot: slotRuolo };
                presiTot += presiRuolo;
                slotTot += slotRuolo;
            });

            const fase = calcolaFaseCorrente();
            return {
                fase: fase,
                fasePresi: fase ? perRuolo[fase].presi : 0,
                faseSlot: fase ? perRuolo[fase].slot : 0,
                fasePct: fase ? Math.round((perRuolo[fase].presi / perRuolo[fase].slot) * 100) : 100,
                totPresi: presiTot,
                totSlot: slotTot,
                totPct: slotTot ? Math.round((presiTot / slotTot) * 100) : 0
            };
        }
        window.calcolaAvanzamento = calcolaAvanzamento;

        // ==========================================
        // FUNZIONI DI VISUALIZZAZIONE
        // ==========================================

        function updateDisplay() {
            const myTeam = teams[1];

            document.getElementById('mySpent').textContent = myTeam.spent;
            document.getElementById('mySpentPct').textContent = 
                `${((myTeam.spent / budgetInizialeDi(myTeam)) * 100).toFixed(1)}%`;
            
            document.getElementById('playerCount').textContent = `${myTeam.players.length}/${PLAYERS_PER_SQUAD}`;
            document.getElementById('budgetLeft').textContent = myTeam.budget;
            document.getElementById('budgetLeftPct').textContent = 
                `${((myTeam.budget / budgetInizialeDi(myTeam)) * 100).toFixed(1)}%`;

            const counts = { POR: 0, DIF: 0, CEN: 0, ATT: 0 };
            myTeam.players.forEach(p => counts[p.role]++);
            Object.keys(counts).forEach(role => {
                document.getElementById(`count-${role}`).textContent = `${counts[role]}/${ROLE_LIMITS[role]}`;
            });

            // ==========================================
            // AGGIORNA DASHBOARD TATTICO
            // ==========================================
            const budgetData = calculateSmartBudget(1);
            const dashboardPanel = document.getElementById('strategicDashboard');
            
            if (dashboardPanel) {
                let dashboardHtml = '';
                
                // Estratto della strategia attiva
                const strategy = strategie()[currentStrategy];
                dashboardHtml += `<div style="font-size: 10px; color: #60a5fa; margin-bottom: 8px; font-weight: 600;">STRATEGIA: ${strategy.name}</div>`;
                
                // Per ogni ruolo
                ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                    const current = myTeam.players.filter(p => p.role === role).length;
                    const limit = ROLE_LIMITS[role];
                    const spent = myTeam.players.filter(p => p.role === role).reduce((sum, p) => sum + p.price, 0);
                    const targetAmount = budgetData.targetBudgets[role];
                    const targetPct = (strategy[role] * 100).toFixed(0);
                    const spentPct = ((spent / budgetInizialeDi(myTeam)) * 100).toFixed(1);
                    const missing = limit - current;
                    
                    let statusIcon = '✅';
                    let statusColor = '#4ade80';
                    if (Math.abs(spent - targetAmount) > targetAmount * 0.05) {
                        statusIcon = '🟡';
                        statusColor = '#fbbf24';
                    }
                    if (Math.abs(spent - targetAmount) > targetAmount * 0.10) {
                        statusIcon = '🔴';
                        statusColor = '#ef4444';
                    }
                    
                    dashboardHtml += `
                        <div style="font-size: 11px; margin-bottom: 6px; color: #cbd5e1;">
                            <span style="color: #93c5fd; font-weight: 600;">${role}</span>: ${spent}M (${spentPct}%) | 
                            TARGET: ${targetPct}% | ${current}/${limit} ${statusIcon}
                        </div>
                    `;
                });
                
                dashboardHtml += `<div style="border-top: 1px solid #334155; padding-top: 8px; margin-top: 8px; font-size: 10px;">`;
                
                // Ruoli mancanti
                const missingList = [];
                ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                    if (budgetData.missingRoles[role] > 0) {
                        const smartBudget = budgetData.smartBudgets[role];
                        const targetAmount = budgetData.targetBudgets[role];
                        const reserved = budgetData.budgetLeft - smartBudget;
                        missingList.push(`${role} (max ${smartBudget}M, riservato altrui: ${reserved}M)`);
                    }
                });
                
                if (missingList.length > 0) {
                    dashboardHtml += `<div style="color: #fbbf24; font-weight: 600; margin-bottom: 4px;">⚠️ SLOT MANCANTI:</div>`;
                    missingList.forEach(item => {
                        dashboardHtml += `<div style="color: #cbd5e1; margin-bottom: 2px;">• ${item}</div>`;
                    });
                } else {
                    dashboardHtml += `<div style="color: #4ade80; font-weight: 600;">✅ SQUADRA COMPLETA!</div>`;
                }
                
                dashboardHtml += `</div>`;

                // ==========================================
                // P3 — CHE TIPO DI GIOCATORE PUNTARE ADESSO
                //
                // L'agente calcola gia' questa indicazione
                // (prossimaFasciaConsigliata): guarda i tier che ho gia'
                // preso in questo ruolo, quanto budget resta davvero al
                // netto della panchina da riempire, e su quello dice il tier
                // del prossimo colpo. Finora viveva solo dentro il testo del
                // report: qui diventa visibile senza doverlo generare.
                //
                // I prezzi vengono corretti sull'inflazione reale di questa
                // asta quando ci sono abbastanza acquisti nel reparto per
                // misurarla; se il calcolo non e' disponibile la riga
                // semplicemente non compare, senza rompere il resto.
                // ==========================================
                try {
                    const faseAttuale = calcolaFaseCorrente();
                    if (faseAttuale && typeof AI_AGENT !== 'undefined' &&
                        AI_AGENT.prossimaFasciaConsigliata &&
                        typeof PLAYERS_DATA !== 'undefined') {

                        let inflazioneFase = null;
                        try {
                            const m = AI_AGENT.mercatoPerReparto(teams, PLAYERS_DATA, 1);
                            inflazioneFase = (m && m.inflazionePerReparto)
                                ? m.inflazionePerReparto[faseAttuale] : null;
                        } catch (e) { /* inflazione non calcolabile: si usa il listino */ }

                        const pf = AI_AGENT.prossimaFasciaConsigliata(
                            myTeam, currentStrategy, faseAttuale,
                            PLAYERS_DATA, inflazioneFase, null
                        );

                        if (pf && pf.messaggio) {
                            const completo = !!pf.completo;
                            dashboardHtml += `
                                <div style="border-top: 1px solid #334155; padding-top: 8px; margin-top: 8px;">
                                    <div style="font-size: 10px; color: ${completo ? '#4ade80' : '#fbbf24'}; font-weight: 600; margin-bottom: 4px;">
                                        ${completo ? '✅ TARGET' : '🎯 PROSSIMO TARGET'}
                                    </div>
                                    <div style="font-size: 11px; color: #e2e8f0; line-height: 1.5;">
                                        ${escapeHtml(pf.messaggio)}
                                    </div>
                                </div>`;
                        }
                    }
                } catch (e) {
                    console.warn('prossimaFasciaConsigliata non disponibile:', e);
                }

                dashboardPanel.innerHTML = dashboardHtml;
            }

            renderLeagueDashboard();

            // INDICATORE DI FASE nell'header
            const faseEl = document.getElementById('faseIndicator');
            if (faseEl) {
                const fase = calcolaFaseCorrente();
                const colori = { POR: '#f59e0b', DIF: '#3b82f6', CEN: '#10b981', ATT: '#ef4444' };
                if (fase) {
                    const nomi = { POR: 'PORTIERI', DIF: 'DIFENSORI', CEN: 'CENTROCAMPISTI', ATT: 'ATTACCANTI' };
                    faseEl.textContent = `FASE: ${nomi[fase]}`;
                    faseEl.style.background = (colori[fase] || '#6b7280') + '33';
                    faseEl.style.color = colori[fase] || '#fff';
                    if (phaseOverride) faseEl.textContent += ' ⚠️';
                } else {
                    faseEl.textContent = '🏆 ASTA COMPLETATA';
                    faseEl.style.background = '#10b98133';
                    faseEl.style.color = '#10b981';
                }
            }

            // P5 — avanzamento reparto + avanzamento totale
            const progEl = document.getElementById('astaProgress');
            if (progEl) {
                const av = calcolaAvanzamento();
                if (av.fase) {
                    progEl.innerHTML =
                        `<span style="color:#93c5fd;">${av.fase}</span> ` +
                        `${av.fasePresi}/${av.faseSlot} (${av.fasePct}%)` +
                        `<span style="color:#475569;"> · </span>` +
                        `<span style="color:#94a3b8;">asta</span> ` +
                        `${av.totPresi}/${av.totSlot} (${av.totPct}%)`;
                } else {
                    progEl.innerHTML = `<span style="color:#10b981;">200/200 (100%)</span>`;
                }
            }
        }

        /**
         * P9 — DASHBOARD DELLE 8 SQUADRE.
         *
         * Sostituisce la vecchia lista "I miei giocatori", che ripeteva
         * quello che si vede gia' nella Panoramica Squadre. Qui invece
         * stanno, per tutte e otto, i tre numeri che servono a leggere il
         * tavolo mentre si chiama: quanto hanno speso, quanto gli resta, e
         * quanti slot hanno riempito ruolo per ruolo (non x/25, che non dice
         * nulla in un'asta a reparti).
         *
         * In piu' due indicazioni che in asta contano piu' del budget nudo:
         *   - MAX: la piu' alta offerta che quella squadra puo' ancora fare
         *     tenendo 1 credito per ogni slot che le resta da riempire. E'
         *     il vero tetto di un avversario, non il budget residuo.
         *   - il chipleader per budget residuo, evidenziato.
         */
        function renderLeagueDashboard() {
            const box = document.getElementById('leagueDashboard');
            if (!box) return;

            const ordine = orderConfirmed ? teamOrder : [1, 2, 3, 4, 5, 6, 7, 8];
            const fase = calcolaFaseCorrente();

            // Chipleader = chi ha piu' budget residuo (a parita', chi ha piu'
            // slot ancora liberi, perche' quel budget deve coprirne di piu').
            let leader = null, maxBudget = -1;
            ordine.forEach(i => {
                const t = teams[i];
                if (t && t.budget > maxBudget) { maxBudget = t.budget; leader = i; }
            });

            let html = '';
            ordine.forEach(i => {
                const t = teams[i];
                if (!t) return;

                const isMine = i === 1;
                const isLeader = i === leader && t.budget > 0;
                const spentPct = Math.round((t.spent / budgetInizialeDi(t)) * 100);
                const budgetPct = Math.round((t.budget / budgetInizialeDi(t)) * 100);

                const slotLiberi = PLAYERS_PER_SQUAD - t.players.length;
                // Tenendo 1 credito per ogni altro slot da riempire
                const maxOfferta = Math.max(0, t.budget - Math.max(0, slotLiberi - 1));

                let ruoliHtml = '';
                ROLE_ORDER.forEach(role => {
                    const dentro = t.players.filter(p => p.role === role);
                    const n = dentro.length;
                    const lim = ROLE_LIMITS[role];
                    const pieno = n >= lim;
                    const inFase = role === fase;
                    // Quota di budget INIZIALE (500) finita in questo reparto:
                    // e' il numero che rende confrontabili due squadre a
                    // prescindere da quanto abbiano gia' speso in totale.
                    const speso = dentro.reduce((s, p) => s + p.price, 0);
                    // Una cifra decimale con la virgola: sotto il 10% servono
                    // i decimi per distinguere due reparti, sopra restano
                    // leggibili lo stesso.
                    const quota = ((speso / budgetInizialeDi(t)) * 100).toFixed(1).replace('.', ',');
                    ruoliHtml += `<span class="ld-role${pieno ? ' full' : ''}${inFase ? ' now' : ''}">` +
                                 `${role.charAt(0)}<b>${n}</b>/${lim}` +
                                 `<em>${speso}M</em><i>${quota}%</i></span>`;
                });

                html += `
                    <div class="ld-card${isMine ? ' mine' : ''}${isLeader ? ' leader' : ''}">
                        <div class="ld-name">${escapeHtml(t.name)}${isLeader ? ' <span class="ld-crown" title="Piu\' budget residuo">♛</span>' : ''}</div>
                        <div class="ld-figures">
                            <span class="ld-spent">${t.spent}<i>M</i> <em>${spentPct}%</em></span>
                            <span class="ld-budget">${t.budget}<i>M</i> <em>${budgetPct}%</em></span>
                        </div>
                        <div class="ld-roles">${ruoliHtml}</div>
                        <div class="ld-max">max <b>${maxOfferta}</b>M</div>
                    </div>`;
            });

            box.innerHTML = html;
        }
        window.renderLeagueDashboard = renderLeagueDashboard;

        function renderTeamsOverview() {
            const grid = document.getElementById('teamsGrid');
            let html = '';

            // Se l'ordine è stato confermato, usa quello; altrimenti usa ordine standard
            const displayOrder = orderConfirmed ? teamOrder : [1, 2, 3, 4, 5, 6, 7, 8];

            // Lookup tier per id, calcolato una volta sola: team.players non
            // salva il tier (solo id/nome/ruolo/squadra/prezzo), va recuperato
            // dal listone completo. Si legge PLAYERS_DATA direttamente (come
            // fa renderPlayerInfo) invece di passare da getPlayers() di
            // fantacalcio_ai.js: PLAYERS_DATA è un globale definito da
            // players_data.js, caricato per primo, quindi è sempre
            // disponibile qui a prescindere dall'ordine degli altri script
            // o da cosa l'agente esporta su window.
            const tierById = {};
            (typeof PLAYERS_DATA !== 'undefined' ? PLAYERS_DATA : []).forEach(pd => {
                tierById[pd.id] = pd.tierConsensus || pd.tier || null;
            });

            for (let idx = 0; idx < displayOrder.length; idx++) {
                const i = displayOrder[idx];
                const team = teams[i];
                const isMyTeam = i === 1;
                const spentPct = ((team.spent / budgetInizialeDi(team)) * 100).toFixed(1);
                const budgetPct = ((team.budget / budgetInizialeDi(team)) * 100).toFixed(1);

                const playersByRole = { POR: [], DIF: [], CEN: [], ATT: [] };
                team.players.forEach(p => {
                    playersByRole[p.role].push(p);
                });

                let playersHtml = '';
                ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                    if (playersByRole[role].length > 0) {
                        // Calcola totale speso per questo ruolo
                        const roleTotal = playersByRole[role].reduce((sum, p) => sum + p.price, 0);
                        const rolePct = ((roleTotal / budgetInizialeDi(team)) * 100).toFixed(1);
                        
                        playersHtml += `<div class="team-role">${role} (${roleTotal}M, ${rolePct}%)</div>`;
                        playersByRole[role].forEach(p => {
                            const playerPct = ((p.price / budgetInizialeDi(team)) * 100).toFixed(1);
                            const teamAbbr = getTeamAbbr(p.team);
                            const tier = tierById[p.id] || '-';
                            playersHtml += `<div class="team-player-row">
                                <span class="tp-name" title="${escapeHtml(p.name)}">${p.name}</span>
                                <span class="tp-abbr">${teamAbbr}</span>
                                <span class="tp-tier tp-tier-${escapeHtml(tier)}">${tier}</span>
                                <span class="tp-price">${p.price}M<span class="tp-pct">${playerPct}%</span></span>
                            </div>`;
                        });
                    }
                });

                // PANNELLO NOTE AVVERSARI (non sulla propria squadra)
                let noteHtml = '';
                if (!isMyTeam) {
                    const aperta = notePanelAperti.has(i);
                    const nt = (typeof note === 'function') ? (note(i) || {}) : {};
                    const attivi = nt.pattern || [];
                    const testo = nt.testo || '';
                    const nMarcati = attivi.length + (testo ? 1 : 0);

                    let corpo = '';
                    if (aperta) {
                        const patterns = (typeof patternDisponibili === 'function')
                            ? patternDisponibili() : [];
                        corpo += '<div class="note-patterns">';
                        patterns.forEach(pt => {
                            const on = attivi.includes(pt.id);
                            corpo += `<label class="note-check${on ? ' on' : ''}">
                                <input type="checkbox" ${on ? 'checked' : ''}
                                    onchange="toggleNotaPattern(${i}, '${pt.id}')">
                                <span>${escapeHtml(pt.label)}</span>
                            </label>`;
                        });
                        corpo += '</div>';
                        // oninput salva a ogni carattere ma NON ridisegna (il
                        // re-render rifa' l'HTML della griglia e farebbe
                        // perdere il fuoco a meta' parola); onchange, che
                        // scatta all'uscita dal campo, ridisegna una volta sola.
                        corpo += `<textarea class="note-text" rows="3" maxlength="400"
                            placeholder="Cosa noti al tavolo... (una nota per riga)"
                            oninput="salvaNotaTesto(${i}, this.value, true)"
                            onchange="salvaNotaTesto(${i}, this.value)">${escapeHtml(testo)}</textarea>`;
                    }

                    noteHtml = `
                        <div class="note-panel">
                            <button class="note-toggle" onclick="toggleNotePanel(${i})">
                                📝 Note${nMarcati ? ` <span class="note-badge">${nMarcati}</span>` : ''}
                                <span style="float:right;">${aperta ? '▾' : '▸'}</span>
                            </button>
                            ${corpo}
                        </div>`;
                }

                // STRATEGIA RILEVATA — ora anche sulla propria squadra.
                //
                // Sugli avversari serve a capire cosa stanno facendo; su di se'
                // serve a un controllo diverso ma altrettanto utile: la
                // strategia che hai SCELTO coi bottoni e quella che stai
                // davvero seguendo possono divergere, se l'andamento dell'asta
                // ti ha costretto a virare. Il riquadro legge la spesa reale,
                // non il bottone premuto, quindi lo scarto si vede.
                let strategyHtml = '';
                if (typeof AI_AGENT !== 'undefined' && AI_AGENT.inferOpponentStrategy) {
                    const inf = AI_AGENT.inferOpponentStrategy(team, i);
                    const muto = ['NESSUN ACQUISTO', 'TROPPO PRESTO PER DIRLO']
                        .includes(inf.strategy);

                    // Sotto il 50% la diagnosi non e' certa, ma nasconderla
                    // non aiuta: si mostra l'ipotesi preceduta da ~ e con la
                    // confidenza accanto, cosi' si legge per quello che e'.
                    let testo;
                    if (muto) {
                        testo = inf.strategy;
                    } else if (inf.strategy === 'INDIZI DEBOLI') {
                        testo = inf.sbilanciamento
                            ? `SBILANCIATA SU ${inf.sbilanciamento}`
                            : 'INDIZI DEBOLI';
                    } else {
                        testo = `${inf.certa ? '' : '~'}${inf.strategy}` +
                                ` <span class="ts-conf">${inf.confidence}%</span>`;
                    }

                    const tip = [inf.dettaglio, inf.nota,
                        inf.scostamentoMedio != null
                            ? 'scostamento medio ' + inf.scostamentoMedio + ' punti' : null,
                        inf.sbilanciamento
                            ? 'spende su ' + inf.sbilanciamento + ' ' +
                              inf.eccessoSbilanciamento + ' punti oltre ogni strategia' : null
                    ].filter(Boolean).join(' · ');

                    // Sulla propria squadra si segnala anche se la rotta
                    // reale si discosta da quella impostata coi bottoni.
                    let divergenza = '';
                    if (isMyTeam && !muto && inf.ipotesi) {
                        const scelta = (strategie()[currentStrategy] || {}).name;
                        if (scelta && inf.ipotesi !== scelta && inf.confidence >= 25) {
                            divergenza = ` <span class="ts-diverge" title="Hai impostato ${escapeHtml(scelta)}">≠</span>`;
                        }
                    }

                    strategyHtml = `<div class="team-strategy${(muto || !inf.certa) ? ' weak' : ''}${isMyTeam ? ' mine' : ''}"
                            title="${escapeHtml(tip)}">${testo}${divergenza}</div>`;
                }

                html += `
                    <div class="team-card ${isMyTeam ? 'my-team' : ''}">
                        <h4>${team.name}</h4>
                        ${strategyHtml}
                        <div class="team-stats-row">
                            <div class="team-stat-item">
                                <div class="label">Speso</div>
                                <div class="value">${team.spent}M</div>
                                <div class="subvalue">${spentPct}%</div>
                            </div>
                            <div class="team-stat-item">
                                <div class="label">Budget</div>
                                <div class="value">${team.budget}M</div>
                                <div class="subvalue">${budgetPct}%</div>
                            </div>
                            <div class="team-stat-item">
                                <div class="label">Giocatori</div>
                                <div class="value">${team.players.length}/${PLAYERS_PER_SQUAD}</div>
                            </div>
                        </div>
                        <div class="team-players${overviewMode === 'expanded' ? ' overview-expanded' : ''}">
                            ${playersHtml || '<div style="color: #64748b; font-size: 12px;">Nessun giocatore ancora</div>'}
                        </div>
                        ${noteHtml}
                    </div>
                `;
            }

            grid.innerHTML = html;
        }

        // ==========================================
        // NOTE AVVERSARI (A8)
        // Le crocette le legge l'agente e correggono i calcoli di pressione.
        // Il testo libero non viene interpretato dal codice ma viaggia
        // nel report, quindi arriva a chi lo legge.
        // ==========================================
        /**
         * Azzera le note sugli avversari in modo completo.
         *
         * Serve un helper perche' le note vivono in DUE posti: la voce
         * 'noteAvversari' in localStorage e la cache window.noteAvversari che
         * getNote() consulta per prima. Togliendo solo la prima, le note
         * tornerebbero comunque a comparire fino al ricaricamento della
         * pagina. Si svuota anche l'elenco dei pannelli aperti, altrimenti
         * dopo il reset i riquadri resterebbero espansi su note inesistenti.
         */
        function azzeraNoteAvversari() {
            try {
                if (typeof AI_AGENT !== 'undefined' && AI_AGENT.azzeraNote) {
                    AI_AGENT.azzeraNote();
                }
            } catch (e) { /* si prosegue comunque con la pulizia diretta */ }
            try { localStorage.removeItem('noteAvversari'); } catch (e) {}
            if (typeof window !== 'undefined') window.noteAvversari = null;
            notePanelAperti.clear();
        }
        window.azzeraNoteAvversari = azzeraNoteAvversari;

        function toggleNotePanel(teamNum) {
            if (notePanelAperti.has(teamNum)) notePanelAperti.delete(teamNum);
            else notePanelAperti.add(teamNum);
            renderTeamsOverview();
        }

        function toggleNotaPattern(teamNum, patternId) {
            if (typeof nota !== 'function') return;
            const corrente = (note(teamNum) || {}).pattern || [];
            const nuovo = corrente.includes(patternId)
                ? corrente.filter(x => x !== patternId)
                : corrente.concat([patternId]);
            nota(teamNum, nuovo);
            renderTeamsOverview();
        }

        /**
         * Salva il testo libero di una nota.
         *
         * senzaRender=true durante la digitazione: il testo finisce subito in
         * memoria (niente va perso se chiudi il pannello di colpo) ma la
         * griglia non viene ridisegnata, altrimenti la textarea verrebbe
         * ricreata a ogni tasto e perderesti il cursore.
         */
        function salvaNotaTesto(teamNum, testo, senzaRender) {
            if (typeof nota !== 'function') return;
            const corrente = (note(teamNum) || {}).pattern || [];
            nota(teamNum, corrente, (testo || '').trim() || null);
            if (!senzaRender) renderTeamsOverview();
        }

        window.toggleNotePanel = toggleNotePanel;
        window.toggleNotaPattern = toggleNotaPattern;
        window.salvaNotaTesto = salvaNotaTesto;

        /**
         * Pannello "la mia squadra", ora collassabile e in fondo alla colonna.
         *
         * Speso, budget e conteggi per ruolo si leggono gia' nel riquadro
         * della lega in cima (dove la propria squadra e' evidenziata), quindi
         * qui restano come approfondimento e non come intestazione fissa.
         * Lo stato aperto/chiuso e' ricordato fra una sessione e l'altra:
         * durante un'asta si tiene chiuso, a tavolino puo' far comodo aperto.
         */
        function toggleMySquadPanel() {
            const body = document.getElementById('mySquadBody');
            const chev = document.getElementById('mySquadChevron');
            if (!body) return;
            // Si commuta una CLASSE, non display: con display:none il
            // contenuto sparisce dal calcolo della larghezza e la colonna si
            // restringe. Il CSS lo tiene sempre presente e lo ritaglia solo
            // in altezza, cosi' la colonna resta larga uguale aperta o chiusa.
            const aperto = body.classList.toggle('aperto');
            if (chev) chev.innerHTML = aperto ? '&#9662;' : '&#9656;';
            try { localStorage.setItem('mySquadAperto', aperto ? '1' : '0'); } catch (e) {}
        }
        window.toggleMySquadPanel = toggleMySquadPanel;

        // Ripristina lo stato scelto l'ultima volta
        document.addEventListener('DOMContentLoaded', () => {
            let aperto = false;
            try { aperto = localStorage.getItem('mySquadAperto') === '1'; } catch (e) {}
            if (aperto) toggleMySquadPanel();
        });

        /** Sezione Utility collassabile: fuori dal flusso principale dell'asta. */
        function toggleUtility() {
            const body = document.getElementById('utilityBody');
            const chev = document.getElementById('utilityChevron');
            if (!body) return;
            const aperto = body.style.display !== 'none';
            body.style.display = aperto ? 'none' : 'flex';
            if (chev) chev.textContent = aperto ? '▸' : '▾';
        }
        window.toggleUtility = toggleUtility;
        window.setSortMode = setSortMode;

        // ==========================================
        // REPORT LIVE PANEL (v3.9.9c)
        // Pannello collassabile affiancato all'Agente IA
        // Legge da localStorage: nessuna dipendenza da servizi esterni
        // ==========================================
        let reportLiveAperto = true;  // pannello aperto di default

        function getReports() {
            try { return JSON.parse(localStorage.getItem('astaReports') || '[]'); }
            catch (e) { return []; }
        }

        function aggiornaBadgeReport() {
            const b = document.getElementById('reportLiveCount');
            if (!b) return;
            const n = getReports().length;
            b.textContent = n;
            b.style.display = n > 0 ? 'inline-block' : 'none';
        }

        function toggleReportLive() {
            reportLiveAperto = !reportLiveAperto;
            const body = document.getElementById('reportLiveBody');
            const chev = document.getElementById('reportLiveChevron');
            if (!body) return;
            
            body.style.display = reportLiveAperto ? 'block' : 'none';
            if (chev) chev.textContent = reportLiveAperto ? '▾' : '▸';
            
            if (reportLiveAperto) renderReportLiveBody();
        }

        function renderReportLiveBody() {
            const body = document.getElementById('reportLiveBody');
            if (!body) return;
            const reports = getReports().slice().reverse(); // più recente in alto

            if (!reports.length) {
                body.innerHTML = `<div style="padding:20px;text-align:center;color:#64748b;font-size:12px;">
                    Nessun report ancora. Premi "Invia report" per registrare lo stato dell'asta.</div>`;
                return;
            }

            body.innerHTML = reports.map((r, idx) => {
                const t = new Date(r.timestamp);
                const ora = isNaN(t) ? '' : t.toLocaleTimeString('it-IT');
                const aperto = idx === 0; // il più recente già aperto
                return `<div class="report-card">
                    <div class="report-head-row">
                        <button class="report-head" onclick="toggleReportCard(${r.id})">
                            <span><b>#${r.id}</b> <span style="color:#64748b;">${ora}</span></span>
                            <span id="repChev${r.id}">${aperto ? '▾' : '▸'}</span>
                        </button>
                        <button class="report-copy" id="repCopy${r.id}"
                                title="Copia tutto il report #${r.id}"
                                onclick="copiaReport(${r.id})">📋</button>
                    </div>
                    <pre class="report-body" id="repBody${r.id}"
                         style="display:${aperto ? 'block' : 'none'};">${formatReportHtml(r.report)}</pre>
                </div>`;
            }).join('');
        }

        function toggleReportCard(id) {
            const b = document.getElementById('repBody' + id);
            const c = document.getElementById('repChev' + id);
            if (!b) return;
            const aperto = b.style.display !== 'none';
            b.style.display = aperto ? 'none' : 'block';
            if (c) c.textContent = aperto ? '▸' : '▾';
        }

        /**
         * P4 — COPIA UN INTERO REPORT NEGLI APPUNTI.
         *
         * Copia il testo grezzo salvato (r.report), non l'HTML formattato:
         * e' quello che serve incollare altrove. Fallback su textarea +
         * execCommand perche' navigator.clipboard non e' disponibile ovunque
         * (in particolare su pagine non-https o su alcuni browser mobili).
         */
        function copiaReport(id) {
            const r = getReports().find(x => x.id === id);
            if (!r) { showMessage('Report #' + id + ' non trovato.', 'error'); return; }

            const testo = r.report || '';
            const conferma = () => {
                const b = document.getElementById('repCopy' + id);
                if (b) {
                    const prima = b.textContent;
                    b.textContent = '✅';
                    setTimeout(() => { b.textContent = prima; }, 1500);
                }
                showMessage('Report #' + id + ' copiato negli appunti.', 'success');
            };

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(testo).then(conferma).catch(() => copiaFallback(testo, conferma));
            } else {
                copiaFallback(testo, conferma);
            }
        }

        function copiaFallback(testo, poi) {
            const ta = document.createElement('textarea');
            ta.value = testo;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                poi();
            } catch (e) {
                showMessage('Copia non riuscita: seleziona il testo manualmente.', 'error');
            }
            document.body.removeChild(ta);
        }

        window.copiaReport = copiaReport;
        window.toggleReportLive = toggleReportLive;
        window.toggleReportCard = toggleReportCard;
        /** Svuota i report senza toccare l'asta in corso. */
        /** Mostra (sostituendola) la conferma dell'ultimo report salvato. */
        function mostraEsitoReport(id) {
            const c = document.getElementById('chatHistory');
            if (!c) return;
            c.innerHTML = `<div class="report-esito">✅ Report #${id} salvato</div>`;
        }

        /**
         * Azzera la riga di conferma nel pannello Agente IA.
         * Va chiamata ovunque l'asta cambi identita' — reset, caricamento di
         * un altro salvataggio, cancellazione dei report — altrimenti resta a
         * schermo la conferma di un report che non c'e' piu'.
         */
        function azzeraEsitoReport() {
            const c = document.getElementById('chatHistory');
            if (c) c.innerHTML = '';
            conversationHistory = [];
        }
        window.azzeraEsitoReport = azzeraEsitoReport;

        function svuotaReport() {
            const n = getReports().length;
            if (!n) { showMessage('Non ci sono report da cancellare.', 'success'); return; }
            if (!confirm('Cancellare i ' + n + ' report salvati? L\'asta non viene toccata.')) return;
            localStorage.removeItem('astaReports');
            const b = document.getElementById('reportLiveBody');
            if (b) b.innerHTML = '';
            azzeraEsitoReport();
            aggiornaBadgeReport();
            if (reportLiveAperto) renderReportLiveBody();
            showMessage('Report cancellati.', 'success');
        }

        window.svuotaReport = svuotaReport;
        window.renderReportLiveBody = renderReportLiveBody;

        function removeFromMySquad(playerId) {
            const myTeam = teams[1];
            const index = myTeam.players.findIndex(p => p.id === playerId);
            if (index > -1) {
                const removed = myTeam.players[index];
                myTeam.spent -= removed.price;
                myTeam.budget += removed.price;
                myTeam.players.splice(index, 1);
                saveData();
                updateDisplay();
                renderTeamsOverview();
            }
        }

        // ==========================================
        // RESET ROSE (senza reset squadre e ordine)
        // ==========================================
        function resetRose() {
            if (confirm('Ripristinare tutte le rose senza cambiare nomi squadre e ordine di estrazione?')) {
                // Resetta i giocatori di tutte le squadre
                for (let i = 1; i <= 8; i++) {
                    teams[i].players = [];
                    teams[i].spent = 0;
                    teams[i].budget = budgetIniziale(i);
                }
                
                // Resetta la conversazione con l'agente IA
                conversationHistory = [];

                // Le note sugli avversari descrivono i comportamenti di QUESTA
                // asta (chi rilancia, chi molla, chi accumula) e alimentano il
                // calcolo della pressione reale nell'agente: se restassero,
                // la nuova asta partirebbe con letture prese da un'altra
                // partita. Vanno azzerate qui, e non basta togliere la voce da
                // localStorage: getNote() legge prima la cache window.
                azzeraNoteAvversari();
                azzeraEsitoReport();

                // Anche lo storico degli annullamenti si riferisce ad acquisti
                // che non esistono piu'.
                undoStack = [];

                // Nuova asta con lo stesso ordine: il turno riparte dal primo
                turnoIndex = 0;

                // Salva i dati
                saveData();
                
                // Aggiorna la visualizzazione
                updateDisplay();
                renderTeamsOverview();
                filterAvailable();
                setupAutocomplete();
                aggiornaTurnoChiamata();

                showMessage('Rose resettate! Le squadre e l\'ordine rimangono invariati. 🔄', 'success');
            }
        }

        function clearForm() {
            document.getElementById('playerSearch').value = '';
            document.getElementById('playerPrice').value = '';
            document.getElementById('playerInfo').style.display = 'none';
            selectedPlayer = null;
            selectedTeam = null;
            document.querySelectorAll('.team-button').forEach(b => b.classList.remove('active'));
            document.getElementById('messageDiv').innerHTML = '';
        }

        function clearMySquad() {
            if (confirm('Sei sicuro?')) {
                teams[1].players = [];
                teams[1].spent = 0;
                teams[1].budget = budgetIniziale(1);
                saveData();
                updateDisplay();
                renderTeamsOverview();
            }
        }

        // ==========================================
        // FUNZIONI DI UTILITY E STORAGE
        // ==========================================

        function showMessage(text, type) {
            const div = document.getElementById('messageDiv');
            div.className = `message-div ${type}`;
            div.textContent = text;
            if (type === 'success') {
                setTimeout(() => div.innerHTML = '', 2000);
            }
        }

        // AGENTE IA

        /**
         * Grassetto per titoli di sezione e righe gia' segnalate come
         * importanti dal report stesso (icone). Si basa sulla struttura
         * reale del testo generato da formatReportForClaude(): i titoli
         * di sezione non hanno mai un trattino o uno spazio iniziale
         * ("RUOLI", "PIANO FASCE (...)"), i dettagli si ("- DIF: ...",
         * "  margine di..."). Applicato DOPO l'escape, cosi' non interviene
         * mai sul markup, solo sul testo gia' reso sicuro.
         */
        function formatReportHtml(text) {
            const escaped = escapeHtml(text);
            const iconePrefix = /^(✅|⚠️|🎯|💰|👀|🔴|🟡|👥|🔥)/;
            return escaped.split('\n').map(line => {
                const trimmed = line.replace(/^\s+/, '');
                if (!trimmed) return line;
                const isHeader = line === trimmed && !trimmed.startsWith('-') && !trimmed.startsWith('(');
                const isMarcata = iconePrefix.test(trimmed);
                return (isHeader || isMarcata) ? '<strong>' + line + '</strong>' : line;
            }).join('\n');
        }

        /**
         * Escape per stringhe dentro onclick="fn('...')".
         * Serve per nomi come N'DICKA e N'DRI: senza questo l'apostrofo
         * chiude la stringa JS e il click sulla riga non funziona.
         */
        function escapeHtml(text) {
            const map = {
                '&': '&amp;', '<': '&lt;', '>': '&gt;',
                '"': '&quot;', "'": '&#039;'
            };
            return String(text == null ? '' : text).replace(/[&<>"']/g, m => map[m]);
        }

        function escapeAttr(text) {
            return String(text == null ? '' : text)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/"/g, '&quot;');
        }

        function clearAvailableSearch() {
            document.getElementById('availableSearch').value = '';
            document.getElementById('clearAvailableSearchBtn').style.display = 'none';
            filterAvailable();
        }

        // VARIABILI FILTRI
        let activeRoles = new Set();
        let activeSortOrder = 'name-asc';
        let alphaDirAsc = true;  // per il toggle alfabetico: true = A-Z, false = Z-A
        let alphaEnabled = true; // ALFABETICO è attivo per default

        /**
         * Nuovo sistema di ordinamento ibrido:
         * - ALFABETICO: toggle on/off, indipendente
         * - TIER e VALORE: esclusivi tra loro
         * 
         * Combinazioni possibili:
         * - ALFABETICO solo (default)
         * - ALFABETICO + TIER
         * - ALFABETICO + VALORE
         * - TIER solo
         * - VALORE solo
         */
        function setSortMode(mode) {
            const buttons = document.querySelectorAll('.sort-toggle');
            
            if (mode === 'alpha') {
                const alphaBtn = document.getElementById('sortAlpha');
                const wasActive = alphaBtn.classList.contains('active');
                
                if (wasActive) {
                    // Se era già attivo, inverti la direzione (A-Z ↔ Z-A)
                    alphaDirAsc = !alphaDirAsc;
                    document.getElementById('alphaDir').textContent = alphaDirAsc ? '↑' : '↓';
                } else {
                    // Se non era attivo, attivalo in A-Z
                    alphaEnabled = true;
                    alphaDirAsc = true;
                    alphaBtn.classList.add('active');
                    document.getElementById('alphaDir').textContent = '↑';
                }
                updateActiveSortOrder();
            } else if (mode === 'tier') {
                // TIER e VALORE sono esclusivi
                const isTierActive = document.getElementById('sortTier').classList.contains('active');
                
                if (isTierActive) {
                    // Se era già attivo, disattiva
                    document.getElementById('sortTier').classList.remove('active');
                } else {
                    // Attiva TIER e disattiva VALORE
                    document.getElementById('sortTier').classList.add('active');
                    document.getElementById('sortValue').classList.remove('active');
                }
                updateActiveSortOrder();
            } else if (mode === 'value') {
                // TIER e VALORE sono esclusivi
                const isValueActive = document.getElementById('sortValue').classList.contains('active');
                
                if (isValueActive) {
                    // Se era già attivo, disattiva
                    document.getElementById('sortValue').classList.remove('active');
                } else {
                    // Attiva VALORE e disattiva TIER
                    document.getElementById('sortValue').classList.add('active');
                    document.getElementById('sortTier').classList.remove('active');
                }
                updateActiveSortOrder();
            }
        }

        /**
         * Calcola l'ordinamento effettivo in base ai toggle attivi.
         */
        function updateActiveSortOrder() {
            const tierActive = document.getElementById('sortTier').classList.contains('active');
            const valueActive = document.getElementById('sortValue').classList.contains('active');
            
            if (tierActive) {
                activeSortOrder = 'tier';
            } else if (valueActive) {
                activeSortOrder = 'value';
            } else {
                // Default: alfabetico
                activeSortOrder = alphaDirAsc ? 'name-asc' : 'name-desc';
            }
            
            filterAvailable();
        }

        // Inizializza lo stato al caricamento
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                document.getElementById('sortAlpha')?.classList.add('active');
                document.getElementById('alphaDir').textContent = '↑';
            }, 50);
        });

        function toggleRoleFilter(role, button) {
            if (activeRoles.has(role)) {
                activeRoles.delete(role);
                button.classList.remove('active');
            } else {
                activeRoles.add(role);
                button.classList.add('active');
            }
            filterAvailable();
        }

        /**
         * P7 — FILTRO SUGLI SPECIALISTI DEI PIAZZATI.
         *
         * Legge il campo setPieces del listone (array con voci tipo
         * RIGORISTA, PUNIZIONI, ANGOLI). I due bottoni sono in OR fra loro:
         * selezionandoli entrambi si vede chi tira rigori OPPURE punizioni,
         * che e' come si ragiona al tavolo ("chi ha bonus da fermo?").
         */
        function toggleSetPieceFilter(tipo, button) {
            if (activeSetPieces.has(tipo)) {
                activeSetPieces.delete(tipo);
                button.classList.remove('active');
            } else {
                activeSetPieces.add(tipo);
                button.classList.add('active');
            }
            filterAvailable();
        }
        window.toggleSetPieceFilter = toggleSetPieceFilter;

        /**
         * Vero se il giocatore e' uno specialista del tipo di piazzato chiesto.
         *
         * NON basta guardare setPieces: nel listone e' valorizzato solo su 39
         * giocatori su 531, e in due formati diversi ("RIGORISTA" oppure
         * "rigori 70.0%"). I campi penaltyProbability (59 giocatori) e
         * freeKickProbability (63) coprono di piu' e catturano casi che
         * setPieces si perde — Modric e Mandragora hanno probabilita' 70 sulle
         * punizioni e setPieces vuoto. Qui si usa l'unione dei due segnali.
         *
         * Attenzione al significato di penaltyProbability: come da mappa dati,
         * NON e' la percentuale di realizzazione, e' la quota di rigori della
         * squadra che quel giocatore calcerebbe (per squadra sommano ~100).
         */
        const SOGLIA_PIAZZATI = 20; // sotto questa quota non e' un vero designato

        function haPiazzati(p, richiesti) {
            const sp = Array.isArray(p.setPieces)
                ? p.setPieces.map(x => String(x).trim().toUpperCase())
                : (p.setPieces ? [String(p.setPieces).toUpperCase()] : []);

            for (const tipo of richiesti) {
                if (sp.some(v => v.indexOf(tipo) !== -1)) return true;
                if (tipo === 'RIGOR' && (p.penaltyProbability || 0) >= SOGLIA_PIAZZATI) return true;
                if (tipo === 'PUNIZION' && (p.freeKickProbability || 0) >= SOGLIA_PIAZZATI) return true;
            }
            return false;
        }

        /* ==========================================================
         * GIOCATORI INSERITI A MANO
         *
         * Il listone e' una lista chiusa: se un nome chiamato all'asta non
         * c'e', l'acquisto non si puo' registrare. Qui si puo' aggiungerlo.
         *
         * SCELTA DI FONDO: il giocatore non resta un fantasma presente solo
         * nelle rose, viene inserito in PLAYERS_DATA in memoria. Tutto il
         * codice — panoramica, schede, report, agente — fa decine di
         * PLAYERS_DATA.find(x => x.id === ...) dando per scontato che
         * trovino qualcosa; un giocatore assente dal listone farebbe
         * restituire undefined a tutte, con tier vuoti e campi mancanti
         * sparsi ovunque. Inserendolo, nessun presupposto si rompe.
         *
         * Il file su disco non viene toccato: i giocatori aggiunti vivono in
         * localStorage e vengono reinseriti a ogni caricamento.
         *
         * Sono marcati con inseritoManualmente: true, cosi' l'agente puo'
         * escluderli dalle statistiche in modo esplicito invece di doverlo
         * dedurre dai campi vuoti. Prezzi e fantamedie restano null e NON
         * zero: uno zero li farebbe risultare i peggiori della lega e
         * sposterebbe le medie di tutti.
         * ========================================================== */

        // Gli id del listone vanno da 1 a 531: partendo da 900000 la
        // collisione e' impossibile anche con listoni molto piu' grandi.
        const ID_MANUALE_BASE = 900000;

        function giocatoriManualiSalvati() {
            try { return JSON.parse(localStorage.getItem('giocatoriManuali') || '[]'); }
            catch (e) { return []; }
        }

        /** Reinserisce nel listone in memoria i giocatori aggiunti a mano. */
        function ripristinaGiocatoriManuali() {
            if (typeof PLAYERS_DATA === 'undefined') return;
            giocatoriManualiSalvati().forEach(g => {
                if (!PLAYERS_DATA.some(p => p.id === g.id)) PLAYERS_DATA.push(g);
            });
        }

        function aggiungiGiocatoreManuale() {
            const fase = calcolaFaseCorrente();
            if (!fase) {
                showMessage('L\'asta è conclusa: non serve aggiungere giocatori.', 'error');
                return;
            }

            // Il ruolo NON viene chiesto: l'asta procede per reparti in
            // sequenza, quindi in questa fase puo' essere chiamato solo un
            // giocatore di questo ruolo. Chiederlo aggiungerebbe soltanto
            // un modo di sbagliare.
            const nome = (prompt('Nome del ' + fase + ' da aggiungere:') || '').trim();
            if (!nome) return;

            const gia = PLAYERS_DATA.find(
                p => String(p.name).toUpperCase() === nome.toUpperCase());
            if (gia) {
                showMessage(gia.name + ' è già nel listone (' + gia.role + ', ' + gia.team + ').', 'error');
                return;
            }

            const squadra = (prompt('Squadra di Serie A di ' + nome + ':') || '').trim();
            if (!squadra) return;

            const salvati = giocatoriManualiSalvati();
            const nuovo = {
                id: ID_MANUALE_BASE + salvati.length + 1,
                name: nome.toUpperCase(),
                team: squadra,
                role: fase,
                inseritoManualmente: true,
                // Espliciti a null: assenza di dato, non valore zero.
                pma: null, pfc: null, maxPriceLega: null,
                tierConsensus: null, qualityScore: null, valueScore: null,
                fmStorica: null, mvStorica: null, pvMedia: null, seasonsUsed: 0,
                expectedTitolarita: null, setPieces: [],
                penaltyProbability: 0, freeKickProbability: 0,
                risks: ['inserito a mano durante l\'asta: nessun dato storico'],
                sources: []
            };

            salvati.push(nuovo);
            try { localStorage.setItem('giocatoriManuali', JSON.stringify(salvati)); }
            catch (e) { /* resta comunque in memoria per questa sessione */ }
            PLAYERS_DATA.push(nuovo);

            filterAvailable();
            setupAutocomplete();
            selectPlayer(nuovo.id, nuovo.name, nuovo.role, nuovo.team);
            showMessage(nuovo.name + ' aggiunto come ' + fase + ' (' + squadra +
                        '). Nessun dato storico: valutalo tu.', 'success');
        }
        window.aggiungiGiocatoreManuale = aggiungiGiocatoreManuale;

        // GIOCATORI DISPONIBILI
        function initializeTeamFilter() {
            const teamSelect = document.getElementById('filterTeam');
            const teams_set = new Set();
            PLAYERS_DATA.forEach(p => teams_set.add(p.team));
            const sortedTeams = Array.from(teams_set).sort();
            
            sortedTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                teamSelect.appendChild(option);
            });
        }

        // ==========================================
        // FUNZIONI DI FILTRO E RICERCA
        // ==========================================

        function filterAvailable() {
            const query = document.getElementById('availableSearch').value.toLowerCase();
            const clearBtn = document.getElementById('clearAvailableSearchBtn');
            const teamFilter = document.getElementById('filterTeam').value;
            
            // Mostra/nascondi il bottone x
            if (clearBtn) clearBtn.style.display = query.length > 0 ? 'block' : 'none';
            
            const soldIds = new Set(
                Object.values(teams).flatMap(t => t.players.map(p => p.id))
            );

            // Ottieni i ruoli in deficit
            const rolesInDeficit = getRolesInDeficit();

            let filtered = PLAYERS_DATA.filter(p => {
                if (soldIds.has(p.id)) return false;
                if (query && !p.name.toLowerCase().includes(query) && !p.team.toLowerCase().includes(query)) return false;
                // Filtra per ruoli in deficit (se nessuno è selezionato nei bottoni)
                if (activeRoles.size === 0 && !rolesInDeficit.has(p.role)) return false;
                // Filtra per bottoni selezionati (se ce ne sono)
                if (activeRoles.size > 0 && !activeRoles.has(p.role)) return false;
                if (teamFilter && p.team !== teamFilter) return false;
                // P7 — specialisti dei piazzati (rigoristi / punizioni)
                if (activeSetPieces.size > 0 && !haPiazzati(p, activeSetPieces)) return false;
                return true;
            });

            // Ordinamento
            const TIER_RANK = { 'A+': 0, 'A': 1, 'A-': 2, 'A--': 3, 'B': 4, 'C': 5 };
            const rank = p => {
                const t = p.tierConsensus || p.tier;
                const r = TIER_RANK[String(t).trim()];
                return r === undefined ? 99 : r;
            };
            if (activeSortOrder === 'name-asc') {
                filtered.sort((a, b) => a.name.localeCompare(b.name));
            } else if (activeSortOrder === 'name-desc') {
                filtered.sort((a, b) => b.name.localeCompare(a.name));
            } else if (activeSortOrder === 'tier') {
                // Tier migliore prima; a parità, il più caro (è il più forte del gruppo)
                filtered.sort((a, b) =>
                    rank(a) - rank(b) || (b.pma || 0) - (a.pma || 0));
            } else if (activeSortOrder === 'value') {
                /**
                 * ORDINAMENTO PER CONVENIENZA.
                 *
                 * Prima qui c'era 'b.valueScore - a.valueScore'. Ma
                 * valueScore e' il campo del listone gia' riconosciuto come
                 * inaffidabile: compresso (il 57% dei giocatori sta fra 20 e
                 * 40), saturo a 100 su 34 giocatori, e incoerente su casi
                 * simili (Buongiorno 18 contro Carlos Augusto 95,5 a parita'
                 * di prezzo e resa). E' esattamente il motivo per cui era
                 * stata scritta AI_AGENT.convenienza(), che pero' era rimasta
                 * usata solo dall'agente e non da questo bottone.
                 *
                 * Ora si ordina per punti attesi a stagione calcolati da
                 * convenienza(): fantamedia storica temperata sul numero di
                 * partite realmente giocate (una media su 5 gare non pesa
                 * come una su 120) e moltiplicata per la titolarita' attesa.
                 * A parita', il tier migliore.
                 */
                const cache = new Map();
                const resa = (p) => {
                    if (cache.has(p.id)) return cache.get(p.id);
                    let v = 0;
                    try {
                        const c = AI_AGENT.convenienza(p, filtered);
                        v = (c && c.puntiAttesi) || 0;
                    } catch (e) { v = 0; }
                    cache.set(p.id, v);
                    return v;
                };
                filtered.sort((a, b) => resa(b) - resa(a) || rank(a) - rank(b));
            }

            const list = document.getElementById('playersList');
            if (filtered.length === 0) {
                // Il bottone per inserire un giocatore a mano compare SOLO
                // qui: se la ricerca non trova nulla ed e' in corso una fase
                // d'asta. Non e' una scorciatoia sempre disponibile, e' la
                // via d'uscita per il caso raro del nome assente dal listone.
                const faseOra = calcolaFaseCorrente();
                list.innerHTML =
                    '<div style="padding: 18px; text-align: center; color: #64748b;">' +
                    'Nessun giocatore disponibile' +
                    (faseOra ? (
                        '<div style="margin-top:14px;font-size:12px;color:#94a3b8;line-height:1.5;">' +
                        'Se il nome chiamato non è nel listone, puoi aggiungerlo:' +
                        '</div>' +
                        '<button onclick="aggiungiGiocatoreManuale()" class="secondary" ' +
                        'style="margin-top:10px;background:#1e3a5f;border-color:#2c5282;">' +
                        '➕ Aggiungi ' + faseOra + ' non in lista</button>'
                    ) : '') +
                    '</div>';
                return;
            }

            list.innerHTML = filtered.map(p => {
                const t = p.tierConsensus || p.tier || '—';
                const cls = 'tier-' + String(t).replace(/\+/g, 'plus').replace(/-/g, 'minus');
                const pma = (p.pma !== undefined && p.pma !== null)
                    ? Math.round(p.pma) : '—';
                return `
                <div class="player-row" onclick="selectPlayerFromList(${p.id}, '${escapeAttr(p.name)}', '${p.role}', '${escapeAttr(p.team)}')" style="cursor: pointer;">
                    <div class="name">${p.name}</div>
                    <div class="squad">${p.team}</div>
                    <div class="role">${p.role}</div>
                    <div class="tier ${cls}">${t}</div>
                    <div class="pma">${pma}</div>
                </div>
            `;
            }).join('');
        }

        function selectPlayerFromList(id, name, role, team) {
            selectedPlayer = { id, name, role, team };
            document.getElementById('playerSearch').value = name;
            document.getElementById('autocompleteList').classList.remove('active');
            renderPlayerInfo(id, name, role, team);
        }

        // STORAGE
        function saveData() {
            const data = {};
            for (let i = 1; i <= 8; i++) {
                data[i] = teams[i];
            }
            localStorage.setItem('fantacalcio_v3_1', JSON.stringify(data));
        }

        function loadData() {
            const saved = localStorage.getItem('fantacalcio_v3_1');
            const configCompleted = localStorage.getItem('fantacalcio_config_completed');
            
            if (saved) {
                const data = JSON.parse(saved);
                for (let i = 1; i <= 8; i++) {
                    if (data[i]) {
                        teams[i] = data[i];
                    }
                }
                
                // Nascondi il setup se la configurazione è stata completata
                if (configCompleted === 'true') {
                    const setupElement = document.getElementById('setupNamesSection');
                    if (setupElement) {
                        setupElement.style.display = 'none';
                    }
                }
                
                document.getElementById('myTeamName').textContent = teams[1].name;
                updateDisplay();
                renderTeamsOverview();
                filterAvailable();
            }
        }

        // ==========================================
        // EVENT LISTENERS
        // ==========================================

        // Setupautocomplete al caricamento del DOM
        document.addEventListener('DOMContentLoaded', function() {
            initTeamNamesSetup();
            if (typeof PLAYERS_DATA !== 'undefined') {
                setupAutocomplete();
            }
        });

        // Event listener delegato per i bottoni squadre
        document.addEventListener('DOMContentLoaded', function() {
            // Delegato sul document per i bottoni dinamici
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('team-button') && e.target.parentElement.id === 'teamButtons') {
                    registerPurchase();
                }
            });
        });

        // ==========================================
        // TOGGLE OVERVIEW MODE (Compact/Expanded)
        // ==========================================

        /**
         * P2 — BUG CORRETTO: l'espansione non reggeva agli acquisti.
         *
         * Prima questa funzione applicava lo stile direttamente sui div
         * gia' presenti nella pagina. Funzionava finche' non si comprava
         * qualcuno: renderTeamsOverview() rifa' da zero l'innerHTML della
         * griglia, e i div nuovi nascevano senza quella classe, tornando al
         * max-height di 150px del CSS — cioe' alla barra di scorrimento,
         * anche con l'interruttore ancora su "Espanso".
         *
         * Ora lo stato vive solo in overviewMode e viene riapplicato dal
         * render, quindi sopravvive a ogni acquisto e a ogni re-render.
         */
        function toggleOverviewMode() {
            const label = document.getElementById('toggleLabel');
            const checkbox = document.getElementById('toggleViewCheckbox');

            overviewMode = (overviewMode === 'expanded') ? 'compact' : 'expanded';

            if (label) label.textContent = (overviewMode === 'expanded') ? 'Espanso' : 'Compatto';
            if (checkbox) checkbox.checked = (overviewMode === 'expanded');

            renderTeamsOverview();
        }

        // ==========================================
        // COPIA REPORT NEGLI APPUNTI
        // ==========================================
        
        function inviaReport() {
            if (typeof formatReportForClaude === 'undefined') {
                alert('Errore: agente IA non caricato.');
                return;
            }

            /**
             * Il campo "Chiedi un consiglio" prima veniva ignorato del
             * tutto: c'era una funzione askAI() completa collegata a
             * nient'altro, e in piu' chiamava l'API Anthropic direttamente
             * dal browser senza chiave — funziona solo dentro l'ambiente
             * artifact di Claude.ai, non su GitHub Pages dove vive questa
             * app. La correzione sensata e' che la domanda scritta qui
             * arrivi insieme al report quando lo incolli in una
             * conversazione vera con Claude, non che l'app finga di
             * rispondere da sola.
             */
            const domandaEl = document.getElementById('aiQuestion');
            const domanda = domandaEl ? domandaEl.value.trim() : '';

            let report = formatReportForClaude();
            if (domanda) {
                report = 'DOMANDA DI POLIBIO: ' + domanda + '\n\n' + report;
            }
            const timestamp = new Date().toISOString();
            
            // Salva in localStorage locale
            let reports = JSON.parse(localStorage.getItem('astaReports') || '[]');
            // L'id NON e' reports.length: la lista e' tagliata agli ultimi 20,
            // quindi dopo il ventesimo report la lunghezza resta ferma mentre
            // la numerazione deve proseguire. Si riparte dall'id piu' alto visto.
            const ultimoId = reports.reduce((m, r) => Math.max(m, r.id || 0), 0);
            const nuovoId = ultimoId + 1;
            reports.push({
                id: nuovoId,
                report,
                timestamp,
                receivedAt: new Date().toISOString()
            });
            /**
             * Tetto agli ultimi 20.
             * Senza limite i report si accumulano per sempre, comprese le
             * prove vecchie, e il pannello diventa illeggibile. In asta
             * servono gli ultimi, non l'archivio completo.
             */
            const MAX_REPORT = 20;
            if (reports.length > MAX_REPORT) {
                reports = reports.slice(-MAX_REPORT);
            }
            localStorage.setItem('astaReports', JSON.stringify(reports));

            // Aggiorna il pannello Report Live
            aggiornaBadgeReport();
            if (reportLiveAperto) renderReportLiveBody();

            // Feedback: una riga sola, sostituita ogni volta.
            //
            // Prima si usava innerHTML += , quindi le conferme si accumulavano
            // per tutta l'asta e il riquadro cresceva senza fine — e non veniva
            // svuotato da nessun reset, per cui dopo aver azzerato l'asta o
            // caricato un altro salvataggio restavano elencati report che non
            // esistevano piu'. Lo storico vero sta nel pannello Report Live
            // qui accanto: qui basta sapere che l'ultimo e' stato salvato.
            mostraEsitoReport(nuovoId);

            // Svuota il campo domanda
            document.getElementById('aiQuestion').value = '';
        }

        /**
         * Avvisa se HTML e JavaScript arrivano da versioni diverse.
         *
         * Succede quando la cache del browser serve la pagina vecchia e i
         * file nuovi (o il contrario): l'app sembra funzionare ma manca
         * meta' delle correzioni, ed e' il tipo di cosa che ci si accorge
         * in piena asta. Meglio un avviso esplicito con l'indicazione di
         * cosa fare.
         */
        function verificaVersioni() {
            const vHtml = (typeof window !== 'undefined' && window.HTML_VERSION) || null;
            if (!vHtml || vHtml === APP_VERSION) return;

            const avviso = document.createElement('div');
            avviso.style.cssText =
                'position:fixed;top:0;left:0;right:0;z-index:9999;' +
                'background:#7f1d1d;color:#fecaca;font-size:13px;font-weight:600;' +
                'padding:10px 14px;text-align:center;cursor:pointer;';
            avviso.innerHTML =
                '&#9888;&#65039; Versioni disallineate: pagina ' + vHtml +
                ', codice ' + APP_VERSION +
                ' — ricarica tenendo premuto il tasto di ricarica, oppure apri in una finestra privata. ' +
                '<span style="opacity:.8;font-weight:400;">(tocca per chiudere)</span>';
            avviso.onclick = function () { avviso.remove(); };
            document.body.appendChild(avviso);
            console.warn('Versione HTML ' + vHtml + ' != versione app ' + APP_VERSION);
        }

        // Carica dati e inizializza filtri al caricamento completo della pagina
        window.addEventListener('load', function() {
            verificaVersioni();
            ripristinaGiocatoriManuali();
            aggiornaBottoniRegolaTurno();
            if (typeof PLAYERS_DATA !== 'undefined') {
                initializeTeamFilter();
                filterAvailable();
            }
            aggiornaBadgeReport();

            /**
             * Titolo dinamico in base al modulo storico caricato.
             * Ogni lega ha il proprio file storico_<nome>.js con un campo
             * "lega": se e' quello di Fantalissandria, il titolo lo riflette;
             * senza nessun modulo storico (o con quello di un'altra lega,
             * es. Lega1996 in futuro) resta il nome generico.
             */
            // Titolo, costanti di rosa, budget e regola del turno vengono
            // tutti dalla configurazione della lega scelta (azzera=false:
            // qui si riallinea soltanto, senza toccare l'asta in corso).
            applicaLega(legaCorrente, false);
        });
