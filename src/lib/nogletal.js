import { withDerived, PRIMO_FIELDS } from './model.js'

export const OMRAADER = [
  { id: 'rentabilitet', title: 'Rentabilitetsanalyse', nrs: [1, 2, 3, 4, 5, 6] },
  { id: 'indtjening', title: 'Indtjeningsevne', nrs: [7, 8, 9, 10, 11, 12] },
  { id: 'kapital', title: 'Kapitaltilpasning og pengestrømme', nrs: [13, 14, 15, 16, 17, 18, 19] },
  { id: 'soliditet', title: 'Soliditet og likviditet', nrs: [20, 21, 22, 23, 24] },
  { id: 'boers', title: 'Børsrelaterede nøgletal', nrs: [25, 26, 27, 28] }
]

const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b)

/**
 * Bygger beregningsgrundlaget for ét år.
 * ultimoFoer henter primo-værdier fra sidste års balance – eller fra det
 * indtastede primo-sæt, når det drejer sig om det ældste år.
 */
export function buildContext (dataset, index) {
  const y = dataset.aar[index]
  const v = withDerived(y.values, y.manual)
  const prevYear = index > 0 ? dataset.aar[index - 1] : null
  const prev = prevYear ? withDerived(prevYear.values, prevYear.manual) : null
  const primo = withDerived(dataset.primo || {}, {})

  const ultimoFoer = key => {
    if (prev && prev[key] != null) return prev[key]
    if (index === 0 && PRIMO_FIELDS.includes(key) && primo[key] != null) return primo[key]
    return null
  }

  const gns = key => {
    const b = ultimoFoer(key)
    if (v[key] == null) return null
    return b == null ? v[key] : (v[key] + b) / 2
  }

  const gnsErSkoen = key => ultimoFoer(key) == null && v[key] != null

  const fremmedkapital = u => (u.aktiverIAlt != null && u.egenkapital != null ? u.aktiverIAlt - u.egenkapital : null)
  const fkNu = fremmedkapital(v)
  const fkFoer = (() => {
    const a = ultimoFoer('aktiverIAlt'); const e = ultimoFoer('egenkapital')
    return a != null && e != null ? a - e : null
  })()
  const gnsFremmedkapital = fkNu == null ? null : (fkFoer == null ? fkNu : (fkNu + fkFoer) / 2)

  const renteNetto = (v.finansielleOmkostninger != null || v.finansielleIndtaegter != null)
    ? (v.finansielleOmkostninger || 0) - (v.finansielleIndtaegter || 0)
    : null

  const samledeDriftsomk = (v.vareforbrug != null || v.kapacitetsomkostninger != null)
    ? (v.vareforbrug || 0) + (v.kapacitetsomkostninger || 0)
    : null

  const varekoeb = (() => {
    if (v.vareforbrug == null) return null
    const lagerPrimo = ultimoFoer('varelager')
    if (v.varelager == null || lagerPrimo == null) return v.vareforbrug
    return v.vareforbrug + (v.varelager - lagerPrimo)
  })()

  const bruttomargin = div(v.bruttoresultat, v.omsaetning)
  const nulpunkt = bruttomargin ? div(v.kapacitetsomkostninger, bruttomargin) : null

  return {
    v, prev, index, gns, gnsErSkoen, ultimoFoer,
    gnsFremmedkapital, renteNetto, samledeDriftsomk, varekoeb, nulpunkt,
    basis: (() => {
      const b = dataset.aar[dataset.indeksBasisaar ?? 0]
      return withDerived(b.values, b.manual)
    })(),
    indeksFelt: dataset.indeksFelt || 'omsaetning'
  }
}

/**
 * Alle 28 nøgletal. Hver post returnerer tæller og nævner, så både resultatet
 * og selve udregningen kan vises.
 */
export const NOGLETAL = [
  { nr: 1, omraade: 'rentabilitet', navn: 'Afkastningsgrad', enhed: '%', taeller: 'Resultat af primær drift · 100', naevner: 'Gennemsnitlig balancesum', bedre: 'op',
    forklaring: 'Viser virksomhedens evne til at forrente den investerede kapital. Kan dekomponeres i overskudsgrad og aktivernes omsætningshastighed.',
    calc: c => ({ num: c.v.resultatPrimaerDrift, den: c.gns('aktiverIAlt'), pct: true, skoen: c.gnsErSkoen('aktiverIAlt') }) },

  { nr: 2, omraade: 'rentabilitet', navn: 'Overskudsgrad', enhed: '%', taeller: 'Resultat af primær drift · 100', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser det aktuelle indtægts-/omkostningsforhold, dvs. virksomhedens evne til at tjene penge.',
    calc: c => ({ num: c.v.resultatPrimaerDrift, den: c.v.omsaetning, pct: true }) },

  { nr: 3, omraade: 'rentabilitet', navn: 'Aktivernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Gennemsnitlig balancesum', bedre: 'op',
    forklaring: 'Viser evnen til at tilpasse kapitalens størrelse til aktiviteten i virksomheden.',
    calc: c => ({ num: c.v.omsaetning, den: c.gns('aktiverIAlt'), skoen: c.gnsErSkoen('aktiverIAlt') }) },

  { nr: 4, omraade: 'rentabilitet', navn: 'Egenkapitalens forrentning', enhed: '%', taeller: 'Årets resultat · 100', naevner: 'Gennemsnitlig egenkapital', bedre: 'op',
    forklaring: 'Viser evnen til at forrente den af ejerne indskudte kapital. Kan også beregnes før skat ved at indsætte resultat før skat i tælleren.',
    calc: c => ({ num: c.v.aaretsResultat, den: c.gns('egenkapital'), pct: true, skoen: c.gnsErSkoen('egenkapital') }) },

  { nr: 5, omraade: 'rentabilitet', navn: 'Fremmedkapitalens forrentning', enhed: '%', taeller: 'Renteomkostninger netto · 100', naevner: 'Gennemsnitlig fremmedkapital', bedre: 'ned',
    forklaring: 'Viser virksomhedens gennemsnitlige lånerente af fremmedkapital (gæld).',
    calc: c => ({ num: c.renteNetto, den: c.gnsFremmedkapital, pct: true }) },

  { nr: 6, omraade: 'rentabilitet', navn: 'Finansiel gearing', enhed: 'gange', taeller: 'Gennemsnitlig fremmedkapital', naevner: 'Gennemsnitlig egenkapital', bedre: 'neutral',
    forklaring: 'Viser hvor mange kroner fremmedkapital (gældsforpligtelser), der er pr. krone egenkapital.',
    calc: c => ({ num: c.gnsFremmedkapital, den: c.gns('egenkapital') }) },

  { nr: 7, omraade: 'indtjening', navn: 'Bruttomargin (bruttoavanceprocent)', enhed: '%', taeller: 'Bruttoresultat · 100', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser hvor mange procent af omsætningen, der er tilbage til dækning af kapacitetsomkostninger, renter, skat og overskud. Bruttomargin og bruttoavanceprocent bruges synonymt.',
    calc: c => ({ num: c.v.bruttoresultat, den: c.v.omsaetning, pct: true }) },

  { nr: 8, omraade: 'indtjening', navn: 'Indekstal', enhed: 'indeks', taeller: 'Årets tal · 100', naevner: 'Basisårets tal', bedre: 'op',
    forklaring: 'Indeksberegninger supplerer tallenes udviklingsretning og -hastighed. Vælg selv hvilken post der indekseres.',
    calc: c => ({ num: c.v[c.indeksFelt], den: c.basis[c.indeksFelt], pct: true }) },

  { nr: 9, omraade: 'indtjening', navn: 'Driftsmæssig gearing', enhed: '%', taeller: 'Kapacitetsomkostninger · 100', naevner: 'Samlede driftsomkostninger', bedre: 'neutral',
    forklaring: 'Viser kapacitetsomkostningernes andel af de samlede driftsomkostninger.',
    calc: c => ({ num: c.v.kapacitetsomkostninger, den: c.samledeDriftsomk, pct: true }) },

  { nr: 10, omraade: 'indtjening', navn: 'Kapacitetsgrad', enhed: 'gange', taeller: 'Bruttoresultat', naevner: 'Kapacitetsomkostninger', bedre: 'op',
    forklaring: 'Viser hvor meget hver afholdt krone af kapacitetsomkostninger giver i bruttoresultat – altså hvor stor "overdækning" der er.',
    calc: c => ({ num: c.v.bruttoresultat, den: c.v.kapacitetsomkostninger }) },

  { nr: 11, omraade: 'indtjening', navn: 'Nulpunktsomsætning', enhed: 'beløb', taeller: 'Kapacitetsomkostninger · 100', naevner: 'Bruttomargin', bedre: 'ned',
    forklaring: 'Den omsætning, hvor bruttoresultatet netop dækker kapacitetsomkostningerne.',
    calc: c => ({ num: c.v.kapacitetsomkostninger, den: c.v.omsaetning ? (c.v.bruttoresultat / c.v.omsaetning) : null }) },

  { nr: 12, omraade: 'indtjening', navn: 'Sikkerhedsmargin', enhed: '%', taeller: '(Faktisk omsætning – nulpunktsomsætning) · 100', naevner: 'Faktisk omsætning', bedre: 'op',
    forklaring: 'Viser hvor mange procent omsætningen kan falde, før man befinder sig på nulpunktsomsætningen.',
    calc: c => ({ num: c.nulpunkt == null || c.v.omsaetning == null ? null : c.v.omsaetning - c.nulpunkt, den: c.v.omsaetning, pct: true }) },

  { nr: 13, omraade: 'kapital', navn: 'Anlægsaktivernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Samlede anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser hvor god virksomheden er til at skabe omsætning i forhold til de indsatte anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.anlaegsaktiver }) },

  { nr: 14, omraade: 'kapital', navn: 'Immaterielle anlægsaktivers omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Immaterielle anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser evnen til at skabe omsætning i forhold til de immaterielle anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.immaterielleAnlaeg }) },

  { nr: 15, omraade: 'kapital', navn: 'Materielle anlægsaktivers omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Materielle anlægsaktiver ultimo', bedre: 'op',
    forklaring: 'Viser evnen til at skabe omsætning i forhold til de materielle anlægsaktiver.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.materielleAnlaeg }) },

  { nr: 16, omraade: 'kapital', navn: 'Varelagerets omsætningshastighed', enhed: 'gange', taeller: 'Vareforbrug', naevner: 'Varelagre ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange gange varelageret i gennemsnit omsættes. For funktionsopdelte resultatopgørelser anvendes produktionsomkostninger.',
    calc: c => ({ num: c.v.vareforbrug, den: c.v.varelager }) },

  { nr: 17, omraade: 'kapital', navn: 'Varedebitorernes omsætningshastighed', enhed: 'gange', taeller: 'Omsætning', naevner: 'Varedebitorer ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange gange varedebitorerne i gennemsnit "udskiftes" pr. år.',
    calc: c => ({ num: c.v.omsaetning, den: c.v.varedebitorer }) },

  { nr: 18, omraade: 'kapital', navn: 'Varekreditorernes omsætningshastighed', enhed: 'gange', taeller: 'Varekøb', naevner: 'Leverandørgæld ultimo', bedre: 'ned',
    forklaring: 'Varekøb = vareforbrug + (lager ultimo – lager primo). Viser evnen til at skaffe kredit hos leverandører.',
    calc: c => ({ num: c.varekoeb, den: c.v.leverandoergaeld }) },

  { nr: 19, omraade: 'kapital', navn: 'Pengestrøm fra primær drift / omsætning', enhed: '%', taeller: 'Pengestrøm fra primær drift', naevner: 'Omsætning', bedre: 'op',
    forklaring: 'Viser hvor god virksomheden er til at skabe pengestrømme ud fra omsætningen.',
    calc: c => ({ num: c.v.pengestroemPrimaerDrift, den: c.v.omsaetning, pct: true }) },

  { nr: 20, omraade: 'soliditet', navn: 'Soliditetsgrad', enhed: '%', taeller: 'Egenkapital ultimo · 100', naevner: 'Aktiver i alt ultimo', bedre: 'op',
    forklaring: 'Viser hvor mange procent af aktiverne der kan gå tabt, før kreditorerne lider tab.',
    calc: c => ({ num: c.v.egenkapital, den: c.v.aktiverIAlt, pct: true }) },

  { nr: 21, omraade: 'soliditet', navn: 'Anlægsgrad', enhed: '%', taeller: 'Anlægsaktiver ultimo · 100', naevner: 'Samlede aktiver ultimo', bedre: 'neutral',
    forklaring: 'Viser hvor stor en del af de samlede aktiver der er anlægsaktiver.',
    calc: c => ({ num: c.v.anlaegsaktiver, den: c.v.aktiverIAlt, pct: true }) },

  { nr: 22, omraade: 'soliditet', navn: 'Kapitalbindingsgrad', enhed: 'gange', taeller: 'Anlægsaktiver ultimo', naevner: 'Egenkapital + langfristede forpligtelser ultimo', bedre: 'ned',
    forklaring: 'Viser hvor stor en del anlægsaktiverne udgør af den langfristede kapital.',
    calc: c => ({ num: c.v.anlaegsaktiver, den: c.v.egenkapital == null ? null : c.v.egenkapital + (c.v.langfristetGaeld || 0) }) },

  { nr: 23, omraade: 'soliditet', navn: 'Likviditetsgrad I', enhed: '%', taeller: 'Omsætningsaktiver ekskl. varelager ultimo · 100', naevner: 'Kortfristet gæld ultimo', bedre: 'op',
    forklaring: 'Viser om virksomheden kan betale den gæld tilbage, der forfalder inden for et år. Bør helst være 100 eller derover.',
    calc: c => ({ num: c.v.omsaetningsaktiver == null ? null : c.v.omsaetningsaktiver - (c.v.varelager || 0), den: c.v.kortfristetGaeld, pct: true }) },

  { nr: 24, omraade: 'soliditet', navn: 'Likviditetsgrad II', enhed: '%', taeller: 'Omsætningsaktiver ultimo · 100', naevner: 'Kortfristet gæld ultimo', bedre: 'op',
    forklaring: 'Her indgår hele omsætningsformuen inkl. varelageret i tælleren.',
    calc: c => ({ num: c.v.omsaetningsaktiver, den: c.v.kortfristetGaeld, pct: true }) },

  { nr: 25, omraade: 'boers', navn: 'Resultat pr. aktie', enhed: 'kr', taeller: 'Årets resultat', naevner: 'Antal stk. aktier', bedre: 'op',
    forklaring: 'Viser hvor meget overskud der er til hver enkelt aktie i virksomheden.',
    calc: c => ({ num: c.v.aaretsResultat, den: c.v.antalAktier, skalering: true }) },

  { nr: 26, omraade: 'boers', navn: 'P/E-værdien', enhed: 'gange', taeller: 'Børskurs', naevner: 'Resultat pr. aktie', bedre: 'neutral',
    forklaring: 'Viser hvor meget en investor betaler for 1 kr. resultat.',
    calc: c => ({ num: c.v.boerskurs, den: c.eps }) },

  { nr: 27, omraade: 'boers', navn: 'Indre værdi pr. aktie', enhed: 'kr', taeller: 'Egenkapital', naevner: 'Antal aktier', bedre: 'op',
    forklaring: 'Udtrykker hvor meget egenkapital der er knyttet til 1 stk. aktie.',
    calc: c => ({ num: c.v.egenkapital, den: c.v.antalAktier, skalering: true }) },

  { nr: 28, omraade: 'boers', navn: 'Kurs / indre værdi', enhed: 'gange', taeller: 'Børskurs', naevner: 'Indre værdi', bedre: 'neutral',
    forklaring: 'Viser hvor meget man skal betale for 1 kr. egenkapital. P/E og kurs/indre værdi viser investorernes vurdering af virksomhedens fremtidige værdi.',
    calc: c => ({ num: c.v.boerskurs, den: c.indreVaerdi }) }
]

export const NOGLETAL_MAP = Object.fromEntries(NOGLETAL.map(n => [n.nr, n]))

// Beløb indtastes i fx 1.000 kr., mens aktietal er i kroner og stk.
// skaleringsfaktoren retter resultat/indre værdi pr. aktie op i hele kroner.
function enhedFaktor (enhed) {
  if (/mio/i.test(enhed)) return 1e6
  if (/1\.?000|t\.?kr/i.test(enhed)) return 1000
  return 1
}

export function beregnAar (dataset, index) {
  const c = buildContext(dataset, index)
  const faktor = enhedFaktor(dataset.enhed || '')
  const ud = {}

  // 25 og 27 skal beregnes først, fordi 26 og 28 bygger på dem.
  const rows = [...NOGLETAL].sort((a, b) => {
    const order = n => ([26, 28].includes(n.nr) ? 1 : 0)
    return order(a) - order(b)
  })

  rows.forEach(n => {
    const r = n.calc(c) || {}
    let value = div(r.num, r.den)
    if (value != null) {
      if (r.pct) value *= 100
      if (r.skalering) value *= faktor
    }
    if (n.nr === 25) c.eps = value
    if (n.nr === 27) c.indreVaerdi = value
    ud[n.nr] = {
      nr: n.nr,
      value,
      num: r.num == null ? null : (r.pct ? r.num * 100 : r.num),
      den: r.den,
      skoen: !!r.skoen
    }
  })
  return ud
}

export function beregnAlle (dataset) {
  return dataset.aar.map((_, i) => beregnAar(dataset, i))
}

function kortEnhed (e) {
  if (/1\.000/.test(e)) return 't.kr.'
  if (/mio/.test(e)) return 'mio.'
  return 'kr.'
}

export function formatVaerdi (n, value, enhedstekst = '') {
  if (value == null || !Number.isFinite(value)) return '–'
  const d = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const h = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 })
  switch (n.enhed) {
    case '%': return d.format(value) + ' %'
    case 'gange': return d.format(value) + ' gange'
    case 'indeks': return h.format(value)
    case 'kr': return d.format(value) + ' kr.'
    case 'beløb': return h.format(value) + (enhedstekst ? ' ' + kortEnhed(enhedstekst) : '')
    default: return d.format(value)
  }
}
