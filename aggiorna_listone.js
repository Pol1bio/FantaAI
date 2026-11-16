// Aggiorna il blocco _2627 di players_data.js da un export "Statistiche" di Fantacalcio.it.
// 1) python3 estrai_statistiche.py <file.xlsx> stat.json   (legge il foglio "Tutti")
// 2) node aggiorna_listone.js players_data.js stat.json players_data.js <giornata> "<data>"
// Si ferma se un giocatore non si abbina, se le presenze calano o se il formato cambia.
const fs=require('fs');const [,, inF, statF, outF, giornata, data]=process.argv;
const src=fs.readFileSync(inF,'utf8');
const i=src.indexOf('const PLAYERS_DATA = ['),j=src.indexOf('[',i),k=src.indexOf('];\n\nconst LEAGUE_RULES');
if(i<0||k<0) throw new Error('struttura del file non riconosciuta');
const testa=src.slice(0,i), coda=src.slice(k+1), corpo=src.slice(j,k+1);
const D=JSON.parse(corpo);
// il formato di scrittura deve riprodurre l'originale byte per byte
if(JSON.stringify(D)!==corpo) throw new Error('la riscrittura non riproduce il formato originale');
const S=JSON.parse(fs.readFileSync(statF,'utf8'));
const R={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const idx=new Map(S.map(s=>[norm(s.Nome)+'|'+R[s.R],s]));
const n=v=>{const x=Number(v);if(!isFinite(x))throw new Error('valore non numerico: '+v);return x};
let agg=0; const scarti=[];
D.forEach(p=>{const s=idx.get(norm(p.name)+'|'+p.role);if(!s)throw new Error('non abbinato: '+p.name);
  if(n(s.Pv)<p.pv_2627)throw new Error('presenze in calo: '+p.name);
  // verifica: Fm deve tornare da Mv e dagli eventi (stessa formula del listone)
  if(n(s.Pv)>0){const prm=p.role==='POR'?-n(s.Gs):0;
    const calc=n(s.Mv)+(3*n(s.Gf)+prm+3*n(s.Rp)-3*n(s['R-'])+n(s.Ass)-0.5*n(s.Amm)-n(s.Esp)-2*n(s.Au))/n(s.Pv);
    if(Math.abs(calc-n(s.Fm))>0.011) scarti.push(p.name+' fm '+s.Fm+' calc '+calc.toFixed(2));}
  Object.assign(p,{team_2627:s.Squadra,pv_2627:n(s.Pv),mv_2627:n(s.Mv),fm_2627:n(s.Fm),gf_2627:n(s.Gf),gs_2627:n(s.Gs),
    rp_2627:n(s.Rp),ass_2627:n(s.Ass),amm_2627:n(s.Amm),esp_2627:n(s.Esp),au_2627:n(s.Au)});agg++;});

const righe=testa.split('\n');
const nuovaTesta=testa.replace(/\/\/ aggiornate all'[^\n]*\n/, "// aggiornate al "+data+", dati reali a fine "+giornata+"a giornata di campionato 2026/27.\n");
if(nuovaTesta===testa) throw new Error('intestazione non aggiornata');
fs.writeFileSync(outF,nuovaTesta+'const PLAYERS_DATA = '+JSON.stringify(D)+coda);
console.log('aggiornati',agg,'giocatori; scarti di controllo sulla fantamedia:',scarti.length,scarti.slice(0,8));
console.log('pv max',Math.max(...D.map(p=>p.pv_2627)),'| con almeno una presenza',D.filter(p=>p.pv_2627>0).length,'| con 11',D.filter(p=>p.pv_2627===11).length);
