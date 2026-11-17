# Mappa del listone — players_data.js

> Non regole di lega (quelle sono in `regole_lega_polibio.md`): qui sta
> la struttura dei dati. Serve a non riscoprire ogni volta le stesse
> trappole quando si tocca l'agente o il megafile.
>
> Scritto il 6 settembre 2026, aggiornato l'11 settembre 2026 e di nuovo il
> **16 novembre 2026** (§14-§16: imbattibilità, scala dei prezzi, nuova
> convenienza). Il listone è ora quello a **11 giornate giocate**
> (intestazione del file: dati reali a fine 11ª giornata, 16 novembre 2026);
> gli esempi numerici dei paragrafi 1-13 risalgono invece alla versione a 3
> giornate dell'11 settembre. I VALORI cambieranno con ogni
> aggiornamento del file; la STRUTTURA descritta qui — nomi dei campi,
> cosa significano, dove sono le trappole — è quella della pipeline e
> cambia molto più raramente. Se un campo qui descritto sparisce o cambia
> significato in un file nuovo, va segnalato e questo documento va corretto.
>
> **Il listone è ora condiviso fra due leghe.** Alcuni campi sono tarati
> sulle regole di Fantalissandria e NON valgono per la Lega Fantacalcio
> 1996, che non ha il modificatore difesa: vedi §12.

---

## 0. Stato dell'aggiornamento

- **531 giocatori**, statistiche stagione corrente a **fine 11ª giornata**
  (`pv_2627` massimo 11, 74 giocatori a quota 11, 448 con almeno una presenza).
  Fonte: `Statistiche_Fantacalcio_Stagione_2026_27_16.novembre.2026_11
  giornate.xlsx`, foglio "Tutti".
- Aggiornato **solo il blocco `_2627`** (squadra, presenze, media voto,
  fantamedia, gol, gol subiti, rigori parati, assist, cartellini, autogol).
  Prezzi, fasce, titolarità attesa, rischi e tutti i campi storici sono
  quelli di settembre: **non descrivono il mercato di novembre**.
- Abbinamento per nome e ruolo: 531 su 531, nessun cambio di squadra, nessuna
  presenza in calo. Nel file ci sono 72 giocatori che il listone non ha (7 con
  almeno 5 presenze: Ehizibue, Leite, Darmian, El Shaarawy, Sierro, Wiafe,
  Esteban): non sono stati aggiunti perché mancano di prezzo e fascia.
- La fantamedia del file torna dal voto e dagli eventi per 439 giocatori su
  448; sugli altri 9 c'è uno scarto di 0,1-0,5 che è già nel file sorgente
  (causa non verificata: forse espulsioni o partite senza voto). Il valore
  del file è stato preso così com'è.
- Dalla versione 3.9.9.50 l'agente usa **anche la stagione in corso** per
  stimare la resa (fantamedia e presenze 2026/27): vedi §17. I parametri
  sono stati verificati sui dati nella 3.9.9.51: vedi §18.
- Per rifare l'aggiornamento: `estrai_statistiche.py` (dall'Excel a JSON) e
  poi `aggiorna_listone.js`, entrambi nel repo.

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
campione piccolo. Dal 16 novembre 2026 la resa è misurata rispetto al
giocatore di rimpiazzo del ruolo, non rispetto al 6: vedi §16.

Il campo `valueScore` del listone resta nel dato ma non va più usato per ordinare o filtrare: è lasciato solo come riferimento,
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

## 12. Campi tarati su Fantalissandria — da NON usare nella Lega 1996

**Aggiunto l'11 settembre 2026**, quando il listone ha iniziato a servire
due leghe con regole diverse.

L'intestazione del file lo dice: *"tarato sulle regole della lega di
Polibio: modificatore difesa attivo, portiere incluso"*. Questi campi
descrivono un vantaggio che nella Lega Fantacalcio 1996 non esiste:

- **`maxPriceLega`** — non è un prezzo di mercato, è il prezzo già CORRETTO
  per il modificatore. Coincide con `pfc` per il giocatore mediano, ma si
  discosta su portieri e difensori (circa 148 giocatori, fino a +12-20%).
  Senza modificatore va ignorato e si torna a `pfc`.
- **`leagueAdjust`, `leagueAdjustNote`** — spiegano quell'aggiustamento
  ("media voto buona per il modificatore"): fuori contesto altrove.
- **`modBargain`, `modBargainNote`, `modMediaVoto`, `modLabel`,
  `modAffidabilita`, `modPresenzeTotali`** — l'intera famiglia.
- **`verdict`** — otto giocatori hanno verdetto `OCCASIONE DA MODIFICATORE`.
  Sono gli stessi `modBargain`. Senza modificatore quella frase è falsa.

L'agente li neutralizza da solo quando la lega selezionata non ha il
modificatore (`AI_AGENT.configuraLega`), ma chi interroga il listone
direttamente deve saperlo.

### Il ribaltamento della logica sui difensori

Col modificatore conta il **voto puro**, quindi i difensori pieni di bonus
sono sopravvalutati e i "grigi" con voto alto sono le occasioni: è quello
che segnala `modBargain`. Senza modificatore conta il **fantavoto**, e la
logica si capovolge.

Misura utile, non presente come campo: *fantamedia storica meno media voto*,
cioè l'apporto di bonus per partita. Sui difensori con almeno 40 presenze va
da **+0,77 di Dimarco** (+29 punti stagione) a **−0,16 di Pongracic**: circa
35 punti stagione di differenza a parità di voto. Gli otto `modBargain` hanno
apporto quasi nullo (Carlos Augusto +0,17, Pavard −0,05): perfetti col
modificatore, difensori qualunque senza.

---

## 13. Verifica incrociata delle fasce Laudantes (11 settembre 2026)

Confronto fra il campo `tierLaudantes` del listone e il file sorgente
`TABELLE_2026_2027_BY_LAUDANTES.xlsx`, su tutti i giocatori classificati.

**Esito: zero discordanze.** Dove entrambi hanno un valore, coincidono
sempre. La pipeline non ha perso né storpiato nulla nel passaggio.

Due buchi, però:

- **DYBALA (ATT, Roma)**: il file lo dà **A+**, il listone non ha
  `tierLaudantes`. Il suo `tierConsensus` risulta **A** e poggia su una
  fonte sola (`tierAgreement: FONTE SINGOLA`). È un attaccante da 61
  crediti: una fascia di scarto pesa.
- **MODRIC (CEN, Milan)**: stesso caso, ma il consenso (A-) coincide con
  il file. Nessun effetto pratico.

Sono gli unici due giocatori sopra i 15 crediti senza `tierLaudantes`
insieme ad ALAJBEGOVIC (21,4), che nel file non compare.

---

## 14. La fantamedia NON contiene l'imbattibilità (16 novembre 2026)

Ricalcolando `fm_2526` dei portieri dai campi grezzi:

`mv − gs/pv + 3·rp/pv + ass/pv − 0,5·amm/pv − esp/pv − 2·au/pv`

si ottiene esattamente il valore del listone (Carnesecchi 5,58 in entrambi i
modi, Maignan 5,42, Caprile 4,87). Non c'è nessun +1 per la porta inviolata.

- **Fantalissandria** premia l'imbattibilità: lì `fmStorica` **sottovaluta** i
  portieri, e di più quelli delle difese solide.
- **Lega 1996** non la premia: lì `fmStorica` è già corretta.

Le porte inviolate non sono nel listone. L'agente le stima dai gol subiti
(`AI_AGENT.bonusImbattibilita`): con una media di L gol a partita la quota di
partite a zero è circa e^−L. È una stima, non un conteggio: Svilar 0,40 a
partita (+15 punti stagione), Falcone 0,24 (+9).

Il commento nel codice che diceva il contrario ("il portiere prende −1 per
gol subito e +1 per imbattibilità, quindi... fm 5,408 contro 4,973") è stato
corretto.

## 15. Su quale lega è tarato il listino (16 novembre 2026)

`pma` e `pfc` sono prezzi per una lega a **8 squadre da 500 crediti**. Prova:
i 200 giocatori più cari (24 POR, 64 DIF, 64 CEN, 48 ATT) sommano 3861 di
`pma` e 4049 di `pfc`, contro 4000 crediti in circolazione.

In una lega con un monte crediti diverso i prezzi vanno riportati in scala.
L'agente lo fa con `AI_AGENT.scalaPrezzi()` e `AI_AGENT.prezzoLega(v)`:

`prezzo di lega = 1 + (prezzo di listino − 1) × scala`
`scala = (crediti totali − slot totali) / (4000 − 200)`

Fantalissandria: scala 1. Lega 1996 (3290 crediti, 192 slot): scala 0,815.

Chi legge `pma` o `pfc` direttamente dal file ottiene il prezzo di listino,
non quello di lega: per la 1996 usare `AI_AGENT.mercato(p)` e
`AI_AGENT.tettoPrezzo(p)`.

## 16. Come si misura adesso la convenienza (16 novembre 2026)

Fino alla 3.9.9.48 `convenienza()` calcolava `(fantamedia − 6) × 38 ×
titolarità`. Lo zero a 6 per tutti i ruoli dava tre effetti sbagliati:

- tutti i 38 portieri con storico risultavano **in perdita** (hanno
  fantamedia intorno a 5 per via dei gol subiti) e i 26 senza storico
  valevano 0: i primi consigliati erano terzi portieri mai visti in Serie A;
- lo stesso per 81 difensori su 188;
- una resa negativa divisa per il prezzo si avvicina a zero, quindi fra due
  giocatori "in perdita" il più caro sembrava il più efficiente.

Ora lo zero è il **giocatore di rimpiazzo** del ruolo
(`AI_AGENT.rimpiazzo(role)`): il quartile basso della fantamedia fra chi ha
almeno 20 presenze. Valori col listone attuale: POR 5,10 (4,82 senza
imbattibilità), DIF 5,84, CEN 6,03, ATT 6,45. Sotto zero non si divide più
per il prezzo. *(Dalla 3.9.9.51 chi ha poche presenze viene tirato verso la
mediana del ruolo, non più verso il rimpiazzo: vedi §18.)*

`puntiAttesi` va quindi letto come **punti a stagione in più di un giocatore
preso a 1 credito**, non in più della sufficienza.

Stessa correzione nell'elenco "DA NON RILANCIARE": i giocatori senza storico
ne sono esclusi (la loro resa 0 è assenza di dati, non scarso rendimento), e
la riga mostra il motivo vero della segnalazione — posizione per prezzo
contro posizione per resa — invece del tetto del listone, che in 14 casi su
19 era più alto del mercato e faceva leggere la frase al contrario.

## 17. La stagione in corso entra nella stima (16 novembre 2026, v3.9.9.50)

Voluto da Polibio in vista di scambi e mercato di gennaio. Prima la resa
usava solo `fmStorica` (tre stagioni passate): a campionato avviato ignorava
quanto visto in campo e lasciava senza giudizio 83 giocatori privi di storico
ma con 5 o più presenze quest'anno (Ramos G., Vicario, Mora...).

**Fantamedia** (`AI_AGENT.campione(p)`): media fra passato e presente pesata
per le presenze, con le partite di quest'anno che contano **doppio**.

`fm = (nS × fmStorica + 2 × nC × fm_2627) / (nS + 2 × nC)`

`nS` sono le presenze delle stagioni entrate in `fmStorica`, cioè quelle con
almeno 10 presenze (verificato: la media pesata così calcolata riproduce
`fmStorica` per 335 giocatori su 335). Il temperamento per campione piccolo
si applica sul campione efficace `nS + 2 × nC`, fiducia piena a 50.

**Titolarità** (`AI_AGENT.titolaritaStimata(p)`): `expectedTitolarita` di
settembre corretta con le presenze reali. La previsione vale 5 giornate, i
fatti valgono le giornate giocate: all'11ª le presenze pesano per due terzi.
*(Nella 3.9.9.50 la previsione valeva 19 giornate: la verifica di §18 ha
detto che era troppo.)*

I parametri stanno in cima a `fantacalcio_ai.js` (`PESO_STAGIONE_CORRENTE`,
`GIORNATE_PRIOR_TITOLARITA`, `FIDUCIA_K`) e sono tarati sui dati: §18.

**Limite**: le presenze non distinguono chi ha perso il posto da chi è stato
infortunato. Martinez L. (5 presenze su 11) scende dal 92% al 60% di
titolarità stimata: se era fermo per infortunio, è sottovalutato.
`infortuni_serie_a.js` è fermo all'8 settembre e non aiuta. Rimedio a mano:
nel pannello di riparazione la spunta "Era infortunato" riporta quel
giocatore alla titolarità prevista a settembre
(`AI_AGENT.impostaFiduciaManuale`).

Esempi all'11ª giornata: Rabiot fantamedia 6,73 storica e 8,67 quest'anno →
7,18; Dimarco 7,24 e 6,20 → 7,06; Mora (nessuno storico, 9 presenze a 7,89)
passa da "come un rimpiazzo" a +28 punti stagione.

## 18. I parametri verificati sui dati (16 novembre 2026, v3.9.9.51)

Tre prove, rifacibili con `backtest_parametri.js` (serve anche il file delle
statistiche a 5 giornate convertito in `stat5.json`). L'errore è lo scarto
tipico fra fantamedia prevista e fantamedia reale, pesato per le presenze.

**A. Quanto fidarsi di poche partite, e verso cosa tirare.** Previsione della
fantamedia 2025/26 dalle due stagioni precedenti, 193 giocatori:

| Regola | Errore |
|---|---|
| nessun temperamento | 0,425 |
| fiducia piena a 50 presenze, verso il quartile basso (3.9.9.50) | 0,392 |
| **fiducia = n / (n + 25), verso la mediana del ruolo (ora)** | **0,354** |

Stesso verso, più debole, prevedendo la stagione in corso dalle tre
precedenti (0,596 → 0,590). Il quartile basso resta lo zero della scala (il
rimpiazzo); come ipotesi su un giocatore poco noto era troppo pessimista.

**B. Peso della stagione in corso.** Previsione delle giornate 6-11 da
storico più prime 5 giornate, 246 giocatori: errore minimo con peso fra 2 e
3, in risalita oltre 4. Per chi ha già uno storico le partite di quest'anno
aggiungono poco (ottimo fra 1 e 2); per i 63 senza storico sono decisive
(0,99 → 0,89). **Confermato il peso 2.** Con la regola nuova l'errore
complessivo di questa prova scende da 0,809 a 0,795.

**C. Titolarità.** Previsione della quota di presenze nelle giornate 6-11,
531 giocatori:

| Cosa si usa | Errore |
|---|---|
| solo la previsione di settembre | 0,375 |
| solo le presenze delle prime 5 giornate | 0,340 |
| previsione che vale 19 giornate (3.9.9.50) | 0,339 |
| **previsione che vale 2-5 giornate (ora: 5)** | **0,312** |

La previsione di settembre era ottimista: chi era dato all'80-89% ha giocato
il 68% delle partite, chi al 50-59% il 27%.

**Limiti di queste prove.** La C misura un orizzonte di 6 giornate, non un
girone: su tempi lunghi gli infortunati rientrano, per questo si è scelto 5
e non 2. A e B poggiano su 200-250 giocatori e su chi ha continuato a
giocare. Gli errori restano grandi in assoluto: la fantamedia di un singolo
giocatore su poche partite è in buona parte caso.

## 19. Mercato di riparazione e scambi (16 novembre 2026, v3.9.9.51)

Pannello "Mercato di riparazione e scambi" nell'app, sotto la panoramica
delle squadre. Lavora sulle rose dell'asta conclusa (ricaricata o ripresa).

- **Unità di misura**: punti attesi **da qui a fine campionato**, in più del
  rimpiazzo del ruolo (`AI_AGENT.resaResidua`). I prezzi del listone non
  entrano: sono di settembre.
- **Valore di una rosa** = l'undici migliore schierabile
  (`AI_AGENT.migliorFormazione`), non la somma dei 25. A Fantalissandria si
  considerano solo i moduli con almeno 4 difensori (condizione del
  modificatore). La somma della rosa intera è mostrata a parte.
- **Cambi consigliati** (`AI_AGENT.sostituzioni`): libero migliore al posto
  del peggiore in rosa, solo se l'undici guadagna almeno 2 punti.
- **Scambi** (`AI_AGENT.valutaScambio`): effetto sull'undici di entrambe le
  squadre; rifiuta gli scambi che portano un reparto oltre il limite.
- **Operazioni** (in `fantacalcio_app.js`): `svincolaGiocatore`,
  `acquistaInRiparazione`, `applicaScambio`, `annullaRiparazione`. Finiscono
  in `riparazioneLog`, salvato nel browser e nel file dell'asta.
- **Contabilità**: resta `budget + spent = budget iniziale`. Dopo uno
  svincolo la quota non rimborsata resta in `spent`, che quindi non coincide
  più con la somma dei prezzi in rosa. Negli scambi i prezzi seguono i
  giocatori, i crediti no (salvo conguaglio).
- **Rimborso allo svincolo**: per lega, in `LEGHE[...].svincolo`.
  Fantalissandria: metà del prezzo arrotondata **per eccesso** (7 → 4,
  confermato da Polibio, dalla 3.9.9.52), tutto se il giocatore ha lasciato
  la Serie A; negli scambi sono ammessi i crediti. Lega 1996: regola **non
  nota** (da chiedere alla lega), l'app chiede l'importo ogni volta.

---

## Riepilogo delle trappole (le cose da NON rifare)

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
6. Non usare `maxPriceLega` né la famiglia `mod*` fuori da Fantalissandria:
   sono tarati sul modificatore difesa (§12).
7. Non fidarsi di `tierConsensus` quando `tierAgreement` dice
   `FONTE SINGOLA`: poggia su una fonte sola e può discostarsi da Laudantes,
   come su Dybala (§13).
8. Non trattare `fmStorica` dei portieri come completa a Fantalissandria:
   manca l'imbattibilità (§14).
9. Non usare `pma`/`pfc` come prezzi della Lega 1996: sono tarati su 4000
   crediti, lì ne circolano 3290 (§15).
10. Non misurare la resa rispetto al 6: rende negativi tutti i portieri.
    Usare il rimpiazzo del ruolo (§16).
