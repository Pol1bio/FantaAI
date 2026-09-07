// Profili storici manager — Fantalissandria (asta 2023/24-2025/26)
// Generato da storico_fantalissandria.xlsx + tier Laudantes 2023-24/2024-25/2025-26.
// Vedi mappa_dati_players.md per il metodo.
const STORICO_MANAGER = {
 "generato": "2026-09-06",
 "lega": "Fantalissandria",
 "fonte": "Verbali asta 2023-24, 2024-25, 2025-26 (file storico_fantalissandria.xlsx)",
 "noteMetodo": "Quote per ruolo e concentrazione pesate per recenza (peso 1/2/3 per 2023-24/2024-25/2025-26). Le stagioni mancanti per un manager (es. gap di Vittorio nel 2025-26) sono escluse dalla media, non contate come zero. Nomi dei giocatori NON normalizzati contro il listone corrente: turnover di 3 anni di mercato rende il matching diretto inaffidabile per i pezzi pregiati (Leao, Vlahovic e altri big sono usciti dalla A nel frattempo). Questo file serve al PROFILO DI SPESA dei manager, non al prezzo dei singoli giocatori.",
 "mediaLega": {
  "quotePerRuolo": {
   "P": 9.7,
   "D": 15.7,
   "C": 25.3,
   "A": 49.4
  },
  "concentrazioneTop3": 51.7
 },
 "manager": {
  "ANTONIO": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 426,
     "quotePerRuolo": {
      "P": 7.7,
      "D": 4.9,
      "C": 9.9,
      "A": 77.5
     },
     "top1PctBudget": 29.6,
     "top3PctBudget": 58.2,
     "acquistoPiuCaro": "Vlahovic",
     "prezzoPiuCaro": 126
    },
    "2024-25": {
     "totaleSpeso": 495,
     "quotePerRuolo": {
      "P": 10.3,
      "D": 9.5,
      "C": 29.7,
      "A": 50.5
     },
     "top1PctBudget": 31.3,
     "top3PctBudget": 56.8,
     "acquistoPiuCaro": "Vlahovic",
     "prezzoPiuCaro": 155
    },
    "2025-26": {
     "totaleSpeso": 494,
     "quotePerRuolo": {
      "P": 10.1,
      "D": 16.0,
      "C": 24.1,
      "A": 49.8
     },
     "top1PctBudget": 30.2,
     "top3PctBudget": 59.1,
     "acquistoPiuCaro": "Martinez L.",
     "prezzoPiuCaro": 149
    }
   },
   "quoteMediePesate": {
    "P": 9.8,
    "D": 12.0,
    "C": 23.6,
    "A": 54.6
   },
   "concentrazioneMediaPesata": 58.2,
   "indiceSovrapprezzo": {
    "indice": 0.87,
    "n": 44
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.82,
     "n": 15
    },
    "CEN": {
     "indice": 0.54,
     "n": 14
    },
    "ATT": {
     "indice": 1.46,
     "n": 15
    }
   }
  },
  "MATTIA": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25"
   ],
   "numeroStagioni": 2,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 500,
     "quotePerRuolo": {
      "P": 6.0,
      "D": 10.0,
      "C": 9.4,
      "A": 74.6
     },
     "top1PctBudget": 38.0,
     "top3PctBudget": 74.0,
     "acquistoPiuCaro": "Lautaro M.",
     "prezzoPiuCaro": 190
    },
    "2024-25": {
     "totaleSpeso": 499,
     "quotePerRuolo": {
      "P": 8.0,
      "D": 18.6,
      "C": 30.9,
      "A": 42.5
     },
     "top1PctBudget": 18.0,
     "top3PctBudget": 45.1,
     "acquistoPiuCaro": "Retegui",
     "prezzoPiuCaro": 90
    }
   },
   "quoteMediePesate": {
    "P": 7.3,
    "D": 15.7,
    "C": 23.7,
    "A": 53.2
   },
   "concentrazioneMediaPesata": 54.7,
   "indiceSovrapprezzo": {
    "indice": 0.95,
    "n": 33
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.16,
     "n": 14
    },
    "CEN": {
     "indice": 0.9,
     "n": 9
    },
    "ATT": {
     "indice": 0.75,
     "n": 10
    }
   }
  },
  "LORENZO": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 500,
     "quotePerRuolo": {
      "P": 8.8,
      "D": 10.6,
      "C": 13.2,
      "A": 67.4
     },
     "top1PctBudget": 28.0,
     "top3PctBudget": 66.4,
     "acquistoPiuCaro": "Leao",
     "prezzoPiuCaro": 140
    },
    "2024-25": {
     "totaleSpeso": 484,
     "quotePerRuolo": {
      "P": 11.0,
      "D": 21.3,
      "C": 25.8,
      "A": 41.9
     },
     "top1PctBudget": 15.5,
     "top3PctBudget": 43.2,
     "acquistoPiuCaro": "Pulisic",
     "prezzoPiuCaro": 75
    },
    "2025-26": {
     "totaleSpeso": 498,
     "quotePerRuolo": {
      "P": 15.9,
      "D": 27.1,
      "C": 28.1,
      "A": 28.9
     },
     "top1PctBudget": 19.9,
     "top3PctBudget": 46.2,
     "acquistoPiuCaro": "Vlahovic",
     "prezzoPiuCaro": 99
    }
   },
   "quoteMediePesate": {
    "P": 13.1,
    "D": 22.4,
    "C": 24.9,
    "A": 39.6
   },
   "concentrazioneMediaPesata": 48.6,
   "indiceSovrapprezzo": {
    "indice": 0.92,
    "n": 44
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.85,
     "n": 15
    },
    "CEN": {
     "indice": 0.9,
     "n": 15
    },
    "ATT": {
     "indice": 1.05,
     "n": 14
    }
   }
  },
  "VITTORIO": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25"
   ],
   "numeroStagioni": 2,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 482,
     "quotePerRuolo": {
      "P": 9.3,
      "D": 7.5,
      "C": 18.5,
      "A": 64.7
     },
     "top1PctBudget": 19.9,
     "top3PctBudget": 51.5,
     "acquistoPiuCaro": "Berardi",
     "prezzoPiuCaro": 96
    },
    "2024-25": {
     "totaleSpeso": 471,
     "quotePerRuolo": {
      "P": 11.9,
      "D": 21.0,
      "C": 25.3,
      "A": 41.8
     },
     "top1PctBudget": 19.7,
     "top3PctBudget": 45.6,
     "acquistoPiuCaro": "Dovbyk",
     "prezzoPiuCaro": 93
    }
   },
   "quoteMediePesate": {
    "P": 11.0,
    "D": 16.5,
    "C": 23.0,
    "A": 49.4
   },
   "concentrazioneMediaPesata": 47.6,
   "indiceSovrapprezzo": {
    "indice": 1.02,
    "n": 36
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.03,
     "n": 13
    },
    "CEN": {
     "indice": 0.86,
     "n": 12
    },
    "ATT": {
     "indice": 1.21,
     "n": 11
    }
   }
  },
  "IO": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 489,
     "quotePerRuolo": {
      "P": 9.2,
      "D": 15.7,
      "C": 12.5,
      "A": 62.6
     },
     "top1PctBudget": 20.2,
     "top3PctBudget": 50.7,
     "acquistoPiuCaro": "Kvaratskhelia",
     "prezzoPiuCaro": 99
    },
    "2024-25": {
     "totaleSpeso": 466,
     "quotePerRuolo": {
      "P": 5.8,
      "D": 26.6,
      "C": 28.5,
      "A": 39.1
     },
     "top1PctBudget": 32.4,
     "top3PctBudget": 51.9,
     "acquistoPiuCaro": "Thuram",
     "prezzoPiuCaro": 151
    },
    "2025-26": {
     "totaleSpeso": 483,
     "quotePerRuolo": {
      "P": 7.5,
      "D": 23.2,
      "C": 28.4,
      "A": 41.0
     },
     "top1PctBudget": 27.5,
     "top3PctBudget": 44.1,
     "acquistoPiuCaro": "Kean",
     "prezzoPiuCaro": 133
    }
   },
   "quoteMediePesate": {
    "P": 7.2,
    "D": 23.1,
    "C": 25.8,
    "A": 44.0
   },
   "concentrazioneMediaPesata": 47.8,
   "indiceSovrapprezzo": {
    "indice": 1.08,
    "n": 50
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.21,
     "n": 19
    },
    "CEN": {
     "indice": 1.09,
     "n": 17
    },
    "ATT": {
     "indice": 0.92,
     "n": 14
    }
   }
  },
  "ELDI": {
   "stagioniDisponibili": [
    "2023-24",
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 3,
   "perStagione": {
    "2023-24": {
     "totaleSpeso": 433,
     "quotePerRuolo": {
      "P": 9.7,
      "D": 7.4,
      "C": 12.2,
      "A": 70.7
     },
     "top1PctBudget": 48.5,
     "top3PctBudget": 76.2,
     "acquistoPiuCaro": "Oshimen",
     "prezzoPiuCaro": 210
    },
    "2024-25": {
     "totaleSpeso": 496,
     "quotePerRuolo": {
      "P": 8.3,
      "D": 24.0,
      "C": 17.1,
      "A": 50.6
     },
     "top1PctBudget": 18.1,
     "top3PctBudget": 49.0,
     "acquistoPiuCaro": "Leao",
     "prezzoPiuCaro": 90
    },
    "2025-26": {
     "totaleSpeso": 481,
     "quotePerRuolo": {
      "P": 6.0,
      "D": 10.8,
      "C": 25.8,
      "A": 57.4
     },
     "top1PctBudget": 26.4,
     "top3PctBudget": 52.0,
     "acquistoPiuCaro": "Hojlund",
     "prezzoPiuCaro": 127
    }
   },
   "quoteMediePesate": {
    "P": 7.4,
    "D": 14.6,
    "C": 20.6,
    "A": 57.4
   },
   "concentrazioneMediaPesata": 55.0,
   "indiceSovrapprezzo": {
    "indice": 0.92,
    "n": 43
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.88,
     "n": 17
    },
    "CEN": {
     "indice": 0.93,
     "n": 13
    },
    "ATT": {
     "indice": 0.98,
     "n": 13
    }
   }
  },
  "ALESSANDRO": {
   "stagioniDisponibili": [
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 2,
   "perStagione": {
    "2024-25": {
     "totaleSpeso": 499,
     "quotePerRuolo": {
      "P": 8.0,
      "D": 11.4,
      "C": 21.2,
      "A": 59.3
     },
     "top1PctBudget": 40.3,
     "top3PctBudget": 61.7,
     "acquistoPiuCaro": "Martinez L.",
     "prezzoPiuCaro": 201
    },
    "2025-26": {
     "totaleSpeso": 486,
     "quotePerRuolo": {
      "P": 8.6,
      "D": 16.9,
      "C": 19.3,
      "A": 55.1
     },
     "top1PctBudget": 20.4,
     "top3PctBudget": 44.9,
     "acquistoPiuCaro": "Leao",
     "prezzoPiuCaro": 99
    }
   },
   "quoteMediePesate": {
    "P": 8.4,
    "D": 14.7,
    "C": 20.1,
    "A": 56.8
   },
   "concentrazioneMediaPesata": 51.6,
   "indiceSovrapprezzo": {
    "indice": 1.01,
    "n": 33
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.2,
     "n": 14
    },
    "CEN": {
     "indice": 1.24,
     "n": 11
    },
    "ATT": {
     "indice": 0.57,
     "n": 8
    }
   }
  },
  "ANDREA": {
   "stagioniDisponibili": [
    "2024-25",
    "2025-26"
   ],
   "numeroStagioni": 2,
   "perStagione": {
    "2024-25": {
     "totaleSpeso": 484,
     "quotePerRuolo": {
      "P": 5.8,
      "D": 15.7,
      "C": 20.2,
      "A": 58.3
     },
     "top1PctBudget": 27.9,
     "top3PctBudget": 49.8,
     "acquistoPiuCaro": "Lukaku",
     "prezzoPiuCaro": 135
    },
    "2025-26": {
     "totaleSpeso": 499,
     "quotePerRuolo": {
      "P": 4.0,
      "D": 16.6,
      "C": 28.3,
      "A": 51.1
     },
     "top1PctBudget": 31.1,
     "top3PctBudget": 57.3,
     "acquistoPiuCaro": "Thuram",
     "prezzoPiuCaro": 155
    }
   },
   "quoteMediePesate": {
    "P": 4.7,
    "D": 16.2,
    "C": 25.1,
    "A": 54.0
   },
   "concentrazioneMediaPesata": 54.3,
   "indiceSovrapprezzo": {
    "indice": 0.76,
    "n": 36
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 0.83,
     "n": 12
    },
    "CEN": {
     "indice": 0.72,
     "n": 16
    },
    "ATT": {
     "indice": 0.74,
     "n": 8
    }
   }
  },
  "LEO e MARIO": {
   "stagioniDisponibili": [
    "2025-26"
   ],
   "numeroStagioni": 1,
   "perStagione": {
    "2025-26": {
     "totaleSpeso": 478,
     "quotePerRuolo": {
      "P": 11.9,
      "D": 4.0,
      "C": 33.5,
      "A": 50.6
     },
     "top1PctBudget": 27.6,
     "top3PctBudget": 53.8,
     "acquistoPiuCaro": "Castellanos",
     "prezzoPiuCaro": 132
    }
   },
   "quoteMediePesate": {
    "P": 11.9,
    "D": 4.0,
    "C": 33.5,
    "A": 50.6
   },
   "concentrazioneMediaPesata": 53.8,
   "indiceSovrapprezzo": {
    "indice": 1.13,
    "n": 10
   }
  },
  "FRANCESCO e ANDREA": {
   "stagioniDisponibili": [
    "2025-26"
   ],
   "numeroStagioni": 1,
   "perStagione": {
    "2025-26": {
     "totaleSpeso": 498,
     "quotePerRuolo": {
      "P": 15.7,
      "D": 17.9,
      "C": 32.5,
      "A": 33.9
     },
     "top1PctBudget": 20.3,
     "top3PctBudget": 45.2,
     "acquistoPiuCaro": "David",
     "prezzoPiuCaro": 101
    }
   },
   "quoteMediePesate": {
    "P": 15.7,
    "D": 17.9,
    "C": 32.5,
    "A": 33.9
   },
   "concentrazioneMediaPesata": 45.2,
   "indiceSovrapprezzo": {
    "indice": 1.02,
    "n": 12
   },
   "indiceSovrapprezzoPerRuolo": {
    "DIF": {
     "indice": 1.18,
     "n": 6
    }
   }
  }
 },
 "baselinePrezzoPerTier": {
  "DIF_A+": 27.0,
  "DIF_A": 8,
  "DIF_A-": 5.0,
  "DIF_B": 2,
  "DIF_B+": 2,
  "DIF_B-": 3,
  "DIF_C/C-": 1,
  "CEN_A+": 29.5,
  "CEN_A-": 5.0,
  "CEN_A": 16,
  "CEN_B+": 3,
  "CEN_B": 2,
  "ATT_A": 79,
  "ATT_S": 145.0,
  "ATT_B": 6,
  "ATT_C": 2.5,
  "CEN_A/A-": 35.0,
  "CEN_A--": 6,
  "ATT_A-": 27.5
 },
 "noteMetodoIndiceTier": "Indice = media geometrica (non aritmetica: i prezzi hanno una coda lunga verso l'alto, la media aritmetica dei rapporti sarebbe distorta in modo sistematico verso il sovrapprezzo per qualunque manager) del rapporto fra prezzo pagato e prezzo mediano di lega per quel tier e ruolo, pesata per recenza (1/2/3 su 2023-24/2024-25/2025-26). 1.00 = paga il prezzo giusto. Soglia minima 5 osservazioni per cella (altrimenti il dato non e' incluso, troppo rumoroso). Nomi giocatori abbinati al tier Laudantes dell'anno con matching esatto piu' tollerante (token/cognome/distanza editoriale, verificato a mano su ogni match non esatto).",
 "fonteTier": {
  "2023-24": "Laudantes_2023_24.xlsx, foglio TIERS",
  "2024-25": "LAUDANTES_2024_25.pdf (estrazione da layout PDF)",
  "2025-26": "campo tierLaudantes_2526 in players_data.js (copertura parziale: solo giocatori ancora presenti nel listone 2026-27, i big trasferiti allestero nel frattempo non sono coperti per quell anno)"
 },
 "partecipanti202627": [
  "IO",
  "ANTONIO",
  "ELDI",
  "LORENZO",
  "ALESSANDRO",
  "VITTORIO",
  "FRANCESCO e ANDREA",
  "DIDO"
 ],
 "noteParteciapnti": "Gli 8 manager della stagione 2026/27, dalla tabella di continuita'. 7 su 8 hanno uno storico (tutti tranne DIDO, nuovo entrante). 'IO' e' il nome con cui Polibio ha sempre registrato la propria squadra."
};
if (typeof window !== "undefined") window.STORICO_MANAGER = STORICO_MANAGER;
if (typeof module !== "undefined" && module.exports) module.exports = STORICO_MANAGER;
