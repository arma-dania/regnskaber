// Proxy til iXBRL-dokumenter. Browseren må ikke hente dem direkte,
// fordi de offentlige regnskabsservere ikke sender CORS-headere.
const TILLADTE_VAERTER = [
  'regnskaber.virk.dk',
  'datacvr.virk.dk',
  'distribution.virk.dk',
  'cvrapi.dk',
  'erst.dk'
]

export default async (request) => {
  const url = new URL(request.url).searchParams.get('url')
  if (!url) return svar('Angiv en adresse i url-parameteren.', 400)

  let maal
  try { maal = new URL(url) } catch { return svar('Adressen kan ikke læses.', 400) }
  if (!['http:', 'https:'].includes(maal.protocol)) return svar('Kun http og https er tilladt.', 400)

  const frit = process.env.TILLAD_ALLE_VAERTER === 'true'
  const kendt = TILLADTE_VAERTER.some(v => maal.hostname === v || maal.hostname.endsWith('.' + v))
  if (!frit && !kendt) {
    return svar(`Værten ${maal.hostname} er ikke på listen. Tilføj den i netlify/functions/ixbrl.js, eller sæt TILLAD_ALLE_VAERTER=true.`, 403)
  }

  try {
    const r = await fetch(maal.href, {
      headers: { 'User-Agent': 'Regnskabsanalyse/1.0', Accept: 'application/xhtml+xml,text/html,application/xml;q=0.9,*/*;q=0.8' },
      redirect: 'follow'
    })
    if (!r.ok) return svar(`Kilden svarede med ${r.status}.`, 502)
    const tekst = await r.text()
    return new Response(tekst, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (e) {
    return svar('Dokumentet kunne ikke hentes: ' + e.message, 502)
  }
}

function svar (besked, status) {
  return new Response(besked, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } })
}

export const config = { path: '/.netlify/functions/ixbrl' }
