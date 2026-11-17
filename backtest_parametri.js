// Verifica dei parametri della stima (FIDUCIA_K, PESO_STAGIONE_CORRENTE, GIORNATE_PRIOR_TITOLARITA).
// Uso: python3 estrai_statistiche.py <statistiche a 5 giornate.xlsx> stat5.json
//      node backtest_parametri.js players_data.js      (stat5.json nella cartella corrente)
// Stampa l'errore di previsione per ogni taratura provata: vedi mappa_dati_players.md, paragrafo 18.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const i=src.indexOf('const PLAYERS_DATA = ['),j=src.indexOf('[',i),k=src.indexOf('];\n\nconst LEAGUE_RULES');const D=JSON.parse(src.slice(j,k+1));
const S5=JSON.parse(fs.readFileSync('stat5.json','utf8'));const R={P:'POR',D:'DIF',C:'CEN',A:'ATT'};
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const i5=new Map(S5.map(s=>[norm(s.Nome)+'|'+R[s.R],s]));
console.log('file 5 giornate: righe',S5.length,'pv max',Math.max(...S5.map(s=>s.Pv)),'abbinati',D.filter(p=>i5.has(norm(p.name)+'|'+p.role)).length);
const ROLES=['POR','DIF','CEN','ATT'];
const hist=(p,seasons,wRec)=>{let n=0,s=0,nRaw=0;seasons.forEach((a,ix)=>{const pv=p['pv_'+a]||0;if(pv<10)return;const w=(ix===seasons.length-1?wRec:1);n+=w*pv;s+=w*pv*p['fm_'+a];nRaw+=pv});return n?{n:nRaw,nEff:n,fm:s/n}:null};
const q=(xs,f)=>{const a=xs.slice().sort((x,y)=>x-y);return a[Math.floor(a.length*f)]};
function basi(pred,seasons,f){const b={};ROLES.forEach(r=>{const xs=D.filter(p=>p.role===r).map(p=>hist(p,seasons,1)).filter(h=>h&&h.n>=20).map(h=>h.fm);b[r]=f==='media'?xs.reduce((a,c)=>a+c,0)/xs.length:q(xs,f)});return b}
function errore(seasons,target,minT,K,f,forma,wRec){const b=basi(null,seasons,f);let se=0,w=0,n=0;
 D.forEach(p=>{const pv=p['pv_'+target]||0;if(pv<minT)return;const h=hist(p,seasons,wRec);if(!h)return;
  const fid=forma==='rampa'?Math.min(1,h.n/K):h.n/(h.n+K);const pr=b[p.role]+(h.fm-b[p.role])*fid;const e=pr-p['fm_'+target];se+=pv*e*e;w+=pv;n++});return {rmse:Math.sqrt(se/w),n}}
for(const [seasons,target,minT] of [[['2324','2425'],'2526',15],[['2324','2425','2526'],'2627',7]]){
 console.log('\n== A. previsione di',target,'da',seasons.join('+'),'(giocatori:',errore(seasons,target,minT,50,0.25,'rampa',1).n,')');
 for(const f of [0.25,0.5,'media']){console.log(' valore verso cui si tira:',f==='media'?'media':'quantile '+f);
  console.log('   rampa  K:',[10,20,30,50,80,120,200].map(K=>K+'→'+errore(seasons,target,minT,K,f,'rampa',1).rmse.toFixed(4)).join('  '));
  console.log('   n/(n+K):',[5,10,20,30,50,80].map(K=>K+'→'+errore(seasons,target,minT,K,f,'bayes',1).rmse.toFixed(4)).join('  '));}
 console.log(' nessun temperamento:',errore(seasons,target,minT,0.0001,0.25,'rampa',1).rmse.toFixed(4));
 console.log(' B. peso della stagione piu recente (rampa K=50, quartile):',[0.5,1,1.5,2,3,5].map(w=>w+'→'+errore(seasons,target,minT,50,0.25,'rampa',w).rmse.toFixed(4)).join('  '));
 console.log('    idem con n/(n+20), mediana:',[0.5,1,1.5,2,3,5].map(w=>w+'→'+errore(seasons,target,minT,20,0.5,'bayes',w).rmse.toFixed(4)).join('  '));
}
// C. peso della stagione in corso: prime 5 giornate + storico -> giornate 6-11
const b=basi(null,['2324','2425','2526'],0.5);
function errC(w,K,forma,soloNuovi){let se=0,ww=0,n=0;D.forEach(p=>{const s=i5.get(norm(p.name)+'|'+p.role);if(!s)return;const pv5=s.Pv,pvR=p.pv_2627-pv5;if(pvR<4)return;
  const fmR=(p.pv_2627*p.fm_2627-pv5*s.Fm)/pvR;const h=hist(p,['2324','2425','2526'],1);if(soloNuovi&&h)return;if(!h&&!pv5)return;
  const nS=h?h.n:0,tot=nS+w*pv5;if(!tot)return;const fm=((h?nS*h.fm:0)+w*pv5*(pv5?s.Fm:0))/tot;const fid=forma==='rampa'?Math.min(1,tot/K):tot/(tot+K);
  const pr=b[p.role]+(fm-b[p.role])*fid;const e=pr-fmR;se+=pvR*e*e;ww+=pvR;n++});return {rmse:Math.sqrt(se/ww),n}}
console.log('\n== C. giornate 6-11 previste da storico + prime 5 giornate (giocatori:',errC(2,50,'rampa').n,')');
for(const [K,forma] of [[50,'rampa'],[20,'bayes'],[30,'bayes']])console.log('  ',forma,'K='+K,' peso stagione in corso:',[0,0.5,1,2,3,5,8].map(w=>w+'→'+errC(w,K,forma).rmse.toFixed(4)).join('  '));
console.log('   solo senza storico (',errC(2,50,'rampa',true).n,'):',[1,2,3,5].map(w=>w+'→'+errC(w,20,'bayes',true).rmse.toFixed(4)).join('  '),'| rampa50:',[1,2,3,5].map(w=>w+'→'+errC(w,50,'rampa',true).rmse.toFixed(4)).join('  '));
// D. titolarita: attesa (settembre) + prime 5 -> quota presenze giornate 6-11
function errD(Kp){let se=0,n=0;D.forEach(p=>{const s=i5.get(norm(p.name)+'|'+p.role);if(!s)return;const att=(p.expectedTitolarita||0)/100;const oss=Math.min(1,s.Pv/5);const reale=Math.min(1,(p.pv_2627-s.Pv)/6);
  const st=Kp===Infinity?att:(Kp*att+5*oss)/(Kp+5);se+=(st-reale)**2;n++});return Math.sqrt(se/n)}
console.log('\n== D. quota presenze giornate 6-11: peso della previsione di settembre (in giornate):',[0,2,5,10,19,38,Infinity].map(K=>K+'→'+errD(K).toFixed(4)).join('  '));
const bk={};D.forEach(p=>{const kx=Math.min(9,Math.floor((p.expectedTitolarita||0)/10));(bk[kx]=bk[kx]||[]).push(Math.min(1,p.pv_2627/11))});
console.log('   attesa → presenze reali (11 giornate):',Object.keys(bk).map(kx=>kx*10+'-'+(kx*10+9)+'%: '+Math.round(100*bk[kx].reduce((a,c)=>a+c,0)/bk[kx].length)+'% (n='+bk[kx].length+')').join(' | '));
