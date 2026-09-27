// Regnskabet i analyseform: de poster, der skal til for at beregne alle 28 nøgletal.
// En almindelig post får sin værdi fra de af regnskabets poster, den studerende
// har placeret på den. "derived" = beregnes automatisk ud fra de andre poster.

export const SECTIONS = [
  { id: 'resultat', title: 'Resultatopgørelse i analyseform' },
  { id: 'aktiver', title: 'Balance – aktiver (ultimo)' },
  { id: 'passiver', title: 'Balance – passiver (ultimo)' },
  { id: 'ovrigt', title: 'Pengestrøm og aktieoplysninger' }
]

export const FIELDS = [
  // --- Resultatopgørelse ---
  { key: 'omsaetning', label: 'Nettoomsætning', section: 'resultat' },
  { key: 'vareforbrug', label: 'Vareforbrug / produktionsomkostninger', section: 'resultat' },
  { key: 'bruttoresultat', label: 'Bruttoresultat (bruttofortjeneste)', section: 'resultat', derived: 'omsaetning - vareforbrug' },
  { key: 'personaleomkostninger', label: 'Personaleomkostninger', section: 'resultat' },
  { key: 'andreEksterne', label: 'Andre eksterne kapacitetsomkostninger', section: 'resultat' },
  { key: 'afskrivninger', label: 'Af- og nedskrivninger', section: 'resultat' },
  { key: 'kapacitetsomkostninger', label: 'Kapacitetsomkostninger i alt', section: 'resultat', derived: 'personale + andre eksterne + afskrivninger' },
  { key: 'resultatPrimaerDrift', label: 'Resultat af primær drift (EBIT)', section: 'resultat', derived: 'bruttoresultat - kapacitetsomkostninger' },
  { key: 'finansielleIndtaegter', label: 'Finansielle indtægter', section: 'resultat' },
  { key: 'finansielleOmkostninger', label: 'Finansielle omkostninger', section: 'resultat' },
  { key: 'resultatFoerSkat', label: 'Resultat før skat', section: 'resultat', derived: 'EBIT + fin. indtægter - fin. omkostninger' },
  { key: 'skat', label: 'Skat af årets resultat', section: 'resultat' },
  { key: 'aaretsResultat', label: 'Årets resultat', section: 'resultat', derived: 'resultat før skat - skat' },

  // --- Aktiver ---
  { key: 'immaterielleAnlaeg', label: 'Immaterielle anlægsaktiver', section: 'aktiver' },
  { key: 'materielleAnlaeg', label: 'Materielle anlægsaktiver', section: 'aktiver' },
  { key: 'finansielleAnlaeg', label: 'Finansielle anlægsaktiver', section: 'aktiver' },
  { key: 'anlaegsaktiver', label: 'Anlægsaktiver i alt', section: 'aktiver', derived: 'immaterielle + materielle + finansielle' },
  { key: 'varelager', label: 'Varebeholdninger', section: 'aktiver' },
  { key: 'varedebitorer', label: 'Tilgodehavender fra salg (varedebitorer)', section: 'aktiver' },
  { key: 'andreTilgodehavender', label: 'Andre tilgodehavender', section: 'aktiver' },
  { key: 'likvider', label: 'Likvide beholdninger', section: 'aktiver' },
  { key: 'omsaetningsaktiver', label: 'Omsætningsaktiver i alt', section: 'aktiver', derived: 'varelager + debitorer + andre tilgodeh. + likvider' },
  { key: 'aktiverIAlt', label: 'Aktiver i alt (balancesum)', section: 'aktiver', derived: 'anlægsaktiver + omsætningsaktiver' },

  // --- Passiver ---
  { key: 'egenkapital', label: 'Egenkapital', section: 'passiver' },
  { key: 'hensatteForpligtelser', label: 'Hensatte forpligtelser', section: 'passiver' },
  { key: 'langfristetGaeld', label: 'Langfristede gældsforpligtelser', section: 'passiver' },
  { key: 'leverandoergaeld', label: 'Leverandørgæld (varekreditorer)', section: 'passiver' },
  { key: 'andenKortfristetGaeld', label: 'Anden kortfristet gæld', section: 'passiver' },
  { key: 'kortfristetGaeld', label: 'Kortfristede gældsforpligtelser i alt', section: 'passiver', derived: 'leverandørgæld + anden kortfristet gæld' },
  { key: 'passiverIAlt', label: 'Passiver i alt', section: 'passiver', derived: 'egenkapital + hensatte + langfristet + kortfristet' },

  // --- Øvrigt ---
  { key: 'pengestroemPrimaerDrift', label: 'Pengestrøm fra primær drift', section: 'ovrigt' },
  { key: 'antalAktier', label: 'Antal aktier (stk.)', section: 'ovrigt', unit: 'stk' },
  { key: 'boerskurs', label: 'Børskurs (kr. pr. aktie)', section: 'ovrigt', unit: 'kr' }
]

export const FIELD_MAP = Object.fromEntries(FIELDS.map(f => [f.key, f]))

// Afsnittene i det indlæste regnskab, som det står.
export const REGNSKABSAFSNIT = [
  { id: 'resultat', title: 'Resultatopgørelse' },
  { id: 'aktiver', title: 'Balance – aktiver' },
  { id: 'passiver', title: 'Balance – passiver' },
  { id: 'pengestroem', title: 'Pengestrømsopgørelse' }
]

// Hele balancen kan have en primoværdi. Det ældste årsregnskabs
// sammenligningsår leverer den fjerde balancedato, som gennemsnitstallene
// i nøgletal 1, 3, 4, 5 og 6 skal bruge for det første analyseår.
export const PRIMO_FIELDS = FIELDS
  .filter(f => f.section === 'aktiver' || f.section === 'passiver')
  .map(f => f.key)

export function emptyYear (label = '') {
  const values = {}
  FIELDS.forEach(f => { values[f.key] = null })
  return { label, values, poster: {} }
}

export function emptyDataset () {
  return {
    virksomhed: '',
    enhed: '1.000 kr.',
    indeksBasisaar: 0,
    aar: [emptyYear('År 1'), emptyYear('År 2'), emptyYear('År 3')],
    primo: {},
    // Regnskabets egne poster ({ id, label, sektion, erSum }) i regnskabets
    // rækkefølge, deres tal pr. år (aar[i].poster) og i primo, samt hvilken
    // analysepost hver af dem er placeret på (postId -> felt).
    poster: [],
    primoPoster: {},
    placering: {}
  }
}

/**
 * Analysepostens værdi er summen af de af regnskabets poster, der er
 * placeret på den — og tom, når ingen er. Primo tæller kun for balancen.
 */
export function beregnAnalyse (dataset) {
  const kopi = structuredClone(dataset)
  const placering = kopi.placering || {}
  const summer = (tal, felter) => {
    const ud = {}
    felter.forEach(key => { ud[key] = null })
    Object.entries(placering).forEach(([postId, key]) => {
      const v = tal?.[postId]
      if (v == null || !(key in ud)) return
      ud[key] = (ud[key] || 0) + v
    })
    return ud
  }
  const raa = FIELDS.filter(f => !f.derived).map(f => f.key)
  kopi.aar.forEach(y => { y.values = summer(y.poster, raa) })
  kopi.primo = Object.fromEntries(Object.entries(summer(kopi.primoPoster, raa.filter(k => PRIMO_FIELDS.includes(k)))).filter(([, v]) => v != null))
  return kopi
}

/**
 * Analyseformens linjer i ét afsnit til eksport: linjer med et tal i mindst
 * ét år, hver med de af regnskabets poster, der er placeret på den.
 */
export function analyseLinjer (dataset, sektion) {
  const beregnet = dataset.aar.map(y => withDerived(y.values))
  return FIELDS
    .filter(f => f.section === sektion && beregnet.some(v => v[f.key] != null))
    .map(felt => ({ felt, placerede: felt.derived ? [] : (dataset.poster || []).filter(p => dataset.placering?.[p.id] === felt.key) }))
}

/** Placerer en af regnskabets poster på en analysepost (eller fjerner den med null). */
export function placerPost (dataset, postId, key) {
  const placering = { ...(dataset.placering || {}) }
  if (key) placering[postId] = key
  else delete placering[postId]
  return beregnAnalyse({ ...dataset, placering })
}

// Afledte poster udfyldes kun, hvor der ikke allerede står et tal.
export function withDerived (values) {
  const v = { ...values }
  const har = k => v[k] !== null && v[k] !== undefined && !Number.isNaN(v[k])
  const udfyld = (k, fn) => {
    if (har(k)) return
    const r = fn()
    if (r !== null && r !== undefined && !Number.isNaN(r)) v[k] = r
  }
  const sum = (...keys) => {
    const fundne = keys.filter(har)
    if (!fundne.length) return null
    return fundne.reduce((a, k) => a + v[k], 0)
  }

  udfyld('bruttoresultat', () => (har('omsaetning') && har('vareforbrug') ? v.omsaetning - v.vareforbrug : null))
  udfyld('kapacitetsomkostninger', () => sum('personaleomkostninger', 'andreEksterne', 'afskrivninger'))
  udfyld('resultatPrimaerDrift', () => (har('bruttoresultat') && har('kapacitetsomkostninger') ? v.bruttoresultat - v.kapacitetsomkostninger : null))
  udfyld('anlaegsaktiver', () => sum('immaterielleAnlaeg', 'materielleAnlaeg', 'finansielleAnlaeg'))
  udfyld('omsaetningsaktiver', () => sum('varelager', 'varedebitorer', 'andreTilgodehavender', 'likvider'))
  udfyld('aktiverIAlt', () => (har('anlaegsaktiver') && har('omsaetningsaktiver') ? v.anlaegsaktiver + v.omsaetningsaktiver : null))
  udfyld('kortfristetGaeld', () => sum('leverandoergaeld', 'andenKortfristetGaeld'))
  udfyld('passiverIAlt', () => sum('egenkapital', 'hensatteForpligtelser', 'langfristetGaeld', 'kortfristetGaeld'))
  udfyld('resultatFoerSkat', () => (har('resultatPrimaerDrift')
    ? v.resultatPrimaerDrift + (v.finansielleIndtaegter || 0) - (v.finansielleOmkostninger || 0)
    : null))
  udfyld('aaretsResultat', () => (har('resultatFoerSkat') ? v.resultatFoerSkat - (v.skat || 0) : null))
  return v
}

// Slår en liste af årstal ("2023", "2024", "2025") sammen til "2023-2025",
// eller "2023 og 2024" / "2023, 2024 og 2025", når de ikke er årstal eller
// ikke er fortløbende — så samme besked for flere år ikke gentages ordret.
function formatAarListe (labels) {
  if (labels.length === 1) return labels[0]
  const erAarstal = labels.every(l => /^\d{4}$/.test(l))
  if (erAarstal) {
    const tal = labels.map(Number)
    const fortloebende = tal.every((t, i) => i === 0 || t === tal[i - 1] + 1)
    if (fortloebende) return `${tal[0]}-${tal[tal.length - 1]}`
  }
  return labels.slice(0, -1).join(', ') + ' og ' + labels[labels.length - 1]
}

// Kontroller, der fanger typiske fejl i omformningen.
// Samme besked for flere år (fx samme post mangler hvert år) slås sammen
// til én, i stedet for at gentages ordret for hvert enkelt år.
export function validate (dataset) {
  const raa = []
  dataset.aar.forEach((y, i) => {
    const v = withDerived(y.values)
    const label = y.label || `År ${i + 1}`
    const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.005)
    if (v.aktiverIAlt != null && v.passiverIAlt != null && !near(v.aktiverIAlt, v.passiverIAlt)) {
      raa.push({ level: 'error', year: label, text: `Balancen stemmer ikke: aktiver ${fmt(v.aktiverIAlt)} mod passiver ${fmt(v.passiverIAlt)}.` })
    }
    if (v.kapacitetsomkostninger != null && v.kapacitetsomkostninger < 0) {
      raa.push({ level: 'warn', year: label, text: 'Kapacitetsomkostninger er negative. Kontrollér, at der ikke er placeret en indtægt blandt omkostningerne.' })
    }
  })

  const grupper = new Map()
  raa.forEach(n => {
    const key = n.level + '|' + n.text
    if (!grupper.has(key)) grupper.set(key, { level: n.level, text: n.text, years: [] })
    grupper.get(key).years.push(n.year)
  })
  return [...grupper.values()].map(g => ({ level: g.level, year: formatAarListe(g.years), text: g.text }))
}

function fmt (n) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n)
}
