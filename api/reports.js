// Vercel Serverless Function
// Riceve POST con report e lo registra

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { report, timestamp } = req.body;
    
    if (!report || !timestamp) {
      return res.status(400).json({ error: 'Missing report or timestamp' });
    }

    // Risposta semplice: conferma ricezione
    // I dati effettivi rimangono nel browser (localStorage)
    return res.status(200).json({
      status: 'ok',
      message: 'Report ricevuto su Vercel',
      timestamp,
      note: 'I report vengono salvati nel tuo browser. Apri la dashboard per vederli.'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
