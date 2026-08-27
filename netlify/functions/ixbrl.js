// Proxy til iXBRL- og XBRL-dokumenter.
// Browseren må ikke hente dem direkte, fordi Virk ikke sender CORS-headere.
//
// Virks WAF afviser kald uden browserlignende headere med 403. Derfor sendes
// en almindelig browser-User-Agent, og ved afvisning prøves et par varianter,
// før der gives op.
const TILLADTE_VAERTER = [
  'regnskaber.virk.dk',
  'datacvr.virk.dk',
  'distribution.virk.dk',
  'erst.dk',
  'virk.dk'
]

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/xhtml+xml,text/html,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'da-DK,da;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  Referer: 'https://datacvr.virk.dk/',
  'Upgrade-Insecure-Requests': '1'
}

export default async (request) => {
  const params = new URL(request.url).searchParams
  const url = params.get('url')
  const debug = params.get('debug') === '1'
  if (!url) return tekstsvar('Angiv en adresse i url-parameteren.', 400)

  let maal
  try { maal = new URL(url.trim()) } catch { return tekstsvar('Adressen kan ikke læses.', 400) }
  if (!['http:', 'https:'].includes(maal.protocol)) return tekstsvar('Kun http og https er tilladt.', 400)

  const frit = process.env.TILLAD_ALLE_VAERTER === 'true'
  const kendt = TILLADTE_VAERTER.some(v => maal.hostname === v || maal.hostname.endsWith('.' + v))
  if (!frit && !kendt) {
    return tekstsvar(`Værten ${maal.hostname} er ikke på listen. Tilføj den i netlify/functions/ixbrl.js, eller sæt TILLAD_ALLE_VAERTER=true.`, 403)
  }

  // Dokumenterne på regnskaber.virk.dk udstilles over http. Nogle netværk
  // afviser det, andre afviser https — derfor prøves begge.
  const forsoeg = [maal.href]
  if (maal.protocol === 'https:') forsoeg.push(maal.href.replace(/^https:/, 'http:'))
  else forsoeg.push(maal.href.replace(/^http:/, 'https:'))

  const log = []
  for (const adresse of forsoeg) {
    try {
      const r = await fetch(adresse, { headers: BROWSER_HEADERS, redirect: 'follow' })
      const type = r.headers.get('content-type') || ''
      if (r.ok) {
        const tekst = await r.text()
        if (debug) {
          return tekstsvar(`OK ${r.status} · ${type} · ${tekst.length} tegn\n\n${tekst.slice(0, 800)}`, 200)
        }
        if (/text\/html/i.test(type) && !/<ix:|xmlns:ix=/i.test(tekst.slice(0, 4000))) {
          return tekstsvar(
            'Adressen gav en almindelig webside uden XBRL-opmærkning. Det er sandsynligvis ' +
            'en visningsside og ikke selve dokumentet. Find dokumentlinket, der ender på .xml eller .xhtml.', 415)
        }
        return new Response(tekst, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        })
      }
      const uddrag = (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      log.push(`${adresse} → ${r.status} ${type} ${uddrag}`)
    } catch (e) {
      log.push(`${adresse} → ${e.message}`)
    }
  }

  return tekstsvar(forklarFejl(log), 502)
}

function forklarFejl (log) {
  const detaljer = log.join('\n')
  if (/403/.test(detaljer)) {
    return 'Virk afviste kaldet (403). Det sker typisk af to grunde:\n' +
      '1) Adressen peger på en visningsside i stedet for selve dokumentet. ' +
      'Dokumentadresser ser sådan ud: http://regnskaber.virk.dk/12345678/<lang-kode>.xml\n' +
      '2) Adressen er tidsbegrænset eller kræver et opslag først. Prøv at søge ' +
      'regnskabet frem på CVR-nummer i stedet.\n\nTeknisk:\n' + detaljer
  }
  if (/404/.test(detaljer)) return 'Dokumentet findes ikke på adressen (404).\n\nTeknisk:\n' + detaljer
  return 'Dokumentet kunne ikke hentes.\n\nTeknisk:\n' + detaljer
}

function tekstsvar (besked, status) {
  return new Response(besked, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  })
}

export const config = { path: '/.netlify/functions/ixbrl' }
