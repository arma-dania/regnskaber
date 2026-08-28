// Proxy til en AI-dialog om omformningen af regnskabet til analyseform.
// Kræver en Anthropic API-nøgle, sat som ANTHROPIC_API_KEY i Netlify.
// Nøglen oprettes på console.anthropic.com. Uden nøgle svarer funktionen med
// en forklarende fejl i stedet for at fejle uforståeligt.
const MODEL = 'claude-sonnet-5'
const MAX_BESKEDER = 40
const MAX_TEGN_PR_BESKED = 4000
const MAX_RESUME_TEGN = 6000

export default async (request) => {
  if (request.method !== 'POST') return svar({ fejl: 'Kun POST er tilladt.' }, 405)

  if (!process.env.ANTHROPIC_API_KEY) {
    return svar({
      fejl: 'AI-dialogen kræver en API-nøgle. Sæt ANTHROPIC_API_KEY som miljøvariabel i ' +
        'Netlify — nøglen oprettes på console.anthropic.com.'
    }, 501)
  }

  let krop
  try { krop = await request.json() } catch { return svar({ fejl: 'Forespørgslen kunne ikke læses.' }, 400) }

  const raaMeddelelser = Array.isArray(krop?.meddelelser) ? krop.meddelelser.slice(-MAX_BESKEDER) : []
  if (!raaMeddelelser.length) return svar({ fejl: 'Ingen besked at sende.' }, 400)

  const messages = raaMeddelelser
    .map(m => ({ role: m?.rolle === 'ai' ? 'assistant' : 'user', content: String(m?.tekst || '').slice(0, MAX_TEGN_PR_BESKED) }))
    .filter(m => m.content.trim())

  if (!messages.length) return svar({ fejl: 'Ingen besked at sende.' }, 400)

  const resume = String(krop?.regnskabResume || '').slice(0, MAX_RESUME_TEGN)

  const system = 'Du hjælper en bruger med at vurdere omformningen af et dansk årsregnskab til ' +
    'en analyseform (en standardiseret opstilling til beregning af nøgletal, jf. den klassiske ' +
    'danske regnskabsanalyse-model). Du kender regnskabets tal, som de aktuelt står i skemaet — ' +
    'de er listet herunder. Vær kortfattet og konkret: pege på hvilke poster der eventuelt bør ' +
    'flyttes, lægges sammen eller adskilles, og hvorfor. Du kan ikke selv ændre tallene i appen; ' +
    'foreslå ændringer i almindelig tekst, som brugeren selv indtaster i skemaet ovenfor. Svar på ' +
    'dansk, medmindre brugeren skriver på et andet sprog.\n\nRegnskabets tal i analyseformen:\n' + resume

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, messages })
    })
    if (!r.ok) {
      const uddrag = (await r.text()).slice(0, 300)
      return svar({
        fejl: `AI-tjenesten svarede ${r.status}.` +
          (r.status === 401 ? ' Tjek at ANTHROPIC_API_KEY er korrekt.' : '') +
          (r.status === 429 ? ' For mange kald lige nu — prøv igen om lidt.' : ''),
        teknisk: uddrag
      }, 502)
    }
    const data = await r.json()
    const tekst = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
    return svar({ svar: tekst || 'Intet svar modtaget fra AI-tjenesten.' }, 200)
  } catch (e) {
    return svar({ fejl: 'Kaldet til AI-tjenesten mislykkedes: ' + e.message }, 502)
  }
}

function svar (objekt, status) {
  return new Response(JSON.stringify(objekt), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
  })
}

export const config = { path: '/.netlify/functions/ai-omformning' }
