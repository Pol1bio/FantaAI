// Profili storici manager — Lega Fantacalcio 1996 (aste 2023/24-2025/26)
// Generato da Storico_Lega_Fantacalcio_1996.xlsx + tabelle Laudantes.
// Gemello di storico_fantalissandria.js: stessa struttura e metodologia.
const STORICO_MANAGER_1996 = {
 "generato": "2026-09-11",
 "lega": "Lega Fantacalcio 1996",
 "fonte": "Verbali asta 2023-24, 2024-25, 2025-26 (Storico_Lega_Fantacalcio_1996.xlsx)",
 "fonteTier": {
  "2023-24": "Laudantes_2023_24.xlsx, foglio TIERS (fasce sulle colonne)",
  "2024-25": "Laudantes_2024_25_tier.xlsx, fogli per reparto (fasce sulle righe)",
  "2025-26": "TABELLE_2025_2026_laudantes_new.xlsx, foglio TABELLE COMPLETE"
 },
 "noteMetodo": "Quote per ruolo e concentrazione pesate per recenza (peso 1/2/3 per 2023-24/2024-25/2025-26). Le stagioni mancanti per un manager sono escluse dalla media, non contate come zero. Rosa di 24 giocatori (3 POR, 7 DIF, 8 CEN, 6 ATT): le quote per ruolo NON sono confrontabili una a una con quelle di Fantalissandria, che ha 8 difensori. Il foglio \"2020-21\" del file sorgente e' stato scartato: contiene solo totali crediti, nessun nome.",
 "noteMetodoIndiceTier": "Indice = media geometrica (non aritmetica: i prezzi hanno una coda lunga verso l'alto, la media aritmetica dei rapporti sarebbe distorta in modo sistematico verso il sovrapprezzo per qualunque manager) del rapporto fra prezzo pagato e prezzo mediano di lega per quel tier e ruolo, pesata per recenza. 1.00 = paga il prezzo giusto. Soglia minima 5 osservazioni per cella. I portieri sono esclusi: nelle tabelle Laudantes non hanno fasce numeriche ma slot. Nomi abbinati al tier dell'anno con corrispondenza esatta piu' tollerante (cognome, prefisso, distanza editoriale) per assorbire le storpiature dei verbali.",
 "baselinePrezzoPerTier": {
  "DIF_B-": 2.0,
  "DIF_C-": 3.0,
  "DIF_B+": 6.0,
  "CEN_B": 2.0,
  "CEN_A": 13.0,
  "CEN_B+": 9.0,
  "ATT_S": 137.0,
  "ATT_B": 7.0,
  "ATT_C": 1.0,
  "DIF_A-": 4.0,
  "DIF_C+": 1.0,
  "ATT_A": 71.0,
  "DIF_A": 7.0,
  "DIF_B": 2.0,
  "CEN_A-": 11.0,
  "DIF_A+": 13.0,
  "CEN_C+": 4.0,
  "CEN_A+": 21.5,
  "CEN_A--": 6.5,
  "ATT_A-": 38.0,
  "ATT_A--": 24.0
 },
 "mediaLega": {
  "quotePerRuolo": {
   "P": 7.1,
   "D": 10.6,
   "C": 24.9,
   "A": 57.4
  },
  "concentrazioneTop3": 55.2
 },
 "manager": {
  "ATLETICO JACK": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 394,
     "quotePerRuolo": {
      "P": 7.4,
      "D": 9.4,
      "C": 15.7,
      "A": 67.5
     },
     "top1PctBudget": 28.4,
     "top3PctBudget": 59.4,
     "acquistoPiuCaro": "Scamacca",
     "prezzoPiuCaro": 112
    },
    "2024-25": {
     "totaleSpeso": 367,
     "quotePerRuolo": {
      "P": 9.0,
      "D": 11.7,
      "C": 19.9,
      "A": 59.4
     },
     "top1PctBudget": 33.0,
     "top3PctBudget": 56.4,
     "acquistoPiuCaro": "Vlahovich",
     "prezzoPiuCaro": 121
    },
    "2025-26": {
     "totaleSpeso": 391,
     "quotePerRuolo": {
      "P": 9.2,
      "D": 11.8,
      "C": 33.8,
      "A": 45.3
     },
     "top1PctBudget": 15.3,
     "top3PctBudget": 40.2,
     "acquistoPiuCaro": "ORSOLINI",
     "prezzoPiuCaro": 60
    }
   },
   "quoteMediePesate": {
    "P": 8.8,
    "D": 11.4,
    "C": 26.1,
    "A": 53.7
   },
   "concentrazioneMediaPesata": 48.8,
   "indiceSovrapprezzo": {
    "indice": 1.12,
    "n": 46
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.07,
     "n": 16
    },
    "CEN": {
     "indice": 1.13,
     "n": 13
    },
    "ATT": {
     "indice": 1.17,
     "n": 17
    }
   }
  },
  "BOCA MOMIX": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 392,
     "quotePerRuolo": {
      "P": 7.1,
      "D": 6.1,
      "C": 21.4,
      "A": 65.3
     },
     "top1PctBudget": 34.2,
     "top3PctBudget": 64.0,
     "acquistoPiuCaro": "Leao",
     "prezzoPiuCaro": 134
    },
    "2024-25": {
     "totaleSpeso": 395,
     "quotePerRuolo": {
      "P": 1.3,
      "D": 12.7,
      "C": 19.2,
      "A": 66.8
     },
     "top1PctBudget": 30.1,
     "top3PctBudget": 62.5,
     "acquistoPiuCaro": "Thuram",
     "prezzoPiuCaro": 119
    },
    "2025-26": {
     "totaleSpeso": 400,
     "quotePerRuolo": {
      "P": 7.5,
      "D": 10.5,
      "C": 24.8,
      "A": 57.2
     },
     "top1PctBudget": 32.8,
     "top3PctBudget": 62.3,
     "acquistoPiuCaro": "LAUTARO",
     "prezzoPiuCaro": 131
    }
   },
   "quoteMediePesate": {
    "P": 5.4,
    "D": 10.5,
    "C": 22.4,
    "A": 61.8
   },
   "concentrazioneMediaPesata": 62.6,
   "indiceSovrapprezzo": {
    "indice": 0.73,
    "n": 48
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.79,
     "n": 18
    },
    "CEN": {
     "indice": 0.93,
     "n": 14
    },
    "ATT": {
     "indice": 0.54,
     "n": 16
    }
   }
  },
  "DINAMO BOSH": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 465,
     "quotePerRuolo": {
      "P": 10.1,
      "D": 14.8,
      "C": 18.1,
      "A": 57.0
     },
     "top1PctBudget": 28.6,
     "top3PctBudget": 54.8,
     "acquistoPiuCaro": "Immobile",
     "prezzoPiuCaro": 133
    },
    "2024-25": {
     "totaleSpeso": 379,
     "quotePerRuolo": {
      "P": 6.9,
      "D": 10.6,
      "C": 20.6,
      "A": 62.0
     },
     "top1PctBudget": 39.8,
     "top3PctBudget": 58.8,
     "acquistoPiuCaro": "Dovbyk",
     "prezzoPiuCaro": 151
    },
    "2025-26": {
     "totaleSpeso": 345,
     "quotePerRuolo": {
      "P": 8.1,
      "D": 13.0,
      "C": 27.5,
      "A": 51.3
     },
     "top1PctBudget": 20.6,
     "top3PctBudget": 49.0,
     "acquistoPiuCaro": "ZACCAGNI",
     "prezzoPiuCaro": 71
    }
   },
   "quoteMediePesate": {
    "P": 8.0,
    "D": 12.5,
    "C": 23.6,
    "A": 55.8
   },
   "concentrazioneMediaPesata": 53.2,
   "indiceSovrapprezzo": {
    "indice": 0.84,
    "n": 39
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.91,
     "n": 13
    },
    "CEN": {
     "indice": 0.97,
     "n": 11
    },
    "ATT": {
     "indice": 0.69,
     "n": 15
    }
   }
  },
  "FANTAMACHO": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 412,
     "quotePerRuolo": {
      "P": 3.6,
      "D": 8.3,
      "C": 22.6,
      "A": 65.5
     },
     "top1PctBudget": 33.7,
     "top3PctBudget": 61.4,
     "acquistoPiuCaro": "Osimhen",
     "prezzoPiuCaro": 139
    },
    "2024-25": {
     "totaleSpeso": 399,
     "quotePerRuolo": {
      "P": 6.3,
      "D": 8.5,
      "C": 18.8,
      "A": 66.4
     },
     "top1PctBudget": 23.1,
     "top3PctBudget": 53.1,
     "acquistoPiuCaro": "Morata",
     "prezzoPiuCaro": 92
    },
    "2025-26": {
     "totaleSpeso": 403,
     "quotePerRuolo": {
      "P": 11.2,
      "D": 6.9,
      "C": 24.1,
      "A": 57.8
     },
     "top1PctBudget": 24.3,
     "top3PctBudget": 53.6,
     "acquistoPiuCaro": "FERGUSSON",
     "prezzoPiuCaro": 98
    }
   },
   "quoteMediePesate": {
    "P": 8.3,
    "D": 7.7,
    "C": 22.1,
    "A": 61.9
   },
   "concentrazioneMediaPesata": 54.7,
   "indiceSovrapprezzo": {
    "indice": 1.03,
    "n": 51
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.93,
     "n": 17
    },
    "CEN": {
     "indice": 0.99,
     "n": 18
    },
    "ATT": {
     "indice": 1.2,
     "n": 16
    }
   }
  },
  "MARCHINHOS": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 382,
     "quotePerRuolo": {
      "P": 9.9,
      "D": 5.8,
      "C": 25.1,
      "A": 59.2
     },
     "top1PctBudget": 31.7,
     "top3PctBudget": 67.3,
     "acquistoPiuCaro": "Thuram",
     "prezzoPiuCaro": 121
    },
    "2024-25": {
     "totaleSpeso": 413,
     "quotePerRuolo": {
      "P": 7.0,
      "D": 9.7,
      "C": 20.3,
      "A": 63.0
     },
     "top1PctBudget": 41.4,
     "top3PctBudget": 68.8,
     "acquistoPiuCaro": "Lautaro",
     "prezzoPiuCaro": 171
    },
    "2025-26": {
     "totaleSpeso": 393,
     "quotePerRuolo": {
      "P": 7.4,
      "D": 9.4,
      "C": 31.3,
      "A": 51.9
     },
     "top1PctBudget": 20.6,
     "top3PctBudget": 53.4,
     "acquistoPiuCaro": "VLAHOVLIC",
     "prezzoPiuCaro": 81
    }
   },
   "quoteMediePesate": {
    "P": 7.7,
    "D": 8.9,
    "C": 26.6,
    "A": 56.8
   },
   "concentrazioneMediaPesata": 60.8,
   "indiceSovrapprezzo": {
    "indice": 0.82,
    "n": 44
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.79,
     "n": 20
    },
    "CEN": {
     "indice": 0.8,
     "n": 8
    },
    "ATT": {
     "indice": 0.88,
     "n": 16
    }
   }
  },
  "MOTTENTUS": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 404,
     "quotePerRuolo": {
      "P": 7.4,
      "D": 12.6,
      "C": 23.0,
      "A": 56.9
     },
     "top1PctBudget": 42.1,
     "top3PctBudget": 57.9,
     "acquistoPiuCaro": "Vlahovic",
     "prezzoPiuCaro": 170
    },
    "2024-25": {
     "totaleSpeso": 377,
     "quotePerRuolo": {
      "P": 8.2,
      "D": 14.9,
      "C": 47.7,
      "A": 29.2
     },
     "top1PctBudget": 14.6,
     "top3PctBudget": 35.8,
     "acquistoPiuCaro": "Zaccagni",
     "prezzoPiuCaro": 55
    },
    "2025-26": {
     "totaleSpeso": 366,
     "quotePerRuolo": {
      "P": 8.5,
      "D": 16.9,
      "C": 34.4,
      "A": 40.2
     },
     "top1PctBudget": 32.8,
     "top3PctBudget": 51.6,
     "acquistoPiuCaro": "THURAM",
     "prezzoPiuCaro": 120
    }
   },
   "quoteMediePesate": {
    "P": 8.2,
    "D": 15.5,
    "C": 36.9,
    "A": 39.3
   },
   "concentrazioneMediaPesata": 47.4,
   "indiceSovrapprezzo": {
    "indice": 0.97,
    "n": 47
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.35,
     "n": 18
    },
    "CEN": {
     "indice": 1.63,
     "n": 14
    },
    "ATT": {
     "indice": 0.44,
     "n": 15
    }
   }
  },
  "REAL PIX": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 383,
     "quotePerRuolo": {
      "P": 6.3,
      "D": 4.4,
      "C": 23.8,
      "A": 65.5
     },
     "top1PctBudget": 35.8,
     "top3PctBudget": 71.5,
     "acquistoPiuCaro": "Lautaro",
     "prezzoPiuCaro": 137
    },
    "2024-25": {
     "totaleSpeso": 388,
     "quotePerRuolo": {
      "P": 3.9,
      "D": 9.5,
      "C": 17.3,
      "A": 69.3
     },
     "top1PctBudget": 41.0,
     "top3PctBudget": 62.9,
     "acquistoPiuCaro": "Lukaku",
     "prezzoPiuCaro": 159
    },
    "2025-26": {
     "totaleSpeso": 369,
     "quotePerRuolo": {
      "P": 5.4,
      "D": 10.3,
      "C": 22.8,
      "A": 61.5
     },
     "top1PctBudget": 28.5,
     "top3PctBudget": 59.1,
     "acquistoPiuCaro": "CASTELLANOS",
     "prezzoPiuCaro": 105
    }
   },
   "quoteMediePesate": {
    "P": 5.1,
    "D": 9.1,
    "C": 21.1,
    "A": 64.8
   },
   "concentrazioneMediaPesata": 62.4,
   "indiceSovrapprezzo": {
    "indice": 0.73,
    "n": 40
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.64,
     "n": 16
    },
    "CEN": {
     "indice": 1.32,
     "n": 12
    },
    "ATT": {
     "indice": 0.48,
     "n": 12
    }
   }
  },
  "SPARTA BRAGA": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 405,
     "quotePerRuolo": {
      "P": 2.7,
      "D": 10.1,
      "C": 18.0,
      "A": 69.1
     },
     "top1PctBudget": 18.5,
     "top3PctBudget": 47.4,
     "acquistoPiuCaro": "Kvaratskhelia",
     "prezzoPiuCaro": 75
    },
    "2024-25": {
     "totaleSpeso": 383,
     "quotePerRuolo": {
      "P": 1.6,
      "D": 8.4,
      "C": 19.1,
      "A": 71.0
     },
     "top1PctBudget": 21.7,
     "top3PctBudget": 53.3,
     "acquistoPiuCaro": "Rafa Leao",
     "prezzoPiuCaro": 83
    },
    "2025-26": {
     "totaleSpeso": 390,
     "quotePerRuolo": {
      "P": 9.0,
      "D": 9.7,
      "C": 22.3,
      "A": 59.0
     },
     "top1PctBudget": 26.2,
     "top3PctBudget": 52.3,
     "acquistoPiuCaro": "DAVID",
     "prezzoPiuCaro": 102
    }
   },
   "quoteMediePesate": {
    "P": 5.5,
    "D": 9.3,
    "C": 20.5,
    "A": 64.7
   },
   "concentrazioneMediaPesata": 51.8,
   "indiceSovrapprezzo": {
    "indice": 0.8,
    "n": 45
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.79,
     "n": 18
    },
    "CEN": {
     "indice": 0.71,
     "n": 11
    },
    "ATT": {
     "indice": 0.9,
     "n": 16
    }
   }
  }
 },
 "partecipanti202627": [
  "MARCHINHOS",
  "BOCA MOMIX",
  "ATLETICO JACK",
  "DINAMO BOSH",
  "REAL PIX",
  "MOTTENTUS",
  "SPARTA BRAGA",
  "FANTAMACHO"
 ],
 "budgetIniziali202627": {
  "MARCHINHOS": 418,
  "BOCA MOMIX": 405,
  "ATLETICO JACK": 405,
  "DINAMO BOSH": 443,
  "REAL PIX": 400,
  "MOTTENTUS": 412,
  "SPARTA BRAGA": 401,
  "FANTAMACHO": 406
 },
 "noteBudget": "Budget = 400 crediti base piu' il residuo non speso della stagione precedente, diverso per squadra. Residui riferiti da Polibio l'11 settembre 2026; differiscono da quelli a fine asta 2025-26 nel foglio storico perche' il mercato di riparazione li ha modificati. Da confermare prima del primo acquisto."
};
if (typeof window !== "undefined") window.STORICO_MANAGER_1996 = STORICO_MANAGER_1996;
if (typeof module !== "undefined" && module.exports) module.exports = STORICO_MANAGER_1996;
