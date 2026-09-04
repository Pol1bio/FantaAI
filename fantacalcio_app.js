        // ==========================================
        // FANTACALCIO v3.9.5 - APP LOGIC
        // ==========================================

        // COSTANTI
        const BUDGET_TOTAL = 500;
        const PLAYERS_PER_SQUAD = 25;
        const ROLE_LIMITS = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };

        // VARIABILI GLOBALI - Stato dell'applicazione
        let teams = {};
        let selectedPlayer = null;
        let selectedTeam = null;
        let orderConfirmed = false;
        let teamOrder = [];
        let conversationHistory = [];
        let teamNamesConfirmed = false;

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
            teamNamesConfirmed = false;
            orderConfirmed = false;
            teamOrder = [];
            conversationHistory = [];
            initializeTeams();
            
            document.getElementById('setupNamesSection').style.display = 'block';
            document.getElementById('setupSection').style.display = 'none';
            document.getElementById('orderDisplay').classList.remove('active');
            
            initTeamNamesSetup();
            updateDisplay();
            renderTeamsOverview();
            clearForm();
            
            showMessage('Tutto azzerato! ✨', 'success');
        }

        // SETUP ORDINE
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
            document.getElementById('setupSection').style.display = 'none';
            document.getElementById('orderDisplay').style.display = 'none';
            initTeamButtons();
            renderTeamsOverview();
            loadData();
        }

        function resetSetup() {
            teamOrder = [];
            orderConfirmed = false;
            document.getElementById('setupSection').style.display = 'block';
            document.getElementById('orderDisplay').classList.remove('active');
            initSetup();
        }

        function renderOrderDisplay() {
            const display = document.getElementById('orderDisplay');
            display.classList.add('active');
            display.innerHTML = teamOrder.map((squad, idx) => `
                <div class="order-button" id="orderBtn${idx}" onclick="highlightOrder(${idx})">
                    ${teams[squad].name}
                </div>
            `).join('');
        }

        function highlightOrder(index) {
            // Qui verrà usato per evidenziare chi deve aprire
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
                    <div class="autocomplete-item" onclick="selectPlayer(${p.id}, '${p.name}', '${p.role}', '${p.team}')">
                        <div class="name">${p.name}</div>
                        <div class="info">${p.team} • ${p.role}</div>
                    </div>
                `).join('');
                list.classList.add('active');
            });
        }

        function selectPlayer(id, name, role, team) {
            selectedPlayer = { id, name, role, team };
            document.getElementById('playerSearch').value = name;
            document.getElementById('autocompleteList').classList.remove('active');
            
            // Mostra info giocatore
            document.getElementById('playerInfo').style.display = 'block';
            document.getElementById('infoSquad').textContent = squad;
            document.getElementById('infoRole').textContent = role;
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

            saveData();
            updateDisplay();
            renderTeamsOverview();
            filterAvailable();
            setupAutocomplete(); // Aggiorna il filtro autocomplete
            clearForm();
            showMessage(`${selectedPlayer.name} aggiunto a ${team.name}`, 'success');
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
        }

        function renderTeamsOverview() {
            const grid = document.getElementById('teamsGrid');
            let html = '';

            // Se l'ordine è stato confermato, usa quello; altrimenti usa ordine standard
            const displayOrder = orderConfirmed ? teamOrder : [1, 2, 3, 4, 5, 6, 7, 8];

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
                            playersHtml += `<div class="team-player-item">${p.name} <span class="team-abbr">(${teamAbbr})</span> <span class="team-player-price">(${p.price}M, ${playerPct}%)</span></div>`;
                        });
                    }
                });

                html += `
                    <div class="team-card ${isMyTeam ? 'my-team' : ''}">
                        <h4>${team.name}</h4>
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
                    </div>
                `;
            }

            grid.innerHTML = html;
        }

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
                
                // Salva i dati
                saveData();
                
                // Aggiorna la visualizzazione
                updateDisplay();
                renderTeamsOverview();
                filterAvailable();
                setupAutocomplete();
                
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

        function clearAvailableSearch() {
            document.getElementById('availableSearch').value = '';
            document.getElementById('clearAvailableSearchBtn').style.display = 'none';
            filterAvailable();
        }

        // VARIABILI FILTRI
        let activeRoles = new Set();
        let activeSortOrder = 'name-asc';

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

        function toggleSortOrder(order, button) {
            // Rimuovi active da tutti i bottoncini sort
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            // Aggiungi active al bottone cliccato
            button.classList.add('active');
            activeSortOrder = order;
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
            if (activeSortOrder === 'name-asc') {
                filtered.sort((a, b) => a.name.localeCompare(b.name));
            } else if (activeSortOrder === 'name-desc') {
                filtered.sort((a, b) => b.name.localeCompare(a.name));
            }

            const list = document.getElementById('playersList');
            if (filtered.length === 0) {
                list.innerHTML = '<div style="padding: 20px; text-align: center; color: #64748b;">Nessun giocatore disponibile</div>';
                return;
            }

            list.innerHTML = filtered.map(p => `
                <div class="player-row" onclick="selectPlayerFromList(${p.id}, '${p.name}', '${p.role}', '${p.team}')" style="cursor: pointer;">
                    <div class="name">${p.name}</div>
                    <div class="squad">${p.team}</div>
                    <div class="role">${p.role}</div>
                    <div class="status">Disponibile</div>
                </div>
            `).join('');
        }

        function selectPlayerFromList(id, name, role, team) {
            selectedPlayer = { id, name, role, team };
            document.getElementById('playerSearch').value = name;
            document.getElementById('playerInfo').style.display = 'block';
            document.getElementById('infoSquad').textContent = team;
            document.getElementById('infoRole').textContent = role;
            document.getElementById('autocompleteList').classList.remove('active');
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
            
            const report = formatReportForClaude();
            const timestamp = new Date().toISOString();
            
            // Salva in localStorage locale
            let reports = JSON.parse(localStorage.getItem('astaReports') || '[]');
            reports.push({
                id: reports.length + 1,
                report,
                timestamp,
                receivedAt: new Date().toISOString()
            });
            localStorage.setItem('astaReports', JSON.stringify(reports));
            
            // Invia a Vercel (per tracking, anche se Vercel non persiste)
            fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report, timestamp })
            }).catch(err => console.log('Vercel call:', err));
            
            // Feedback all'utente
            const c = document.getElementById('chatHistory');
            c.innerHTML += `<div class="message assistant"><div class="content">
                ✅ <strong>Report inviato!</strong> (#${reports.length}) — Apri la <a href="reports.html" target="_blank">dashboard</a> per vederlo in tempo reale.
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
        });
