// ======================================
// FANTACALCIO AI AGENT v1.0
// ======================================
// Layer 1: Monitoraggio real-time
// Layer 2: Analisi tattica
// Layer 3: Comunicazione strategica

class FantacalcioAIAgent {
    constructor() {
        this.budgetTotal = 500;
        this.strategies = {
            conservativa: { name: 'CONSERVATIVA', POR: 0.07, DIF: 0.19, CEN: 0.32, ATT: 0.42 },
            bilanciata: { name: 'BILANCIATA', POR: 0.09, DIF: 0.17, CEN: 0.27, ATT: 0.47 },
            aggressiva: { name: 'AGGRESSIVA', POR: 0.06, DIF: 0.14, CEN: 0.24, ATT: 0.56 },
            'centrocampo-first': { name: 'CENTROCAMPO-FIRST', POR: 0.06, DIF: 0.18, CEN: 0.38, ATT: 0.38 }
        };
        this.roleLimits = { POR: 3, DIF: 8, CEN: 8, ATT: 6 };
        this.playersPerSquad = 25;
    }

    // ===== LAYER 1: MONITORAGGIO =====

    /**
     * Analizza lo stato attuale della squadra vs target strategico
     */
    analyzeTeam(team, currentStrategy) {
        const strategy = this.strategies[currentStrategy];
        const analysis = {};
        
        for (const role of ['POR', 'DIF', 'CEN', 'ATT']) {
            const spent = team.players
                .filter(p => p.role === role)
                .reduce((sum, p) => sum + p.price, 0);
            
            const actual = (spent / this.budgetTotal) * 100;
            const target = (strategy[role] * 100);
            const deviation = actual - target;
            
            analysis[role] = {
                spent: spent,
                actual: parseFloat(actual.toFixed(1)),
                target: parseFloat(target.toFixed(1)),
                deviation: parseFloat(deviation.toFixed(1)),
                status: Math.abs(deviation) < 2 ? '✓' : 
                        deviation < 0 ? '⚠️ sottodimensionato' : '⚠️ sovraspeso',
                severity: Math.abs(deviation) < 2 ? 'ok' :
                          Math.abs(deviation) < 5 ? 'warning' : 'critical'
            };
        }
        
        return analysis;
    }

    /**
     * Rileva anomalie e problemi nella squadra
     */
    detectAnomalies(team, currentStrategy) {
        const alerts = [];
        const teamAnalysis = this.analyzeTeam(team, currentStrategy);
        
        // Budget critico
        if (team.budget < 50) {
            alerts.push({
                severity: 'critical',
                type: 'budget_critical',
                icon: '🔴',
                message: `Budget sotto 50M: prossimi acquisti saranno MOLTO ristretti (${team.budget}M rimasti)`
            });
        }
        
        // Budget basso
        if (team.budget < 100) {
            alerts.push({
                severity: 'warning',
                type: 'budget_low',
                icon: '🟡',
                message: `Budget ridotto: ${team.budget}M rimasti. Pianifica gli ultimi colpi.`
            });
        }
        
        // Ruoli scoperti
        for (const role of ['POR', 'DIF', 'CEN', 'ATT']) {
            const count = team.players.filter(p => p.role === role).length;
            const limit = this.roleLimits[role];
            
            if (count < limit) {
                const missing = limit - count;
                alerts.push({
                    severity: 'high',
                    type: 'role_missing',
                    role: role,
                    icon: '⚠️',
                    message: `Mancano ${missing} ${role}. Completa il ruolo entro i prossimi turni.`
                });
            }
        }
        
        // Deviazioni significative dai target
        for (const role in teamAnalysis) {
            if (teamAnalysis[role].severity === 'critical') {
                alerts.push({
                    severity: 'high',
                    type: 'budget_deviation',
                    role: role,
                    icon: '📊',
                    message: `${role}: ${teamAnalysis[role].actual}% vs ${teamAnalysis[role].target}% target. Deviazione: ${teamAnalysis[role].deviation > 0 ? '+' : ''}${teamAnalysis[role].deviation}%`
                });
            }
        }
        
        // Squadra incompleta
        if (team.players.length < 25) {
            const missing = 25 - team.players.length;
            alerts.push({
                severity: 'info',
                type: 'squad_incomplete',
                icon: 'ℹ️',
                message: `Squadra ancora incompleta: ${team.players.length}/25 giocatori (${missing} mancanti)`
            });
        }
        
        return alerts;
    }

    /**
     * Calcola smart budget per ruolo (quanto riservare agli altri ruoli)
     */
    calculateSmartBudget(team, currentStrategy) {
        const strategy = this.strategies[currentStrategy];
        const budgetAllocations = {};
        const targetBudgets = {};
        
        for (const role of ['POR', 'DIF', 'CEN', 'ATT']) {
            const targetAmount = Math.round(this.budgetTotal * strategy[role]);
            const spent = team.players
                .filter(p => p.role === role)
                .reduce((sum, p) => sum + p.price, 0);
            
            targetBudgets[role] = targetAmount;
            budgetAllocations[role] = Math.max(1, targetAmount - spent);
        }
        
        return { budgetAllocations, targetBudgets };
    }

    // ===== LAYER 2: ANALISI TATTICA =====

    /**
     * Deduce la strategia di un avversario dai suoi acquisti
     */
    inferOpponentStrategy(opponentTeam) {
        if (opponentTeam.players.length === 0) {
            return { strategy: 'SCONOSCIUTA', confidence: '0%', roleDistribution: {} };
        }
        
        const roleDistribution = {};
        ['POR', 'DIF', 'CEN', 'ATT'].forEach(role => {
            const count = opponentTeam.players.filter(p => p.role === role).length;
            roleDistribution[role] = (count / opponentTeam.players.length) * 100;
        });
        
        // Confronta con le strategie note
        let bestMatch = null;
        let minDistance = Infinity;
        
        for (const [key, strat] of Object.entries(this.strategies)) {
            let distance = 0;
            for (const role of ['POR', 'DIF', 'CEN', 'ATT']) {
                const stratPct = strat[role] * 100;
                distance += Math.abs(roleDistribution[role] - stratPct);
            }
            
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = { key, ...strat };
            }
        }
        
        const confidence = Math.max(0, 100 - minDistance).toFixed(0);
        
        return {
            strategy: bestMatch.name,
            confidence: `${confidence}%`,
            roleDistribution: roleDistribution,
            bestMatchKey: bestMatch.key
        };
    }

    /**
     * Identifica opportunità: giocatori A-tier ancora liberi
     */
    identifyOpportunities(allPlayers, myTeam, preferredRoles = null) {
        const soldIds = new Set(myTeam.players.map(p => p.id));
        const opportunities = [];
        
        for (const player of allPlayers) {
            // Skip già comprati
            if (soldIds.has(player.id)) continue;
            
            // Se preferredRoles è specificato, filtra
            if (preferredRoles && !preferredRoles.has(player.role)) continue;
            
            // Considera solo A-tier e sopra
            if (player.tier && (player.tier === 'A+' || player.tier === 'A')) {
                opportunities.push({
                    name: player.name,
                    role: player.role,
                    team: player.team,
                    tier: player.tier,
                    pma: player.pma || 0,
                    expectedFantamedia: player.expectedFantamedia || 0,
                    titolarita: player.titolarita || '0%',
                    urgency: player.tier === 'A+' ? 'ALTA' : 'MEDIA'
                });
            }
        }
        
        // Ordina per urgenza e prezzo medio
        opportunities.sort((a, b) => {
            if (a.urgency !== b.urgency) {
                return a.urgency === 'ALTA' ? -1 : 1;
            }
            return a.pma - b.pma;
        });
        
        return opportunities;
    }

    // ===== LAYER 3: COMUNICAZIONE =====

    /**
     * Genera il suggerimento principale strategico
     */
    generateMainAdvice(team, currentStrategy, alerts, opportunities) {
        const teamAnalysis = this.analyzeTeam(team, currentStrategy);
        const worstRole = this.findWorstRole(teamAnalysis);
        
        // Logica di priorità
        
        // 1. Budget critico
        if (team.budget < 50) {
            return {
                type: 'critical',
                icon: '🔴',
                title: 'SITUAZIONE CRITICA',
                advice: `Budget quasi esaurito (${team.budget}M). Scegli con ESTREMA cautela i prossimi acquisti. Priorità assoluta: completare i ruoli mancanti.`
            };
        }
        
        // 2. Ruoli scoperti
        const missingRoles = ['POR', 'DIF', 'CEN', 'ATT'].filter(role => {
            const count = team.players.filter(p => p.role === role).length;
            return count < this.roleLimits[role];
        });
        
        if (missingRoles.length > 0) {
            return {
                type: 'high_priority',
                icon: '⚠️',
                title: 'COMPLETA I RUOLI',
                advice: `Priorità: completare ${missingRoles.join(', ')}. Nei prossimi turni, concentrati su questi ruoli prima di investire altrove.`
            };
        }
        
        // 3. Deviazioni significative
        if (worstRole.deviation < -5) {
            return {
                type: 'rebalance',
                icon: '📊',
                title: 'RIEQUILIBRA IL BUDGET',
                advice: `${worstRole.role} sottodimensionato (${worstRole.actual}% vs ${worstRole.target}% target). Punta su ${worstRole.role} di qualità B+ a prezzo contenuto per recuperare il gap.`
            };
        }
        
        if (worstRole.deviation > 5) {
            return {
                type: 'rebalance',
                icon: '📊',
                title: 'ATTENZIONE: BUDGET SOVRASPESO',
                advice: `${worstRole.role} sovraspeso (${worstRole.actual}% vs ${worstRole.target}% target). Usa il prossimo turno per investire su altri ruoli e ribilanciare.`
            };
        }
        
        // 4. Strategia ottimale
        if (opportunities.length > 0) {
            const topOpp = opportunities[0];
            return {
                type: 'opportunity',
                icon: '💡',
                title: 'OPPORTUNITÀ A-TIER',
                advice: `${topOpp.name} (${topOpp.role}, ${topOpp.tier}) è ancora libero! Expected Fantamedia: ${topOpp.expectedFantamedia}, Titolarità: ${topOpp.titolarita}. Se il prezzo rimane basso, valuta di aggiudicarlo.`
            };
        }
        
        // 5. Default: tutto ok
        return {
            type: 'stable',
            icon: '✅',
            title: 'SITUAZIONE STABILE',
            advice: `Budget e ruoli in target. Mantieni disciplina: acquista solo A-tier, rispetta i target %, e colpi tattici intelligenti. Sei sulla buona strada!`
        };
    }

    /**
     * Genera insight rapidi sull'asta
     */
    generateInsights(allTeams, myTeamNum = 1) {
        const insights = [];
        
        for (const [teamNum, team] of Object.entries(allTeams)) {
            if (parseInt(teamNum) === myTeamNum) continue;
            
            const strategy = this.inferOpponentStrategy(team);
            const spent = team.spent || 0;
            const budget = team.budget || 0;
            
            insights.push({
                team: team.name,
                strategy: strategy.strategy,
                confidence: strategy.confidence,
                spent: `${spent}M`,
                budget: `${budget}M`,
                players: team.players.length
            });
        }
        
        return insights;
    }

    /**
     * Valuta se cambiare strategia
     */
    shouldChangeStrategy(team, currentStrategy, opponentStrategies) {
        const teamAnalysis = this.analyzeTeam(team, currentStrategy);
        const myAllocations = this.calculateSmartBudget(team, currentStrategy).budgetAllocations;
        
        // Logica semplice: se tutti gli avversari usano la stessa strategia,
        // potrebbe essere vantaggioso diversificarsi
        
        let opponentCount = {};
        for (const opp of opponentStrategies) {
            opponentCount[opp.bestMatchKey] = (opponentCount[opp.bestMatchKey] || 0) + 1;
        }
        
        const mostCommon = Object.entries(opponentCount)
            .sort((a, b) => b[1] - a[1])[0];
        
        if (mostCommon && mostCommon[0] === currentStrategy && mostCommon[1] >= 5) {
            return {
                recommend: true,
                reason: `${mostCommon[1]} avversari usano ${currentStrategy}. Considera di diversificare.`,
                suggestedStrategy: 'aggressiva' // semplificato
            };
        }
        
        return { recommend: false, reason: '', suggestedStrategy: null };
    }

    // ===== UTILITY =====

    findWorstRole(analysis) {
        let worst = { role: 'POR', deviation: 0 };
        for (const role in analysis) {
            if (Math.abs(analysis[role].deviation) > Math.abs(worst.deviation)) {
                worst = { role, ...analysis[role] };
            }
        }
        return worst;
    }

    /**
     * Formatta un report completo per l'utente
     */
    generateFullReport(team, currentStrategy, allTeams, allPlayers, myTeamNum = 1) {
        const teamAnalysis = this.analyzeTeam(team, currentStrategy);
        const alerts = this.detectAnomalies(team, currentStrategy);
        const opportunities = this.identifyOpportunities(allPlayers, team);
        const mainAdvice = this.generateMainAdvice(team, currentStrategy, alerts, opportunities);
        
        // Deduce strategia di alcuni avversari
        const opponentStrategies = [];
        for (const [num, opp] of Object.entries(allTeams)) {
            if (parseInt(num) !== myTeamNum) {
                opponentStrategies.push(this.inferOpponentStrategy(opp));
            }
        }
        
        const shouldChange = this.shouldChangeStrategy(team, currentStrategy, opponentStrategies);
        
        return {
            timestamp: new Date().toISOString(),
            teamAnalysis: teamAnalysis,
            alerts: alerts,
            mainAdvice: mainAdvice,
            opportunities: opportunities.slice(0, 3), // Top 3
            opponentInsights: opponentStrategies.slice(0, 3),
            changeStrategyRecommendation: shouldChange
        };
    }
}

// ===== ISTANZA GLOBALE =====
const AI_AGENT = new FantacalcioAIAgent();

// ===== INTEGRAZIONE CON LA PAGINA =====
// La funzione askAI() nel tuo form chiama Claude API
// Questo agente fornisce i DATI per il contesto di Claude

/**
 * Prepara il contesto per Claude dall'agente IA
 */
function getAIContext() {
    const myTeam = teams[1]; // La squadra dell'utente
    const currentStrategy = window.currentStrategy || 'bilanciata';
    
    const report = AI_AGENT.generateFullReport(
        myTeam,
        currentStrategy,
        teams,
        typeof PLAYERS_DATA !== 'undefined' ? PLAYERS_DATA : [],
        1
    );
    
    return report;
}

/**
 * Formatta il report per includere nella conversazione con Claude
 */
function formatReportForClaude(report) {
    let context = `
ANALISI ASTA IN TEMPO REALE - ${new Date().toLocaleTimeString()}

**STATO SQUADRA:**
- Speso: ${teams[1].spent}M / ${teams[1].spent + teams[1].budget}M
- Budget Rimasto: ${teams[1].budget}M
- Giocatori: ${teams[1].players.length}/25

**ANALISI BUDGET vs TARGET (${report.mainAdvice.type}):**
`;
    
    for (const role in report.teamAnalysis) {
        const analysis = report.teamAnalysis[role];
        context += `
${role}: ${analysis.actual}% (target ${analysis.target}%) - Deviazione: ${analysis.deviation > 0 ? '+' : ''}${analysis.deviation}% ${analysis.status}`;
    }
    
    if (report.alerts.length > 0) {
        context += `

**AVVISI:**
`;
        for (const alert of report.alerts) {
            context += `
${alert.icon} [${alert.severity.toUpperCase()}] ${alert.message}`;
        }
    }
    
    if (report.opportunities.length > 0) {
        context += `

**OPPORTUNITÀ ANCORA LIBERE (A-TIER):**
`;
        for (const opp of report.opportunities) {
            context += `
- ${opp.name} (${opp.role}, ${opp.tier}, ${opp.team}) - Expected FM: ${opp.expectedFantamedia}, Titolarità: ${opp.titolarita}`;
        }
    }
    
    context += `

**CONSIGLIO PRINCIPALE:**
${report.mainAdvice.icon} ${report.mainAdvice.title}
${report.mainAdvice.advice}`;
    
    return context;
}
