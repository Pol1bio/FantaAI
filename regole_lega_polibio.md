# Regole — Polibio Fantasy League 2026/27

> Documento di riferimento per tutte le chat del progetto FantaAI.
> Ogni voce è marcata con la sua fonte. Le sezioni 1-6 vengono dal file
> `league_rules_polibio.json`; la sezione 7 da quanto riferito a voce; la
> sezione 9 raccoglie conclusioni ricavate dai dati, non regole.

Regole verificate con Polibio il 6 settembre 2026.

---

## 1. Struttura della lega

*Fonte: `league_rules_polibio.json`*

| | |
|---|---|
| Squadre | 8 |
| Budget per squadra | 500 crediti |
| Giocatori per rosa | 25 |

Composizione obbligatoria della rosa (minimo = massimo, quindi fissa):

| Ruolo | Quantità |
|---|---|
| Portieri | 3 |
| Difensori | 8 |
| Centrocampisti | 8 |
| Attaccanti | 6 |

---

## 2. Schieramento

*Fonte: `league_rules_polibio.json`*

- 11 giocatori in campo, fino a 11 in panchina
- Almeno 1 portiere e almeno 3 difensori fra i titolari
- Nessun minimo per centrocampisti e attaccanti fra i titolari
- Panchina: almeno 1 POR, 3 DIF, 3 CEN, 3 ATT

Moduli consentiti: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1

**Il cambio modulo NON è consentito durante la giornata**: il modulo scelto
in fase di schieramento resta fisso.

*(Il file `league_rules_polibio.json` conteneva `switch: enabled: true`, che era
sbagliato. Corretto il 6 settembre 2026.)*

---

## 3. Punteggio

*Fonte: `league_rules_polibio.json`*

Voto base dalla Gazzetta dello Sport (base 6).

### Bonus e malus

| Evento | Punti |
|---|---|
| Gol segnato | +3 |
| Rigore segnato | +3 |
| Rigore parato | +3 |
| Assist | +1 |
| Assist "gold" | +1 |
| Imbattibilità (clean sheet) | +1 |
| Cartellino giallo | −0,5 |
| Gol subito | −1 |
| Cartellino rosso | −1 |
| Autogol | −2 |
| Rigore sbagliato | −3 |

Valgono zero: gol vittoria, gol su rigore *(voce separata da "rigore segnato" nel file — vedi dubbi in fondo)*, migliore in campo.

### Regola sui senza voto

Chi non prende voto ma viene ammonito non viene sostituito e prende
fantavoto 5,5.

### Sostituzioni

- Scattano quando un titolare non prende voto
- Sono **illimitate**
- Entrano nell'ordine in cui la panchina è schierata
- **Ruolo per ruolo**: se esce un difensore entra un difensore, non un
  giocatore di ruolo diverso

---

## 4. Modificatore difesa

*Fonte: `league_rules_polibio.json`* — **è la regola che più distingue questa lega**

Si applica solo schierando **almeno 4 difensori**.

Il calcolo usa il **voto puro, senza bonus e malus**, sulla media di:
**portiere + i 3 migliori difensori** (il portiere partecipa).

| Media | Bonus |
|---|---|
| sotto 6,00 | 0 |
| da 6,00 a 6,24 | +1 |
| da 6,25 a 6,49 | +1,5 |
| da 6,50 a 6,74 | +2 |
| da 6,75 a 6,99 | +2,5 |
| 7,00 e oltre | +3 |

Condizioni:

- Se dopo le sostituzioni restano **solo 3 difensori in campo, il modificatore
  non si applica affatto** (si perde il bonus intero, non una parte)
- I "politici" contano come voti validi; **non** contano le riserve d'ufficio
  subentrate in difesa.
  *I politici sono voti d'ufficio (di norma 6) assegnati quando la partita non
  si gioca per cause di forza maggiore. Evento imprevedibile: non se ne può
  tenere conto in asta.*

---

## 5. Capitano

*Fonte: `league_rules_polibio.json`*

Designato partita per partita. Bonus in base al voto reale:

| Voto | Bonus |
|---|---|
| ≤ 4,5 | −1,5 |
| 5 | −1 |
| 5,5 | −0,5 |
| 6 | 0 |
| 6,5 | +0,5 |
| 7 | +1 |
| ≥ 7,5 | +1,5 |

Nessun bonus doppio o triplo.

---

## 6. Conversione in gol

*Fonte: `league_rules_polibio.json`*

Il fantavoto totale di squadra diventa gol a soglie:

- **66 punti** → 1 gol
- **71 punti** → 2 gol
- poi **ogni 5 punti** → 1 gol in più

Con 11 titolari da 6 si arriva esattamente a 66, cioè un gol.
Sopra quella soglia ogni punto vale **in media** un quinto di gol: la
conversione è a scalini (un punto conta solo se fa superare una soglia), ma
su una stagione intera gli scalini si compensano.

---

## 7. Meccanica dell'asta

*Fonte: cose che mi hai detto in chat, **non** presenti nel file regole.
Sono quelle da controllare con più attenzione.*

- L'asta procede **per reparto in sequenza**: prima tutti i portieri,
  poi i difensori, poi i centrocampisti, poi gli attaccanti
- Si passa al reparto successivo solo quando **tutte e 8 le squadre**
  hanno completato quello in corso
- L'ordine di chiamata è **estratto a sorte all'inizio** e resta fisso
  per tutta l'asta
- Chi chiama apre quasi sempre **a 1 credito**: il valore tattico sta nel
  *momento* in cui chiami, non nel prezzo di apertura
- Registri gli acquisti di **tutte e 8 le squadre**, non solo i tuoi

---

## 7 bis. Mercato di riparazione

*Fonte: Polibio, a voce. Aggiunto il 16 novembre 2026.*

- Chi **svincola** un proprio giocatore recupera **metà del prezzo** pagato
  in asta se il giocatore resta in Serie A, **l'intero prezzo** se si è
  trasferito in un altro campionato.
- La metà di un prezzo dispari si arrotonda **per eccesso**: 7 crediti ne
  rendono 4.
- Negli **scambi fra squadre sono ammessi anche i crediti**.
- L'app propone il rimborso secondo questa regola e lo lascia correggere.

*(Arrotondamento e crediti negli scambi confermati da Polibio il 16 novembre
2026.)*

---

## 8. Punti chiariti

Erano dubbi, ora risolti (risposte del 6 settembre 2026):

1. **Rigore segnato**: +3 al giocatore che lo segna. La voce `penaltyGoal: 0`
   nel file è da ignorare, vale `scoredPenalty: 3`.
2. **Autogol**: −2 a chi lo commette.
3. **Imbattibilità (+1)**: solo al portiere.
4. **Gol subito (−1)**: solo al portiere.
5. **Politici**: voti d'ufficio (di norma 6) quando la partita non si gioca
   per cause di forza maggiore. Imprevedibile.
6. **Formato campionato**: **scontri diretti** fra squadre.
7. **Sostituzioni**: scattano quando un titolare non prende voto.

8. **Sostituzioni**: illimitate, nell'ordine di schieramento della panchina,
   e sempre ruolo per ruolo.

Nessun punto rimasto aperto.

---

## 9. Conseguenze strategiche che ne ho ricavato

*Non sono regole: sono conclusioni mie, ricavate dai dati. Le riporto
separate perché possano essere discusse o smentite.*

- Il primo scalino del modificatore (media ≥ 6,00) costa pochissimo:
  circa 10-25 crediti fra portiere e tre difensori. Il secondo (≥ 6,25)
  ne costa circa 56. Il terzo è di fatto irraggiungibile con i dati attuali.
- Poiché il modificatore usa il **voto** e non il fantavoto, difensori con
  molti bonus (gol, assist) sono sopravvalutati rispetto a quanto rendono
  qui, e difensori "grigi" ma con voto alto sono occasioni.
- **La fantamedia del listone non contiene l'imbattibilità** *(aggiunto il 16
  novembre 2026)*: ricalcolandola risulta voto meno gol subiti, più rigori
  parati, meno cartellini, senza il +1. In questa lega quel +1 esiste, quindi
  i portieri delle difese solide rendono più di quanto dica il listone:
  stimando le porte inviolate dai gol subiti, Svilar ne ricava circa 15 punti
  a stagione, Falcone circa 9. L'agente ora aggiunge questa stima da solo.
- I portieri non si equivalgono — chi para in una difesa solida subisce meno
  gol e prende più punti — ma il divario di prezzo è sproporzionato al divario
  di resa: il terzo o quarto portiere per fantamedia costa un decimo del primo.
- In attacco il rendimento cala in modo regolare: circa +0,24 di fantamedia
  per ogni raddoppio di prezzo.
- Poiché servono 4 difensori in campo perché il modificatore si applichi,
  la **titolarità conta più della qualità — ma solo per i 4 titolari**.
  Le sostituzioni illimitate e ruolo per ruolo assorbono quasi tutto il
  rischio: con 4 difensori in panchina, anche da 1 credito e riserve nei
  loro club, le giornate senza modificatore scendono dal 17,9% al 9,5%,
  e quel residuo dipende ormai dal portiere. Fra una panchina di riserve
  e una di titolari ballano 1,4 punti stagione per 1,4 crediti: irrilevante.
  **Sui panchinari difensivi si può spendere il minimo assoluto.**

### Effetti degli scontri diretti

Il formato a scontri diretti, combinato con le soglie gol, **premia la
varianza**: sotto i 66 punti prendi zero gol comunque, sopra ne guadagni uno
ogni cinque punti. Le giornate storte non possono costare più di così, quelle
buone salgono senza tetto.

Simulando 38 giornate contro un avversario medio:

| La mia rosa | Rosa costante | Rosa esplosiva |
|---|---|---|
| più debole della media | 30,9 punti | **40,5** |
| pari alla media | 50,3 | **54,1** |
| più forte della media | **82,0** | 75,8 |

Quindi: **se sei sotto la media conviene rischiare**, concentrando i crediti
su pochi fuoriclasse. **Se hai costruito la rosa più forte conviene livellare**,
perché il vantaggio si difende con la costanza.

Il modificatore, quando scatta, vale +1: su una stagione sono **al massimo**
circa 5 punti di classifica, e costa 10-25 crediti. Due precisazioni
*(aggiunte il 16 novembre 2026, la stesura precedente lo chiamava "un +1
fisso ogni giornata")*:

- **non è fisso**: serve la media sopra il 6 e servono 4 difensori in campo.
  Con la panchina giusta le giornate senza modificatore restano comunque
  intorno al 9,5%;
- **il vantaggio è relativo**: quei punti si guadagnano solo contro chi il
  modificatore non lo prende. Se lo prendono tutte e otto le squadre non
  sposta la classifica di nessuno. Va quindi letto come una cosa da **non
  farsi mancare** per pochi crediti, più che come un margine sugli altri.

### Una lettura da non ripetere: "gli A− costano 2,6 volte il listino"

*Aggiunto il 16 novembre 2026.*

Nello storico i difensori A− risultano pagati 2,6 volte il listino, e lo si
era attribuito al modificatore. Il confronto con la Lega 1996, che il
modificatore non ce l'ha, lo smentisce: lì un A− costa 4 crediti su 400, qui
5 su 500 — **la stessa quota**. Su prezzi di listino intorno ai 2 crediti,
con offerte solo intere da 1 in su, bastano un paio di rilanci a raddoppiare.
L'effetto vero del modificatore si vede sugli **A+**: 27 crediti qui contro 13
nella 1996.

---

*Se correggi qualcosa, il file da aggiornare è `league_rules_polibio.json`
dentro `players_data.js`: è da lì che l'agente legge budget, ruoli,
modificatore, bonus/malus e soglie gol.*
