# Regole — Lega Fantacalcio 1996 (2026/27)

> Documento di riferimento per il progetto FantaAI, seconda lega.
> Gemello di `regole_lega_polibio.md`, che vale per Fantalissandria.
> Ogni voce è marcata con la sua fonte.
>
> Regole raccolte a voce il 10 settembre 2026. La sezione 10 non contiene
> regole ma conclusioni ricavate dai dati: si possono discutere o smentire
> senza toccare il resto.

---

## 0. In una riga

Identica a Fantalissandria **tranne tre cose**: niente modificatore difesa,
niente imbattibilità del portiere, e il turno di chiamata avanza rispetto a
**chi ha comprato**, non a chi ha chiamato.

Sono poche differenze ma pesanti: la prima e la seconda cambiano quanto vale
un difensore e un portiere, la terza tocca il calcolo del turno.

---

## 1. Struttura della lega

*Fonte: Polibio, 10 settembre 2026*

| | |
|---|---|
| Squadre | 8 |
| Budget per squadra | **400 + residuo dell'anno precedente** |
| Giocatori per rosa | **24** |

Composizione obbligatoria della rosa (minimo = massimo, quindi fissa):

| Ruolo | Quantità |
|---|---|
| Portieri | 3 |
| Difensori | **7** |
| Centrocampisti | 8 |
| Attaccanti | 6 |

**Due differenze da Fantalissandria**, verificate sui verbali delle tre
stagioni passate e confermate da Polibio l'11 settembre 2026:

- **7 difensori, non 8**: la rosa è di 24 giocatori, non 25. Gli slot totali
  da riempire in asta sono quindi **192** (24 × 8), non 200.
- **Il budget non è uguale per tutti**: si parte da 400 crediti più il
  residuo non speso della stagione precedente. Nei verbali i totali iniziali
  vanno da 400 a 432 a seconda dell'annata e della squadra.

### Budget di partenza 2026/27

*Fonte: Polibio, 11 settembre 2026. Sono i residui portati in dote, che
differiscono da quelli a fine asta 2025-26 nel foglio storico (il mercato di
riparazione li ha modificati).*

| Squadra | residuo | budget |
|---|---|---|
| DINAMO BOSH | 43 | **443** |
| MARCHINHOS | 18 | **418** |
| MOTTENTUS | 12 | **412** |
| FANTAMACHO | 6 | **406** |
| BOCA MOMIX | 5 | **405** |
| ATLETICO JACK | 5 | **405** |
| SPARTA BRAGA | 1 | **401** |
| REAL PIX | 0 | **400** |

I residui vanno **confermati prima del primo acquisto**: l'app prevede un
passaggio di correzione a mano, dopo l'estrazione dell'ordine, nel caso
qualcuno li contesti. Modificarli ad asta avviata non è previsto.

### Le squadre

| # | Squadra |
|---|---|
| 1 | **MARCHINHOS** (la mia) |
| 2 | BOCA MOMIX |
| 3 | ATLETICO JACK |
| 4 | DINAMO BOSH |
| 5 | REAL PIX |
| 6 | MOTTENTUS |
| 7 | SPARTA BRAGA |
| 8 | FANTAMACHO |

*(L'ordine 2-8 è quello in cui mi sono stati elencati, non un ordine di
chiamata: quello si estrae. MARCHINHOS è in posizione 1 perché l'app tratta
la squadra 1 come la propria.)*

---

## 2. Schieramento

*Fonte: Polibio — identico a Fantalissandria*

- 11 giocatori in campo, fino a 11 in panchina
- Almeno 1 portiere e almeno 3 difensori fra i titolari
- Nessun minimo per centrocampisti e attaccanti fra i titolari
- Panchina: almeno 1 POR, 3 DIF, 3 CEN, 3 ATT
  *(da verificare: con 7 difensori invece di 8 e una rosa di 24, i minimi di
  panchina potrebbero essere diversi — vedi §11)*

Moduli consentiti: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1.

**Il cambio modulo NON è consentito durante la giornata.**

---

## 3. Punteggio

*Fonte: Polibio — voto base dalla Gazzetta dello Sport, base 6*

### Bonus e malus

| Evento | Punti |
|---|---|
| Gol segnato | +3 |
| Rigore segnato | +3 |
| Rigore parato | +3 |
| Assist | +1 |
| Assist "gold" | +1 |
| Cartellino giallo | −0,5 |
| **Gol subito** | **−1 (solo portiere)** |
| Cartellino rosso | −1 |
| Autogol | −2 |
| Rigore sbagliato | −3 |

Valgono zero: gol vittoria, migliore in campo.

### Le due differenze da Fantalissandria

1. **Non esiste l'imbattibilità (clean sheet).** A Fantalissandria valeva
   +1 al portiere. Qui il portiere non ha più nessun bonus difensivo: gli
   restano il rigore parato (evento raro) e il malus per gol subito.
2. **Non esiste il bonus capitano.** A Fantalissandria il capitano prendeva
   da −1,5 a +1,5 secondo il voto. Qui non c'è designazione del capitano.

### Regola sui senza voto

Chi non prende voto ma viene ammonito non viene sostituito e prende
fantavoto 5,5.

### Sostituzioni

- Scattano quando un titolare non prende voto
- Sono **illimitate**
- Entrano nell'ordine in cui la panchina è schierata
- **Ruolo per ruolo**: se esce un difensore entra un difensore

I "politici" (voti d'ufficio, di norma 6, quando la partita non si gioca per
cause di forza maggiore) contano come voti validi.

---

## 4. Modificatore difesa — NON ESISTE

*Fonte: Polibio, verificato il 10 settembre 2026*

È la differenza che pesa di più. A Fantalissandria il modificatore era
"la regola che più distingue quella lega": dava fino a +3 a giornata sulla
media di portiere più i tre migliori difensori, calcolata sul **voto puro**.

Qui non c'è. Conseguenze diverse da un semplice "un bonus in meno" —
vedi §10.

---

## 5. Capitano — NON ESISTE

*Fonte: Polibio, 10 settembre 2026*

Nessuna designazione, nessun bonus o malus.

---

## 6. Conversione in gol

*Fonte: Polibio — identica a Fantalissandria*

- **66 punti** → 1 gol
- **71 punti** → 2 gol
- poi **ogni 5 punti** → 1 gol in più

Con 11 titolari da 6 si arriva esattamente a 66, cioè un gol.

---

## 7. Formato del campionato

*Fonte: Polibio — identico a Fantalissandria*

**Scontri diretti** fra squadre.

---

## 8. Meccanica dell'asta

*Fonte: Polibio, 10 settembre 2026*

Identica a Fantalissandria in tutto **tranne il turno di chiamata**.

- L'asta procede **per reparto in sequenza**: prima tutti i portieri,
  poi i difensori, poi i centrocampisti, poi gli attaccanti
- Si passa al reparto successivo solo quando **tutte e 8 le squadre**
  hanno completato quello in corso
- Chi chiama apre quasi sempre **a 1 credito**
- Il **rilancio è libero**: non segue nessun ordine
- Nessun tetto massimo per singolo giocatore, nessuna spesa minima per
  reparto. L'unico vincolo è comprare esattamente 25 giocatori nella
  composizione 3/8/8/6
- Registro gli acquisti di **tutte e 8 le squadre**

### LA DIFFERENZA: il turno di chiamata

A Fantalissandria l'ordine di chiamata è **prestabilito e fisso**: il turno
avanza di una posizione rispetto a **chi ha chiamato**, e chi si aggiudica il
giocatore è irrilevante.

Qui il turno avanza di una posizione rispetto a **chi ha comprato**. Il
prossimo a chiamare è il fantallenatore che, nell'ordine estratto, viene
subito dopo chi si è appena aggiudicato il giocatore.

Solo la prima chiamata in assoluto si sorteggia. *(Polibio: trascurabile ai
fini dell'app — la prima chiamata di ogni reparto può non essere indicata.)*

**Conseguenza tattica**, non regola: qui aggiudicarsi un giocatore ha un
costo in più, perché si cede la chiamata al proprio vicino d'ordine. Chi
compra molto passa sistematicamente il turno alla stessa squadra.

---

## 9. Ripartizione del budget — Laudantes

*Fonte: `suddivisione_budget_a_8_senza_modificatore_BY_LAUDANTES.xlsx`,
foglio "BASI SQUADRE (SOLO CLASSIC)"*

Tabella per **8 squadre senza modificatore**. È il formato esatto di questa
lega quanto a regole, ma è espressa **su base 500**: qui si parte da ~400-443,
quindi le percentuali valgono, le cifre assolute vanno riproporzionate sul
budget della propria squadra. Per MARCHINHOS (418 crediti) i valori
diventano: POR ~26, DIF ~46, CEN ~100, ATT ~246.

| Reparto | Crediti | % |
|---|---|---|
| POR | 27–35 | 6,2% |
| DIF | **50–60** | **11,0%** |
| CEN | 120 (max) | 24,0% |
| ATT | **285–303** | **58,8%** |

### Confronto con la tabella col modificatore (Fantalissandria)

| | con mod. | senza mod. | differenza |
|---|---|---|---|
| POR | 27–35 | 27–35 | 0 |
| DIF | 70–75 | 50–60 | **−18** |
| CEN | 120 | 120 | 0 |
| ATT | 270–283 | 285–303 | **+18** |

Cambia **solo la difesa**, e di rimbalzo l'attacco: 18 crediti si spostano da
un reparto all'altro. Portieri e centrocampo restano identici. È una misura
indipendente di quanto valga il modificatore, coerente con la stima di
10-25 crediti fatta nel documento di Fantalissandria.

### Prezzi per slot in difesa

Senza modificatore Laudantes prescrive:

`A+ 30` · `A- 10 o A+ 15` · `A- 8` · `B 4-5` ×4 · altri titolari a 1

Rispetto alla versione col modificatore spariscono la riserva dedicata e due
degli A- intermedi, sostituiti da riempitivi di fascia B.

### Centrocampo (invariato)

`A+` · `A-/A+` · `A--` · `A--` · `A` · `B` · `B` · `1` — max 120.

### Attacco

"Dipende dall'asta": ~300 crediti devono avanzare per gli attaccanti.

In fondo al foglio: *"segui sempre l'andamento dell'asta e rimani almeno in
media coi crediti altrui"*.

---

## 10. Conseguenze strategiche ricavate dai dati

*Non sono regole: sono conclusioni ricavate dal listone, riportate separate
perché possano essere discusse o smentite.*

### I difensori NON sono tutti uguali — si ribalta la logica di Fantalissandria

A Fantalissandria il modificatore usa il **voto puro**, quindi i difensori
con molti bonus erano sopravvalutati rispetto a quanto rendevano lì, e i
"grigi" con voto alto erano occasioni. **Qui è l'opposto**: conta solo il
fantavoto, e l'apporto di bonus diventa tutto.

Misurando l'apporto come *fantamedia storica meno media voto*, sui difensori
con almeno 15 presenze medie:

| Difensore | apporto/partita | su 38 giornate |
|---|---|---|
| DIMARCO | +0,77 | **+29 punti** |
| BISSECK | +0,42 | +16 punti |
| BREMER | +0,27 | +10 punti |
| PONGRACIC | −0,16 | **−6 punti** |

Fra il migliore e il peggiore ballano **~35 punti stagione a parità di voto**.
Nella 1996 quella differenza si paga tutta.

### Gli otto `modBargain` del listone qui non valgono nulla di speciale

Il campo `modBargain` segnala le occasioni **del modificatore**, calcolato
sulle regole di Fantalissandria. Apporto bonus dei difensori segnalati:
Carlos Augusto +0,17, Spinazzola +0,26, Vasquez +0,07, Tavares N. +0,06,
Dodò +0,03, Pavard −0,05. Voto alto, bonus quasi nulli: il profilo perfetto
col modificatore, un difensore qualunque senza.

**In questa lega `modBargain` va ignorato.** Stesso discorso per
`modMediaVoto`, `modLabel`, `modAffidabilita`, `modPresenzeTotali` e per il
campo `maxPriceLega`, che è un tetto **già corretto per il modificatore** e
qui va riportato al prezzo base (`pfc`).

### I portieri perdono il loro unico bonus

Senza imbattibilità restano il rigore parato (raro) e il gol subito (−1).
I due portieri fra i `modBargain` hanno apporto bonus −1,33 (Falcone) e
−1,21 (Caprile): bilancio in perdita.

Nota: Laudantes tiene comunque il budget portieri invariato a 27-35 crediti.
Il valore si sposta dal premiare il clean sheet all'evitare i gol subiti,
quindi un portiere di una difesa solida vale ancora — per una ragione
diversa.

### I difensori sui piazzati diventano interessanti

Senza modificatore il bonus da fermo è uno dei pochi modi in cui un difensore
economico produce punti:

| Difensore | rigori | punizioni | prezzo |
|---|---|---|---|
| MINA | 70% | — | 2,6 |
| GALLO | — | 60% | 1,5 |
| VALERI | 20% | 20% | 4,75 |
| CAMBIASO | — | 30% | 7,6 |
| DIMARCO | — | 30% | 61,1 |

*(`penaltyProbability` è la quota di rigori della squadra che quel giocatore
calcerebbe, non la percentuale di realizzazione — vedi `mappa_dati_players.md`.)*

### Cosa serve nell'agente

Serve il **gemello rovesciato di `modBargain`**: un indicatore di apporto
bonus che segnali i difensori con scarto fantamedia/voto alto e prezzo basso,
tenendo conto dei piazzati. Oggi `convenienza()` cattura i bonus in modo
implicito (usa la fantamedia) ma non esiste nulla che li metta in evidenza.

### Effetti degli scontri diretti

Il formato e le soglie gol sono identici a Fantalissandria, quindi valgono
le stesse conclusioni: il sistema **premia la varianza**, perché sotto i 66
punti si prende zero comunque e sopra si guadagna un gol ogni cinque punti.
Se la rosa è sotto la media conviene rischiare concentrando i crediti su
pochi fuoriclasse; se è la più forte conviene livellare.

---

## 11. Punti ancora aperti

1. **Verbali delle aste passate**: in arrivo. Senza, i profili degli
   avversari partono vuoti e si costruiscono con le note durante l'asta —
   funziona, ma si perde il vantaggio che a Fantalissandria derivava dallo
   storico.
2. Ordine di estrazione delle chiamate: si conoscerà solo al momento.
3. **Minimi di panchina** con la rosa da 24 e 7 difensori: i valori riportati
   in §2 sono quelli di Fantalissandria e vanno confermati.

---

*Documento gemello: `regole_lega_polibio.md` (Fantalissandria).
Il listone `players_data.js` è condiviso fra le due leghe: è tarato sulle
regole di Fantalissandria solo nei campi `maxPriceLega`, `leagueAdjust`,
`leagueAdjustNote` e nella famiglia `mod*`, che qui non vanno usati.*
