# Mappa del listone — players_data.js

> Non regole di lega (quelle sono in `regole_lega_polibio.md`): qui sta
> la struttura dei dati. Serve a non riscoprire ogni volta le stesse
> trappole quando si tocca l'agente o il megafile.
>
> Scritto il 6 settembre 2026, a listone aggiornato alla 2ª giornata di
> campionato 2026/27. I VALORI cambieranno con ogni aggiornamento del
> file (arriverà presto una versione a 3 giornate giocate); la STRUTTURA
> descritta qui — nomi dei campi, cosa significano, dove sono le
> trappole — è quella della pipeline e cambia molto più raramente. Se un
> campo qui descritto sparisce o cambia significato in un file nuovo, va
> segnalato e questo documento va corretto.

---

## 1. Cifre di base

- 531 giocatori, 108 campi distinti in totale (nessun giocatore li ha
  tutti: alcuni campi sono derivati e compaiono solo quando applicabili)
- **Attenzione nel controllare la struttura**: `Object.keys(D[0])` mostra
  solo 94 campi, perché il primo giocatore dell'array non ha valorizzati
  gli altri 14 (perlopiù campi del modificatore e di Laudantes). Per
  vedere tutti i campi bisogna fare l'unione delle chiavi su tutto
  l'array, non fidarsi di un solo record.

## 2. Fonti dichiarate vs fonti reali

L'intestazione del file dichiara: *Fantaculo + Fantacalcio.it (4
stagioni) + Laudantes (2 stagioni)*.

Il campo `sources` di ogni giocatore elenca fra: `fantaculo`,
`fantacalcio_2324`, `fantacalcio_2425`, `fantacalcio_2526`,
`fantacalcio_2627`, `laudantes_2627`.

**Discrepanza nota**: esiste anche un campo `tierLaudantes_2526`
(popolato su 162 giocatori), cioè Laudantes dell'annata 2025/26 — la
"seconda stagione" dichiarata nell'intestazione. Ma `laudantes_2526` non
compare mai come voce nel campo `sources`. Il dato è integrato e usato
(alimenta `tierMovement`, es. "RETROCESSO A+ → A"), solo non è tracciato
nell'elenco fonti. Se un giorno si controlla la provenienza di un dato
guardando `sources`, questa annata non risulterà: non vuol dire che
manchi, vuol dire che quella lista non è un inventario completo.

## 3. I due prezzi di mercato — leggibili come controprova reciproca

- **`pma`**: prezzo da Fantacalcio.it. Popolato su tutti i 531.
- **`pfc`**: prezzo da Fantaculo. Popolato su tutti i 531.
- Correlazione fra i due, verificata sugli attaccanti: **0.995**. Sono
  quasi lo stesso numero da due fonti indipendenti — utile: se un giorno
  risultano molto diversi su un giocatore specifico, è il segnale di un
  problema nei dati di quel giocatore, non delle due fonti in generale.
- **`maxPriceLega`**: il tetto corretto per le regole di QUESTA lega
  (adegua il prezzo di mercato al valore del modificatore difesa).
  Popolato su tutti e 531 i giocatori, sempre. Il pattern che si vede nel
  codice `p.maxPriceLega !== undefined ? p.maxPriceLega : p.pfc` è quindi
  ridondante nella pratica: il ramo `pfc` non scatta mai, perché
  `maxPriceLega` è sempre presente. Tenerlo comunque come fallback difensivo
  ha senso, ma non aspettarsi che si attivi con questo file.

## 4. Storico per stagione — quattro blocchi paralleli

Per ognuna delle 4 stagioni (`_2324`, `_2425`, `_2526`, `_2627`) esiste lo
stesso set di campi: `team_XXXX`, `pv_XXXX` (presenze), `mv_XXXX` (media
voto), `fm_XXXX` (fantamedia), `gf_XXXX` (gol fatti), `gs_XXXX` (gol
subiti, rilevante per i portieri), `rp_XXXX` (rigori parati/segnati a
seconda del ruolo), `ass_XXXX` (assist), `amm_XXXX` (ammoniti), `esp_XXXX`
(espulsi), `au_XXXX` (autogol).

Da questi blocchi sono derivati (calcolati una volta, non da ricalcolare):
- **`fmStorica`**, **`mvStorica`**: media pesata sulle stagioni disponibili
- **`pvMedia`**: media presenze
- **`seasonsUsed`**: quante stagioni sono confluite nella media (valori
  osservati: 0, 1, 2, 3 — mai 4, quindi nessun giocatore ha tutte e
  quattro le annate usate nella media, verosimilmente per join parziali
  o giocatori nuovi in Serie A)
- **`trend`**, **`trendDelta`**: direzione del rendimento nel tempo
- **`consistency`**, **`consistencyLabel`**: quanto è stabile il
  rendimento fra stagioni

### La formula esatta di fmStorica/mvStorica/pvMedia/seasonsUsed

**Scoperta l'8 settembre 2026, per reverse-engineering: serviva ad
aggiornare il file alla 3ª giornata senza rompere questi campi.**

Questi quattro campi dipendono **solo** dalle tre stagioni passate
complete (`_2324`, `_2425`, `_2526`) — **mai** dalla stagione in corso
(`_2627`), verificato al 100% su tutti i 335 giocatori con storico:

- Una stagione passata "conta" solo se `pv >= 10` in quella stagione
  (sotto quella soglia viene scartata come campione inaffidabile, es.
  un infortunio che ha limitato il giocatore a poche partite)
- `seasonsUsed` = quante delle tre stagioni passate superano la soglia
- `mvStorica`/`fmStorica` = media di `mv`/`fm` pesata per `pv`, solo
  sulle stagioni che superano la soglia
- `pvMedia` = media semplice (non pesata) di `pv`, solo sulle stagioni
  che superano la soglia

**Conseguenza pratica**: aggiornare `pv_2627`/`mv_2627`/`fm_2627` (e gli
altri campi `_2627`) con le statistiche di giornata in giornata **non
tocca mai** `fmStorica`, `mvStorica`, `pvMedia`, `seasonsUsed`. Si può
aggiornare la stagione corrente in sicurezza senza ricalcolare nient'altro
in questi quattro campi. Non è stato verificato se altri campi calcolati
(tier, prezzi, quality/value score, campi `mod*`) seguano la stessa
convenzione: quelli restano un'ipotesi non testata, da non dare per
scontata.

## 5. La trappola delle presenze — `modPresenzeTotali` NON è generale

**Scoperta il 5 settembre, causa di un errore poi corretto nell'agente.**

`modPresenzeTotali` esiste SOLO per POR (21/64 popolati) e DIF (127/188).
Per CEN e ATT vale sempre 0 — **zero su 279 giocatori**, non "pochi",
proprio nessuno. Un filtro tipo `modPresenzeTotali >= 50` applicato a
tutti i ruoli esclude in blocco ogni centrocampista e attaccante, inclusi
i più affermati (era successo con Calhanoglu e McTominay).

**Il modo corretto e universale** per sapere quante partite ha
giocato un giocatore, qualsiasi ruolo: sommare i quattro `pv_XXXX`.
Il resto della pipeline (`modMediaVoto`, `modBonusAtteso`, `modLabel`,
`modAffidabilita`, `modBargain`, `modBargainNote`) è costruito apposta
per il modificatore difesa e infatti condivide la stessa copertura
POR+DIF di `modPresenzeTotali` — coerente, ma da ricordare se si pensa
di riusarlo altrove.

`modBargain` (il flag "occasione da modificatore") è vero per **soli 8
giocatori** in questo file: Falcone, Caprile (POR), Carlos Augusto,
Spinazzola, Vasquez, Tavares N., Dodò, Pavard (DIF). È un elenco corto
apposta — sono le vere occasioni, non un filtro largo.

## 6. `penaltyProbability` — non è quello che il nome suggerisce

**Scoperta il 5 settembre, causa di un calcolo iniziale sbagliato poi
corretto.**

Il nome fa pensare alla percentuale di realizzazione dei rigori. Non lo
è: è la **probabilità di essere il rigorista designato**, cioè la quota
di rigori che quel giocatore calcerebbe nella sua squadra. Per squadra i
valori sommano circa 100 (es. Inter: Calhanoglu 70, Zielinski 20,
Martinez L. 10).

Non calcolare un valore atteso tipo `probabilità × premio + (1-probabilità)
× penalità`: userebbe la percentuale sbagliata e darebbe numeri assurdi
(un esempio uscito in questa sessione: Malen risultava a -0.6 punti
attesi a rigore, come se ne sbagliasse il 60%).

Campo collegato: `freeKickProbability`, stessa logica di quota-non-tasso,
non ancora sfruttato nell'agente.

## 7. `valueScore` — non affidabile per ordinare i consigli

**Scoperta il 6 settembre, causa della riscrittura di `bestValue()`
nell'agente.**

Il campo di "convenienza" del listone (0-100) è compresso e a tratti
incoerente: il 57% dei giocatori sta fra 20 e 40, 34 sono saturi
esattamente a 100, e due difensori quasi identici per prezzo e resa
(Buongiorno e Carlos Augusto) risultavano a 18 contro 95.5.

L'agente ora calcola una convenienza propria dentro `AI_AGENT.convenienza()`,
su due assi (resa assoluta e resa per credito), con un correttivo per
campione piccolo. Il campo `valueScore` del listone resta nel dato ma non
va più usato per ordinare o filtrare: è lasciato solo come riferimento,
se mai serve confrontarlo.

`qualityScore` (con il dettaglio in `qualityBreakdown`) non ha lo stesso
problema, viene ancora usato per il tier e la qualità mostrata in scheda.

## 8. Tier e fasce — tre sistemi che convivono

- **`fasciaFc`** / **`tierFantaculo`**: fascia secondo Fantaculo
- **`tierLaudantes`** (26/27) e **`tierLaudantes_2526`** (25/26): fasce
  Laudantes S/A++/A+/A/A-/A--/B/C, vedi §2 per la nota sulla fonte
- **`tierConsensus`**: fascia di sintesi fra le fonti, usata come "tier"
  principale nelle schede (`tier`, `roleShort` sono scorciatoie derivate)
- **`tierAgreement`**, **`tierSources`**: quanto le fonti sono d'accordo
  e quali fonti hanno contribuito al consenso
- **`tierMovement`**, **`tierNote`** (61 giocatori): variazione fra
  Laudantes 25/26 e 26/27, con nota testuale tipo "RETROCESSO (A+ → A)"
- **`tierBudgetPct`** (157 giocatori): percentuale di budget-lega
  suggerita da Laudantes per quella fascia
- **`lauAnnotations`** (261 giocatori): annotazioni testuali libere di
  Laudantes, non ancora lette da nessuna funzione dell'agente

## 9. Rischi e stato

- **`playerStatus`**: stringa breve (osservati: valori tipo B, P — non
  documentato altrove cosa significhi ogni lettera, verificare con
  Polibio se serve distinguerli in dettaglio)
- **`unavailableUntilRound`**, **`rientroIncerto`**: assenza e incertezza
  sul rientro
- **`newArrival`**: nuovo in Serie A o nella squadra
- **`lastThreeYearTitolarity`**: titolarità storica su tre anni,
  DIVERSA da `expectedTitolarita` che è la stima per la stagione in corso
- **`risks`**, **`riskLevel`**: elenco testuale dei rischi (quello che
  compare come "rischi: ..." nelle schede) e un livello di sintesi
- **`setPieces`**: array di ruoli sui piazzati (RIGORISTA, PUNIZIONI,
  ANGOLI); combinato con `penaltyProbability` per i rigoristi (§6)

## 10. Campi di prezzo derivati, poco esplorati finora

`priceDelta`, `priceEdgePct`, `priceEdgeGrezzo`, `priceLabel`,
`leagueAdjust`, `leagueAdjustNote` — tutti collegati all'aggiustamento
del prezzo per le regole di lega, ma non ancora tutti letti dall'agente.
`leagueAdjustNote` in particolare è quello che spiega perché un tetto è
molto sotto il prezzo di mercato (usato in `quantoOffrire` per il
messaggio `perTettoBasso`, vedi sessione del 6 settembre).

## 11. `matchLog` — non ancora aperto

Campo presente ma il cui contenuto non è stato ispezionato in questa
sessione. Nome suggerisce un log partita per partita della stagione
corrente. Da controllare se e quando serve un dettaglio più fine del
riepilogo stagionale.

---

## 12. Affidabilità dei tier Laudantes — verificata, non ancora usata nel codice

**Scoperta l'8 settembre 2026. TODO per la prossima volta che si tocca
`fantacalcio_ai.js`: non ancora implementato, di proposito, per non
toccare il codice a ridosso dell'asta.**

Confrontando il tier Laudantes assegnato PRIMA della stagione con la
media voto REALE ottenuta in quella stessa stagione (su DIF, il ruolo
che conta per il modificatore, su tre stagioni 2023-26):

- **La fascia larga è affidabile in tutte e tre le stagioni**: il gruppo
  alto (S/A++/A+/A) ha sempre media voto reale più alta del gruppo basso.
- **Le distinzioni fini fra tier adiacenti sono rumorose**: A- contro B,
  o B contro B+ contro B-, si sovrappongono o si invertono in due
  stagioni su tre (es. 2023-24: B- batte B e B+; 2025-26: A- e B quasi
  pari). Campioni piccoli (5-19 giocatori per cella), ma il pattern è
  coerente nel tempo, non un caso isolato.

**Implicazione per `correttivoPrezzoPerTier`** (in
`storico_fantalissandria.js`, letto da `quantoOffrire()` in
`fantacalcio_ai.js`): oggi tratta ogni tier con uguale fiducia. Andrebbe
aggiunta una nota che segnali quando il confronto riguarda due tier
adiacenti nella stessa fascia larga (es. A- vs B), avvisando che li' la
distinzione ha meno base storica, mentre fra fasce larghe diverse
(es. A vs B) il confronto regge meglio.


1. Non filtrare su `modPresenzeTotali` per ruoli diversi da POR/DIF:
   sommare i quattro `pv_XXXX` invece.
2. Non trattare `penaltyProbability` come percentuale di realizzazione:
   è la quota di essere il rigorista designato.
3. Non ordinare o filtrare sulla base di `valueScore`: usare
   `AI_AGENT.convenienza()`.
4. Non aspettarsi `laudantes_2526` dentro `sources`: cercare invece
   `tierLaudantes_2526` come campo diretto.
5. Non guardare solo `Object.keys(D[0])` per sapere quali campi esistono:
   fare l'unione su tutto l'array.

## 13. Cose lasciate indietro — TODO per la prossima sessione di codice

**Scritto l'8 settembre 2026, esplicitamente per non perderle fra una
conversazione e l'altra.**

1. ~~Affidabilità Laudantes per fascia larga vs sotto-tier~~ **FATTO
   l'8 settembre 2026** (v3.9.9.21): cautela aggiunta a `correttivoLega`. (vedi §12
   sopra): aggiungere una cautela a `correttivoPrezzoPerTier` quando il
   confronto è fra due tier adiacenti nella stessa fascia larga.

2. **Dati infortuni**: due fonti verificate e pronte da integrare —
   `fantacalcio.it/infortunati-serie-a` (copertura larga, testo libero,
   include casi a rischio senza data) e `fantacalcio-online.com/it/
   infortunati-serie-a` (tabella pulita, data di rientro esatta, fonte
   per riga). **Discordano su almeno un caso** (Buongiorno: fine
   settembre secondo una, meta' novembre secondo l'altra — la guida
   UltimoUomo al Napoli conferma l'operazione al ginocchio a fine
   luglio, il che rende piu' credibile la stima piu' lunga, ma non
   risolve la discrepanza da solo). Da integrare come nuovo campo,
   segnalando esplicitamente i casi di disaccordo invece di sceglierne
   uno a caso.

3. **Dalle guide Fantaculo/Fantaredazione** (due PDF letti l'8
   settembre), idee valutate e non ancora implementate:
   - **Vincolo di diversificazione squadra reale**: mai piu' di 5-6
     giocatori della stessa squadra di Serie A in rosa, mai piu' di 3
     titolari della stessa squadra nell'undici ideale. Costo di
     implementazione basso (basta contare `p.team` sugli acquisti), non
     richiede dati nuovi.
   - **Cautela sui `newArrival`**: il campo esiste gia' nel listone e
     non viene mai usato. L'idea (solo Shevchenko e Platini hanno vinto
     la classifica cannonieri al primo anno in Italia, nemmeno Ronaldo)
     suggerisce un avviso simile a quello sui campioni statistici
     piccoli, ma per un motivo diverso (adattamento al campionato, non
     scarsita' di dati storici).
   - **Tendenza allenatore** (offensivo/difensivo/quanto ruota): idea
     buona ma richiede una fonte dati che non abbiamo (chi allena dove
     e con che tendenza). Non c'e' un modo semplice per procurarsela
     senza un lavoro editoriale ricorrente stagione per stagione.
   - **Divergenza nota e consapevole**: la guida raccomanda 12-15% del
     budget alla difesa (di piu' se il modificatore e' forte), noi
     siamo scesi al 9% dopo il calcolo sulle soglie esatte di questa
     lega. Non cambierei rotta, ma va tenuto a mente come disaccordo
     con una fonte autorevole, non come qualcosa di ignorato per
     sbaglio.

4. **Difesa Lazio 2026/27 — segnale di rischio da fonte esterna**: la
   guida UltimoUomo (dati di precampionato, quindi da confermare con
   le partite vere) descrive la coppia centrale Doekhi-Provstgaard come
   lenta e gia' in difficolta' contro ogni avversario di livello medio
   nelle amichevoli, con "imbarcate mostruose" esplicitamente previste
   dall'autore. Non abbiamo verificato questo con dati di campionato:
   da controllare quando arriveranno altre giornate, prima di scartare
   o confermare i difensori Lazio per il modificatore.

5. **Campo "Chiedi un consiglio" nell'Agente IA — bottone collegato alla
   funzione sbagliata**: esiste gia' una funzione completa `askAI()` che
   legge la domanda e costruisce un contesto con lo stato dell'asta, ma
   il bottone HTML chiama `inviaReport()` (che ignora il campo e salva
   solo il report automatico). In piu', anche corretto il collegamento,
   `askAI()` chiama `api.anthropic.com` direttamente dal browser senza
   chiave — funziona solo dentro l'ambiente artifact di Claude.ai, non
   su GitHub Pages dove l'app e' pubblicata. La correzione sensata non e'
   abilitare una vera chiamata API (richiederebbe una chiave esposta
   lato client), ma far si' che il testo scritto nel campo venga
   aggiunto in cima al report salvato, cosi' la domanda specifica arriva
   insieme ai dati quando il report viene incollato in una conversazione
   vera con Claude.

6. ~~Manca un piano di combinazione fasce dentro ogni ruolo~~ **FATTO
   l'8 settembre 2026** (v3.9.9.18): funzione `pianoFasce()` in
   fantacalcio_ai.js, sezione PIANO FASCE nel report.: oggi il
   report dice, per ogni ruolo, quanti titolari mancano e una MEDIA di
   crediti a testa (piatta). Non distingue "1 top + 3 onesti" da "4
   omogenei" anche quando la media e' identica. La lista OBIETTIVI ALLA
   MIA PORTATA propone giocatori singoli sotto un tetto di prezzo, non
   un piano tipo "di questi slot, punta a 1 in fascia alta (tier A+/S) +
   2 in fascia media (A/A-) + 1 in fascia bassa (B/C)". E' l'equivalente
   di quello che la guida Fantaculo fa con le sue categorie Top/Semitop/
   Ottimo titolare/Scommessa/Jolly/Titolare low cost/Riserva. Da
   costruire usando `tierConsensus` o `tierLaudantes` per raggruppare i
   giocatori in fasce dentro `bestValue()`, invece di un unico tetto di
   prezzo indifferenziato.

## 14. Revisione budget POR/DIF — l'8 settembre 2026, con dati alla mano

**Trigger**: caricato un file Laudantes con lo schema di suddivisione
budget slot-per-slot, esplicitamente per "Fanta a 8 con modificatore"
(la lega di Polibio). Confrontato con la guida Fantaculo gia' letta:

| Ruolo | Nostra taratura (vecchia) | Fantaculo | Laudantes (file) |
|---|---|---|---|
| POR | 3% | 8-10% | 5.4-7.0% |
| DIF | 9% | 12-15% | 14-15% |
| CEN | 25% | 20-25% | 23-25% |
| ATT | 63% | 50-60% | 60% |

Due fonti indipendenti concordavano: piu' budget a POR e DIF di quanto
avessimo calibrato. Invece di adeguarsi alla cieca, verificato sui dati
del listone (fmStorica vs mvStorica, per tierConsensus):

- **DIF**: un A+ ha 0.33 fantamedia/partita di bonus netto in piu' di un
  tier basso (B/C, che sono a 0.01-0.04) — circa 10 punti a stagione,
  A PRESCINDERE dal modificatore. E' probabilmente il contributo
  gol/assist di un difensore che si propone in fase offensiva.
- **POR**: un A+ ha una fantamedia di 0.80 punti/partita PIU' ALTA di un
  A-- (5.32 contro 4.52) — circa 24 punti a stagione. Il gol subito (-1)
  pesa piu' del +1 di imbattibilita' per quasi tutti i portieri, ma un
  A+ ne prende sistematicamente meno e quindi perde meno.

**Conclusione**: la vecchia taratura ottimizzava SOLO il voto puro per
il modificatore (da cui la strategia "portiere piu' economico possibile,
tanto il voto e' simile"), ignorando il rendimento fantacalcistico
diretto (gol, assist, gol subiti). Le due fonti esterne avevano ragione
per un motivo diverso da quello con cui lo dicevano, ma il risultato
pratico converge: revisionate le percentuali (v3.9.9.19).

Nuovi valori (`bilanciata`): POR 3%→6%, DIF 9%→13%, CEN 25% (invariato),
ATT 63%→56%. Le altre tre strategie riviste in proporzione, prendendo il
budget aggiuntivo da ATT.

**Nota per la prossima volta**: questa e' la seconda volta in questa
sessione che una taratura fatta su UN aspetto del punteggio (il voto per
il modificatore) si e' rivelata incompleta perche' non guardava il
rendimento fantacalcistico totale. Vale la pena, in futuro, controllare
sempre fmStorica (non solo mvStorica) quando si valuta il valore di un
tier o di una fascia di prezzo.

## 15. Aggiornamento 8 settembre 2026 (sera) — chiusura di altri TODO

- **Scarsità collegata alla fascia in tempo reale**: `prossimaFasciaConsigliata`
  ora confronta `liberiAlmenoFascia[tier]` con `squadreCompetitive` e segnala
  urgenza o margine per attendere.
- **Comportamento manager collegato, ma senza toccare il target**: se una
  squadra ancora a caccia dello stesso ruolo ha un indice di sovrapprezzo
  storico >=1.2 su quel ruolo, compare un avviso mirato nel messaggio.
  Non cambia il tier consigliato (la tendenza di un manager e' un fatto su
  quella persona, non sul ruolo) — resta un avviso, non un aggiustamento
  numerico. Degrada senza errori se STORICO_MANAGER non e' caricato.
- **Diversificazione squadra reale** (dalla guida Fantaculo): avviso in
  `detectAnomalies` se >=6 giocatori totali o >=4 "titolari" (prezzo sopra
  quello da panchina) dalla stessa squadra di Serie A.
- **Cautela `newArrival`**: aggiunta a `rischi` in `playerCard()`.
- **Punto 1 di questa lista (Laudantes fascia larga vs sotto-tier)**: fatto,
  vedi sopra.
- **Campo domanda dell'agente**: `inviaReport()` ora legge `aiQuestion` e la
  antepone al report salvato, invece di ignorarla. La vecchia `askAI()`
  (che chiamava l'API Anthropic direttamente dal browser senza chiave)
  resta nel file ma non e' piu' collegata a nessun pulsante — inutilizzata,
  non rimossa per prudenza a ridosso dell'asta.

**Restano da fare**, invariati: dati infortuni (due fonti pronte, serve
gestire la discrepanza), tendenza allenatore (manca la fonte dati).
