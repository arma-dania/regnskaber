// Regnskabet i analyseform: de poster, der skal til for at beregne alle 28 nøgletal.
// "derived" = beregnes automatisk, men kan overskrives manuelt af brugeren.

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

// Hele balancen kan have en primoværdi. Det ældste årsregnskabs
// sammenligningsår leverer den fjerde balancedato, som gennemsnitstallene
// i nøgletal 1, 3, 4, 5 og 6 skal bruge for det første analyseår.
export const PRIMO_FIELDS = FIELDS
  .filter(f => f.section === 'aktiver' || f.section === 'passiver')
  .map(f => f.key)

export function emptyYear (label = '') {
  const values = {}
  FIELDS.forEach(f => { values[f.key] = null })
  return { label, values, manual: {} }
}

export function emptyDataset () {
  return {
    virksomhed: '',
    enhed: '1.000 kr.',
    indeksBasisaar: 0,
    aar: [emptyYear('År 1'), emptyYear('År 2'), emptyYear('År 3')],
    primo: {}
  }
}

// Afledte poster udfyldes kun, hvor der ikke allerede står et tal.
// Et indlæst eller indtastet tal bliver aldrig regnet om — bruttofortjeneste
// i et klasse B-regnskab er fx ikke altid omsætning minus vareforbrug.
// Vil man have posten beregnet, tømmer man feltet.
export function withDerived (values, manual = {}) {
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

// Kontroller, der fanger de typiske fejl efter en automatisk indlæsning.
export function validate (dataset) {
  const notes = []
  dataset.aar.forEach((y, i) => {
    const v = withDerived(y.values, y.manual)
    const label = y.label || `År ${i + 1}`
    const near = (a, b) => Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.005)
    if (v.aktiverIAlt != null && v.passiverIAlt != null && !near(v.aktiverIAlt, v.passiverIAlt)) {
      notes.push({ level: 'error', year: label, text: `Balancen stemmer ikke: aktiver ${fmt(v.aktiverIAlt)} mod passiver ${fmt(v.passiverIAlt)}.` })
    }
    if (v.omsaetning == null && v.bruttoresultat != null) {
      notes.push({ level: 'warn', year: label, text: 'Nettoomsætning mangler. Regnskaber i klasse B viser ofte kun bruttofortjeneste – uden omsætning kan nøgletal 2, 3, 7, 11-19 ikke beregnes.' })
    }
    if (v.kapacitetsomkostninger != null && v.kapacitetsomkostninger < 0) {
      notes.push({ level: 'warn', year: label, text: 'Kapacitetsomkostninger er negative. Indtast omkostninger som positive tal.' })
    }
  })
  return notes
}

function fmt (n) {
  return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n)
}
