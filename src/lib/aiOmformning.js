import { FIELDS, withDerived } from './model.js'

/**
 * Bygger en kortfattet tekstoversigt over regnskabet i analyseform, som
 * sendes med til AI'en, så den kender de faktiske tal og kan give
 * konkrete svar om omformningen.
 */
export function byggRegnskabResume (dataset) {
  const linjer = []
  linjer.push(`Virksomhed: ${dataset.virksomhed || 'ikke angivet'}`)
  linjer.push(`Beløb angivet i: ${dataset.enhed}`)

  dataset.aar.forEach((y, i) => {
    const v = withDerived(y.values, y.manual)
    linjer.push('')
    linjer.push(`${y.label || 'År ' + (i + 1)}:`)
    FIELDS.forEach(f => {
      if (v[f.key] == null) return
      const eksplicit = y.values[f.key] != null
      const noter = []
      if (y.sammensat?.[f.key]) noter.push('sammensat af enkeltposter ved import')
      else if (f.derived && !eksplicit) noter.push('beregnet: ' + f.derived)
      linjer.push(`  ${f.label}: ${v[f.key]}${noter.length ? ' (' + noter.join(', ') + ')' : ''}`)
    })
  })

  return linjer.join('\n')
}

/** Sender chatbeskeder og regnskabets tal til AI-funktionen og returnerer svaret. */
export async function spoergOmOmformning (meddelelser, dataset) {
  const svar = await fetch('/.netlify/functions/ai-omformning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meddelelser, regnskabResume: byggRegnskabResume(dataset) })
  })
  const data = await svar.json().catch(() => ({ fejl: 'Uventet svar fra serveren.' }))
  if (!svar.ok || data.fejl) throw new Error(data.fejl || `Kaldet fejlede (${svar.status}).`)
  return data.svar
}
