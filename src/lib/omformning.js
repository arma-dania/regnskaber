import { FIELD_MAP } from './model.js'

// Hvor lille en post højst må være i forhold til sin makker, i hvert år den
// forekommer, for at blive foreslået lagt sammen med den.
const GRAENSE = 0.15

// Kun veletablerede, meningsfulde sammenlægninger foreslås — ikke enhver
// post, der tilfældigvis står ved siden af en anden i skemaet. Begge poster
// i et par skal høre til samme afsnit af analyseformen.
const KANDIDATER = [
  { a: 'varedebitorer', b: 'andreTilgodehavender' },
  { a: 'langfristetGaeld', b: 'hensatteForpligtelser' }
]

/**
 * Foreslår sammenlægning af veletablerede par af poster, når den ene
 * konsekvent er lille i forhold til den anden på tværs af alle år, den
 * forekommer i. Kun et forslag — appen ændrer intet selv, og hvert forslag
 * skal godkendes for sig.
 */
export function foreslaOmformning (dataset) {
  const forslag = []

  KANDIDATER.forEach(({ a: aKey, b: bKey }) => {
    const a = FIELD_MAP[aKey]
    const b = FIELD_MAP[bKey]
    if (!a || !b || a.derived || b.derived || a.section !== b.section) return

    const par = dataset.aar
      .map(y => ({ a: y.values[aKey], b: y.values[bKey] }))
      .filter(p => p.a != null && p.b != null && (p.a !== 0 || p.b !== 0))
    if (par.length < 2) return

    const andele = par.map(p => {
      const stoerst = Math.max(Math.abs(p.a), Math.abs(p.b))
      const mindst = Math.min(Math.abs(p.a), Math.abs(p.b))
      return stoerst === 0 ? 0 : mindst / stoerst
    })
    if (Math.max(...andele) > GRAENSE) return

    const gnsA = par.reduce((s, p) => s + Math.abs(p.a), 0) / par.length
    const gnsB = par.reduce((s, p) => s + Math.abs(p.b), 0) / par.length
    const [kilde, maal] = gnsA <= gnsB ? [a, b] : [b, a]

    forslag.push({
      id: `${kilde.key}->${maal.key}`,
      kildeKey: kilde.key,
      maalKey: maal.key,
      foreslaetNavn: `${maal.label} (inkl. ${kilde.label.toLowerCase()})`,
      begrundelse: `${kilde.label} udgør under ${Math.round(GRAENSE * 100)} % af ${maal.label.toLowerCase()} i hvert af de år, posten forekommer i — kan eventuelt lægges sammen for et renere overblik.`
    })
  })

  return forslag
}
