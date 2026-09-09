        // ==========================================
        // FANTACALCIO v3.9.9.23 - APP LOGIC
        // ==========================================

        // COSTANTI
        const BUDGET_TOTAL = 500;
        const PLAYERS_PER_SQUAD = 25;
        const ROLE_LIMITS = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };

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
                escapeAttr(prossimo.team.name) + '</strong>';
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
        const STRATEGIES = {
            conservativa: {
                name: 'CONSERVATIVA',
                POR: 0.07,
                DIF: 0.19,
                CEN: 0.32,
                ATT: 0.42
            },
            bilanciata: {
                name: 'BILANCIATA',
                POR: 0.09,
                DIF: 0.17,
                CEN: 0.27,
                ATT: 0.47
            },
            aggressiva: {
                name: 'AGGRESSIVA',
                POR: 0.06,
                DIF: 0.14,
                CEN: 0.24,
                ATT: 0.56
            },
            'centrocampo-first': {
                name: 'CENTROCAMPO-FIRST',
                POR: 0.06,
                DIF: 0.18,
                CEN: 0.38,
                ATT: 0.38
            }
        };

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
            const strategy = STRATEGIES[currentStrategy];
            
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
                const targetAmount = Math.round(BUDGET_TOTAL * targetPct);
                const spent = team.players.filter(p => p.role === role).reduce((sum, p) => sum + p.price, 0);
                
                targetBudgets[role] = targetAmount;
                
                if (missingRoles[role] > 0) {
                    // Se mancano giocatori in questo ruolo, calcola quanto puoi spendere
                    // risparmiando il target per gli altri ruoli mancanti
                    
                    let reservedForOthers = 0;
                    ['POR', 'DIF', 'CEN', 'ATT'].forEach(otherRole => {
                        if (otherRole !== role && missingRoles[otherRole] > 0) {
                            const otherTarget = Math.round(BUDGET_TOTAL * strategy[otherRole]);
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
                teams[i] = {
                    name: names ? names[i-1] : `Squadra ${i}`,
                    budget: BUDGET_TOTAL,
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
            document.getElementById('setupNamesSection').classList.add('hidden');
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
            document.getElementById('orderDisplay').classList.remove('active');
            
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
            const od = document.getElementById('orderDisplay');
            if (od) { od.style.display = 'block'; od.classList.add('active'); }
            const mine = document.getElementById('myTeamName');
            if (mine) mine.textContent = teams[1].name;

            initTeamButtons();
            renderTeamsOverview();
            updateDisplay();
            filterAvailable();
            renderOrderDisplay();
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
        function caricaManagerReali() {
            if (typeof STORICO_MANAGER === 'undefined' ||
                !STORICO_MANAGER.partecipanti202627) {
                showMessage('Nessun elenco manager disponibile in questo modulo storico.', 'error');
                return;
            }
            const nomi = STORICO_MANAGER.partecipanti202627;
            if (!confirm('Impostare le 8 squadre con i nomi reali (' + nomi.join(', ') +
                         ")? L'ordine di chiamata lo scegli tu nella schermata successiva.")) {
                return;
            }

            // 'IO' e' sempre la squadra di Polibio: va in prima posizione,
            // dove myTeamNum punta di default.
            const ordinati = nomi.slice();
            const idxIo = ordinati.findIndex((n) => n.toUpperCase() === 'IO');
            if (idxIo > 0) {
                const io = ordinati.splice(idxIo, 1)[0];
                ordinati.unshift(io);
            }

            // Stesso identico passo del flusso a nomi manuali: compila i
            // nomi, poi passa alla schermata di scelta ordine (initSetup),
            // senza toccare teamOrder ne' orderConfirmed.
            initializeTeams(ordinati);
            teamNamesConfirmed = true;
            document.getElementById('setupNamesSection').classList.add('hidden');
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('myTeamName').textContent = teams[1].name;
            initSetup();
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
            document.getElementById('orderDisplay').style.display = 'none';
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
            document.getElementById('orderDisplay').classList.remove('active');
            initSetup();
        }

        function renderOrderDisplay() {
            const display = document.getElementById('orderDisplay');
            display.classList.add('active');
            // Le classi CSS reali sono '.order-buttons' (contenitore flex)
            // e '.order-btn' (il singolo bottone): 'order-button' non
            // corrispondeva a nessuna regola CSS, quindi la lista appariva
            // senza stile, impilata verticalmente senza bottoni.
            display.innerHTML = `<div class="order-buttons">` +
                teamOrder.map((squad, idx) => `
                    <div class="order-btn" id="orderBtn${idx}" onclick="highlightOrder(${idx})">
                        ${idx + 1}. ${teams[squad].name}
                    </div>
                `).join('') + `</div>`;
        }

        function highlightOrder(index) {
            // Evidenzia chi sta chiamando adesso: un click sposta il segno
            // di spunta, cosi' si tiene traccia del turno durante l'asta.
            document.querySelectorAll('#orderDisplay .order-btn').forEach((el) => {
                el.classList.remove('active');
            });
            const btn = document.getElementById('orderBtn' + index);
            if (btn) btn.classList.add('active');
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

            showMessage('Asta scaricata! 📥', 'success');
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
                    
                    // Salva in localStorage
                    saveData();
                    
                    // Nascondi il setup dal DOM
                    const setupElement = document.getElementById('setupNamesSection');
                    if (setupElement) {
                        setupElement.style.display = 'none';
                    }
                    
                    // Nascondi il setup ordine se già completato
                    if (teamOrder && teamOrder.length > 0) {
                        document.getElementById('setupSection').style.display = 'none';
                        document.getElementById('orderDisplay').style.display = 'block';
                    }
                    
                    // Reinizializza i bottoni squadre
                    initTeamButtons();
                    
                    // Aggiorna il nome della mia squadra
                    document.getElementById('myTeamName').textContent = teams[1].name;
                    
                    // Aggiorna la visualizzazione
                    updateDisplay();
                    renderTeamsOverview();
                    filterAvailable();
                    
                    showMessage('Asta caricata con successo! 📤', 'success');
                } catch (error) {
                    showMessage('Errore nel caricamento del file: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        }

        function selectTeam(teamNum, btn) {
            document.querySelectorAll('.team-button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
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
            if (p.valueScore != null) chips.push(chip('Convenienza', Math.round(p.valueScore),
                p.valueScore >= 80 ? '#4ade80' : '#e2e8f0'));
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

            const playerName = selectedPlayer.name; // salva prima di clearForm
            saveData();

            // Avanza il turno di un passo: prossimoChiamante() correggera'
            // da solo la posizione se questo passo non e' piu' valido
            // (es. la squadra dopo ha gia' completato la fase).
            turnoIndex = (turnoIndex + 1) % 8;

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

        // ==========================================
        // FUNZIONI DI VISUALIZZAZIONE
        // ==========================================

        function updateDisplay() {
            const myTeam = teams[1];

            document.getElementById('mySpent').textContent = myTeam.spent;
            document.getElementById('mySpentPct').textContent = 
                `${((myTeam.spent / BUDGET_TOTAL) * 100).toFixed(1)}%`;
            
            document.getElementById('playerCount').textContent = `${myTeam.players.length}/${PLAYERS_PER_SQUAD}`;
            document.getElementById('budgetLeft').textContent = myTeam.budget;
            document.getElementById('budgetLeftPct').textContent = 
                `${((myTeam.budget / BUDGET_TOTAL) * 100).toFixed(1)}%`;

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
                const strategy = STRATEGIES[currentStrategy];
                dashboardHtml += `<div style="font-size: 10px; color: #60a5fa; margin-bottom: 8px; font-weight: 600;">STRATEGIA: ${strategy.name}</div>`;
                
                // Per ogni ruolo
                ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                    const current = myTeam.players.filter(p => p.role === role).length;
                    const limit = ROLE_LIMITS[role];
                    const spent = myTeam.players.filter(p => p.role === role).reduce((sum, p) => sum + p.price, 0);
                    const targetAmount = budgetData.targetBudgets[role];
                    const targetPct = (strategy[role] * 100).toFixed(0);
                    const spentPct = ((spent / BUDGET_TOTAL) * 100).toFixed(1);
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
                dashboardPanel.innerHTML = dashboardHtml;
            }

            const list = document.getElementById('mySquadList');
            if (myTeam.players.length === 0) {
                list.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Nessun giocatore ancora</div>';
            } else {
                list.innerHTML = myTeam.players.map(p => `
                    <div class="squad-player">
                        <span class="name">${p.name}</span>
                        <span class="role">${p.role}</span>
                        <span class="price">${p.price}M</span>
                        <button class="remove-btn team-button" onclick="removeFromMySquad(${p.id})">✕</button>
                    </div>
                `).join('');
            }

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
        }

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
                const spentPct = ((team.spent / BUDGET_TOTAL) * 100).toFixed(1);
                const budgetPct = ((team.budget / BUDGET_TOTAL) * 100).toFixed(1);

                const playersByRole = { POR: [], DIF: [], CEN: [], ATT: [] };
                team.players.forEach(p => {
                    playersByRole[p.role].push(p);
                });

                let playersHtml = '';
                ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
                    if (playersByRole[role].length > 0) {
                        // Calcola totale speso per questo ruolo
                        const roleTotal = playersByRole[role].reduce((sum, p) => sum + p.price, 0);
                        const rolePct = ((roleTotal / BUDGET_TOTAL) * 100).toFixed(1);
                        
                        playersHtml += `<div class="team-role">${role} (${roleTotal}M, ${rolePct}%)</div>`;
                        playersByRole[role].forEach(p => {
                            const playerPct = ((p.price / BUDGET_TOTAL) * 100).toFixed(1);
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
                        corpo += `<textarea class="note-text" rows="2" maxlength="200"
                            placeholder="Cosa noti al tavolo..."
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

                // STRATEGIA RILEVATA (non sulla propria squadra): stessa
                // deduzione gia' usata nel report, resa visibile qui invece
                // di doverla andare a cercare nel testo.
                let strategyHtml = '';
                if (!isMyTeam && typeof AI_AGENT !== 'undefined' && AI_AGENT.inferOpponentStrategy) {
                    const inf = AI_AGENT.inferOpponentStrategy(team, i);
                    const debole = ['NESSUN ACQUISTO', 'TROPPO PRESTO PER DIRLO', 'INDIZI DEBOLI']
                        .includes(inf.strategy);
                    strategyHtml = `<div class="team-strategy${debole ? ' weak' : ''}"
                            title="${escapeHtml(inf.dettaglio || inf.nota || '')}">
                        ${debole ? inf.strategy : `${inf.strategy} <span class="ts-conf">${inf.confidence}%</span>`}
                    </div>`;
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
                        <div class="team-players">
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

        function salvaNotaTesto(teamNum, testo) {
            if (typeof nota !== 'function') return;
            const corrente = (note(teamNum) || {}).pattern || [];
            nota(teamNum, corrente, (testo || '').trim() || null);
            renderTeamsOverview();
        }

        window.toggleNotePanel = toggleNotePanel;
        window.toggleNotaPattern = toggleNotaPattern;
        window.salvaNotaTesto = salvaNotaTesto;

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
                    <button class="report-head" onclick="toggleReportCard(${r.id})">
                        <span><b>#${r.id}</b> <span style="color:#64748b;">${ora}</span></span>
                        <span id="repChev${r.id}">${aperto ? '▾' : '▸'}</span>
                    </button>
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

        window.toggleReportLive = toggleReportLive;
        window.toggleReportCard = toggleReportCard;
        /** Svuota i report senza toccare l'asta in corso. */
        function svuotaReport() {
            const n = getReports().length;
            if (!n) { showMessage('Non ci sono report da cancellare.', 'success'); return; }
            if (!confirm('Cancellare i ' + n + ' report salvati? L\'asta non viene toccata.')) return;
            localStorage.removeItem('astaReports');
            const b = document.getElementById('reportLiveBody');
            if (b) b.innerHTML = '';
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
                    teams[i].budget = BUDGET_TOTAL;
                }
                
                // Resetta la conversazione con l'agente IA
                conversationHistory = [];

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
            document.querySelectorAll('.team-button').forEach(b => b.classList.remove('selected'));
            document.getElementById('messageDiv').innerHTML = '';
        }

        function clearMySquad() {
            if (confirm('Sei sicuro?')) {
                teams[1].players = [];
                teams[1].spent = 0;
                teams[1].budget = BUDGET_TOTAL;
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
        async function askAI() {
            const question = document.getElementById('aiQuestion').value.trim();
            if (!question) return;

            const chatHistory = document.getElementById('chatHistory');
            const errorDiv = document.getElementById('aiError');
            errorDiv.style.display = 'none';

            conversationHistory.push({ role: 'user', content: question });
            chatHistory.innerHTML += `
                <div class="message user">
                    <div class="content">${escapeHtml(question)}</div>
                </div>
            `;
            document.getElementById('aiQuestion').value = '';
            chatHistory.scrollTop = chatHistory.scrollHeight;

            chatHistory.innerHTML += `<div class="message assistant"><div class="content loading">🤔 Sto pensando...</div></div>`;
            chatHistory.scrollTop = chatHistory.scrollHeight;

            try {
                let teamsContext = '';
                for (let i = 1; i <= 8; i++) {
                    const t = teams[i];
                    teamsContext += `${t.name}: ${t.spent}M spesi (${((t.spent / BUDGET_TOTAL) * 100).toFixed(1)}%), ${t.budget}M rimasti, ${t.players.length}/25 giocatori\n`;
                }

                const systemPrompt = `Sei un esperto di fantacalcio italiano. Analizza l'asta in tempo reale e dai consigli rapidi.

STATO ASTA:
${teamsContext}

La Squadra 1 è la squadra dell'utente. Dai consigli utili per vincere l'asta. Sempre includi percentuali nelle tue risposte. Rispondi in modo conciso e pratico.`;

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 400,
                        system: systemPrompt,
                        messages: conversationHistory
                    })
                });

                if (!response.ok) {
                    throw new Error(`Errore API: ${response.status}`);
                }

                const data = await response.json();
                const assistantMessage = data.content[0].text;

                const messages = chatHistory.querySelectorAll('.message');
                messages[messages.length - 1].remove();

                conversationHistory.push({ role: 'assistant', content: assistantMessage });
                chatHistory.innerHTML += `
                    <div class="message assistant">
                        <div class="content">${escapeHtml(assistantMessage)}</div>
                    </div>
                `;
                chatHistory.scrollTop = chatHistory.scrollHeight;

            } catch (error) {
                console.error('Errore:', error);
                const messages = chatHistory.querySelectorAll('.message');
                messages[messages.length - 1].remove();
                
                errorDiv.style.display = 'block';
                errorDiv.innerHTML = `⚠️ ${error.message}`;
            }
        }

        function escapeHtml(text) {
            const map = {
                '&': '&amp;', '<': '&lt;', '>': '&gt;',
                '"': '&quot;', "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

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
                // Massima convenienza prima; a parità, il tier migliore
                filtered.sort((a, b) =>
                    (b.valueScore || 0) - (a.valueScore || 0) || rank(a) - rank(b));
            }

            const list = document.getElementById('playersList');
            if (filtered.length === 0) {
                list.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Nessun giocatore disponibile</div>';
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
        let overviewMode = 'expanded'; // default expanded

        function toggleOverviewMode() {
            const label = document.getElementById('toggleLabel');
            const checkbox = document.getElementById('toggleViewCheckbox');
            const players = document.querySelectorAll('.team-players');
            
            if (overviewMode === 'expanded') {
                overviewMode = 'compact';
                label.textContent = 'Compatto';
                checkbox.checked = false;
                players.forEach(p => {
                    p.classList.remove('overview-expanded');
                    p.style.maxHeight = '150px';
                    p.style.overflowY = 'auto';
                });
            } else {
                overviewMode = 'expanded';
                label.textContent = 'Espanso';
                checkbox.checked = true;
                players.forEach(p => {
                    p.classList.add('overview-expanded');
                    p.style.maxHeight = 'none';
                    p.style.overflowY = 'visible';
                });
            }
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
            reports.push({
                id: reports.length + 1,
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

            // Feedback all'utente
            const c = document.getElementById('chatHistory');
            c.innerHTML += `<div class="message assistant"><div class="content">
                ✅ <strong>Report #${reports.length} salvato.</strong>
                Lo trovi nel pannello <em>Report Live</em> a destra, sopra,
                pronto da leggere.
            </div></div>`;
            c.scrollTop = c.scrollHeight;

            // Svuota il campo domanda
            document.getElementById('aiQuestion').value = '';
        }

        // Carica dati e inizializza filtri al caricamento completo della pagina
        window.addEventListener('load', function() {
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
            const titolo = document.getElementById('appTitle');
            if (titolo && typeof STORICO_MANAGER !== 'undefined' &&
                STORICO_MANAGER.lega === 'Fantalissandria') {
                titolo.textContent = 'Asta Fantalisandria';
                const btn = document.getElementById('btnManagerReali');
                if (btn && STORICO_MANAGER.partecipanti202627) btn.style.display = 'block';
            }
        });
