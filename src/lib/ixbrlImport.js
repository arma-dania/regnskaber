// Mapping fra den danske årsrapporttaksonomi (fsa) og fra den engelske
// IFRS-taksonomi (ifrs-full) til analyseformen. Store/børsnoterede selskaber
// aflægger ofte årsrapport efter IFRS med engelske betegnelser i stedet for
// fsa, og de to taksonomier bruger til dels forskellige navne for samme post
// (fx trade receivables). Flere navne kan pege på samme post – det første
// fundne vinder. Navnerummet (fsa: / ifrs-full: / …) er ligegyldigt, da kun
// selve elementnavnet efter kolon bruges til opslag.
const XBRL_MAP = {
  omsaetning: ['Revenue', 'SalesRevenue', 'RevenueFromContractsWithCustomers'],
  vareforbrug: ['CostOfSales', 'RawMaterialsAndConsumablesUsed', 'ProductionCosts', 'CostOfGoodsSold'],
  bruttoresultat: ['GrossProfitLoss', 'GrossResult', 'GrossProfit'],
  personaleomkostninger: ['EmployeeBenefitsExpense', 'StaffCosts'],
  // Findes der ingen samlet post, tagger regnskabet ofte kun de enkeltposter,
  // årsregnskabsloven kræver specifikation af (§98a): løn, pension og andre
  // omkostninger til social sikring, plus evt. "andre personaleomkostninger".
  // De vises som almindelige poster, præcis som i regnskabet — brugeren
  // lægger dem selv sammen med personaleomkostninger i Omform, hvis ønsket.
  personaleomkLoen: ['WagesAndSalaries', 'Salaries', 'WagesSalariesAndRemunerations'],
  personaleomkPension: ['PensionCosts', 'PensionContributions', 'PostemploymentBenefitExpense', 'DefinedContributionPlanCostRecognisedAsExpense'],
  personaleomkSocialSikring: ['OtherSocialSecurityContributions', 'SocialSecurityContributions', 'SocialSecurityCosts'],
  personaleomkAndet: ['OtherEmployeeBenefitsExpense', 'OtherStaffCosts', 'OtherEmployeeExpense', 'OtherPersonnelExpenses'],
  andreEksterne: ['OtherExternalExpenses', 'ExternalExpenses', 'DistributionCosts', 'AdministrativeExpenses', 'AdministrativeExpense', 'OtherOperatingExpense'],
  afskrivninger: ['DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss', 'DepreciationAmortisationExpense', 'DepreciationAndAmortisation', 'DepreciationDepletionAndAmortisationExpense'],
  resultatPrimaerDrift: ['ProfitLossFromOrdinaryOperatingActivities', 'OperatingProfitLoss', 'ProfitLossFromOperatingActivities'],
  finansielleIndtaegter: ['OtherFinanceIncome', 'FinanceIncome', 'FinancialIncome'],
  finansielleOmkostninger: ['OtherFinanceExpenses', 'FinanceCosts', 'FinancialExpenses', 'InterestExpense'],
  resultatFoerSkat: ['ProfitLossFromOrdinaryActivitiesBeforeTax', 'ProfitLossBeforeTax'],
  skat: ['TaxExpense', 'TaxExpenseOnOrdinaryActivities', 'IncomeTaxExpense', 'IncomeTaxExpenseContinuingOperations'],
  aaretsResultat: ['ProfitLoss'],

  immaterielleAnlaeg: ['IntangibleAssets', 'IntangibleAssetsOtherThanGoodwill'],
  materielleAnlaeg: ['PropertyPlantAndEquipment', 'TangibleAssets'],
  finansielleAnlaeg: ['LongtermInvestmentsAndReceivables', 'FinancialAssets', 'OtherNoncurrentFinancialAssets', 'NoncurrentFinancialAssets'],
  anlaegsaktiver: ['NoncurrentAssets', 'FixedAssets'],
  varelager: ['Inventories'],
  varedebitorer: ['ShorttermTradeReceivables', 'TradeReceivables', 'CurrentTradeReceivables', 'TradeAndOtherCurrentReceivables'],
  andreTilgodehavender: ['ShorttermReceivables', 'OtherShorttermReceivables', 'OtherCurrentReceivables'],
  likvider: ['CashAndCashEquivalents'],
  omsaetningsaktiver: ['CurrentAssets'],
  aktiverIAlt: ['Assets'],

  egenkapital: ['Equity'],
  hensatteForpligtelser: ['Provisions', 'NoncurrentProvisions'],
  langfristetGaeld: ['LongtermLiabilitiesOtherThanProvisions', 'NoncurrentLiabilities'],
  leverandoergaeld: ['ShorttermTradePayables', 'TradePayables', 'CurrentTradePayablesToTradeSuppliers', 'TradeAndOtherCurrentPayablesToTradeSuppliers'],
  kortfristetGaeld: ['ShorttermLiabilitiesOtherThanProvisions', 'CurrentLiabilities'],
  passiverIAlt: ['LiabilitiesAndEquity', 'EquityAndLiabilities'],
  pengestroemPrimaerDrift: ['CashFlowFromOperatingActivities', 'CashFlowsFromUsedInOperatingActivities']
}

const POSITIVE = ['vareforbrug', 'personaleomkostninger', 'personaleomkLoen', 'personaleomkPension', 'personaleomkSocialSikring', 'personaleomkAndet', 'andreEksterne', 'afskrivninger', 'finansielleOmkostninger', 'skat']

const NAVN_TIL_KEY = new Map(Object.entries(XBRL_MAP).flatMap(([key, navne]) => navne.map((n, i) => [n.toLowerCase(), { key, prioritet: i }])))

// Real browsers strip et navnerumspræfiks fra localName ved rigtig
// XML-tolkning (fx "nonFraction" for <ix:nonFraction>), men beholder det ved
// HTML-faldback (fx "ix:nonfraction"). Den letvægts-DOM-tolker, serverfunktionen
// bruger til store dokumenter, splitter aldrig navnerum og giver altid
// præfikset med — der splittes derfor altid selv, hvilket giver samme
// resultat i begge tilfælde uanset hvilken DOM-tolker der bruges.
function localName (el) {
  const raa = el.localName || el.nodeName || ''
  return raa.split(':').pop().toLowerCase()
}

/**
 * Laeser et talformateret tekstindhold. iXBRL-elementer angiver selv,
 * hvilket talformat de bruger, via format-attributten (fra XBRL's
 * Transformation Registry), fx "ixt:numdotdecimal" for engelsk/amerikansk
 * format (punktum som decimaltegn, komma som tusindtalsseparator), som
 * bl.a. bruges i engelsksprogede IFRS-aarsrapporter. Uden angivet format,
 * eller ved dansk format ("ixt:numcommadecimal" m.fl.), antages dansk
 * notation: komma som decimaltegn, punktum som tusindtalsseparator. En ren
 * (ikke-inline) XBRL-instans bruger derimod altid kanonisk XML-decimalform:
 * punktum som decimaltegn og aldrig tusindtalsseparatorer.
 */
function taelTeksten (raw, { erInline = true, format = null } = {}) {
  const s = String(raw).trim()
  if (!erInline) {
    const n = parseFloat(s)
    return Number.isFinite(n) ? n : null
  }
  if (format && /dot[-_]?decimal/i.test(format)) {
    const n = parseFloat(s.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  const n = parseFloat(s.replace(/[.\s\u00a0]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function laesKontekster (doc) {
  const ud = {}
  const noder = [...doc.querySelectorAll('*')].filter(el => localName(el) === 'context')
  noder.forEach(el => {
    const id = el.getAttribute('id')
    if (!id) return
    const harDimension = [...el.querySelectorAll('*')].some(c => localName(c) === 'explicitmember' || localName(c) === 'typedmember')
    const find = navn => {
      const n = [...el.querySelectorAll('*')].find(c => localName(c) === navn)
      return n ? n.textContent.trim() : null
    }
    ud[id] = {
      harDimension,
      start: find('startdate'),
      slut: find('enddate'),
      instant: find('instant')
    }
  })
  return ud
}

/**
 * Læser både inline XBRL (XHTML) og en ren XBRL-instans.
 *
 * ParserClass er en injicerbar DOMParser-klasse (default: browserens egen),
 * så den samme tolkning kan genbruges i en serverfunktion — fx til store
 * dokumenter, browseren ikke selv kan hente pga. CORS — med en letvægts
 * DOM-implementering (linkedom) i stedet.
 */
export function parseXbrlDokument (tekst, kilde = '', ParserClass = globalThis.DOMParser) {
  const parser = new ParserClass()
  let doc = parser.parseFromString(tekst, 'application/xhtml+xml')
  if (doc.getElementsByTagName('parsererror').length) doc = parser.parseFromString(tekst, 'text/html')

  const kontekster = laesKontekster(doc)
  const kolonner = new Map()
  const registrer = (dato, key, vaerdi, prioritet) => {
    if (!dato) return
    if (!kolonner.has(dato)) kolonner.set(dato, { values: {}, prioriteter: {} })
    const k = kolonner.get(dato)
    if (k.values[key] != null && k.prioriteter[key] <= prioritet) return
    k.values[key] = POSITIVE.includes(key) ? Math.abs(vaerdi) : vaerdi
    k.prioriteter[key] = prioritet
  }

  // Diagnostik til fejlmeldinger, når der ikke findes nogen genkendte tal:
  // adskiller "intet XBRL-indhold i dokumentet" (fx forkert filtype) fra
  // "XBRL fundet, men ingen kendte navne" (fx anden taksonomi) fra "kendte
  // navne fundet, men kun med dimensioner" (fx opdelt på segment/selskab).
  const diagnostik = { antalElementer: 0, antalMatchede: 0, antalUdelukketPgaDimension: 0 }
  const ikkeGenkendteNavne = new Map()

  // Enhver kandidatpost — både ix:nonFraction og en ren instans' talposter —
  // skal ifølge XBRL-specifikationen altid have et contextRef, så det
  // indsnævrer kandidatlisten væsentligt i forhold til at scanne alle
  // elementer i store dokumenter, uden at ændre hvilke poster der findes.
  const alle = [...doc.querySelectorAll('[contextRef]')]
  alle.forEach(el => {
    const ln = localName(el)
    const erInline = ln === 'nonfraction'
    const navnAttr = el.getAttribute('name')
    let konceptNavn = null
    if (erInline && navnAttr) konceptNavn = navnAttr.split(':').pop()
    // unitRef adskiller talposter fra tekstposter (fx bestyrelsesmedlemmers navne
    // og revisoroplysninger), som en ren XBRL-instans også tagger med contextRef,
    // men aldrig med en enhed — de skal ikke drukne diagnostikkens navneliste.
    else if (!erInline && el.getAttribute('contextRef') && el.getAttribute('unitRef')) konceptNavn = el.nodeName.split(':').pop()
    if (!konceptNavn) return
    diagnostik.antalElementer++

    const traef = NAVN_TIL_KEY.get(konceptNavn.toLowerCase())
    if (!traef) {
      ikkeGenkendteNavne.set(konceptNavn, (ikkeGenkendteNavne.get(konceptNavn) || 0) + 1)
      return
    }
    diagnostik.antalMatchede++

    const ctxId = el.getAttribute('contextRef')
    const ctx = kontekster[ctxId]
    if (!ctx || ctx.harDimension) {
      if (ctx?.harDimension) diagnostik.antalUdelukketPgaDimension++
      return
    }

    let raa = taelTeksten(el.textContent, { erInline, format: el.getAttribute('format') })
    if (raa == null) return
    const scale = parseInt(el.getAttribute('scale') || '0', 10)
    if (Number.isFinite(scale) && scale) raa *= Math.pow(10, scale)
    if ((el.getAttribute('sign') || '') === '-') raa = -raa

    const dato = ctx.slut || ctx.instant
    registrer(dato, traef.key, raa, traef.prioritet)
  })

  const sorteret = [...kolonner.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const virksomhed = (doc.querySelector('title')?.textContent || '').trim().slice(0, 80)

  // De ukendte navne forklarer, hvilken taksonomi eller opsætning dokumentet
  // reelt bruger — fx til at udvide navnelisterne ovenfor med den rigtige
  // betegnelse. Et stort regnskab kan tagge langt over 50 forskellige
  // begreber, og hovedtallene (omsætning, aktiver, …) optræder typisk kun
  // nogle få gange hver — lige så ofte som mange noteposter — så en kort,
  // hyppighedssorteret top-liste risikerer at drukne dem i note-støj.
  // Listen sorteres derfor efter hyppighed, men er lang nok til, at
  // hovedtallene bør være med, selv i et regnskab med mange noter.
  diagnostik.antalUnikkeIkkeGenkendte = ikkeGenkendteNavne.size
  diagnostik.ikkeGenkendteNavne = [...ikkeGenkendteNavne.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 50)
    .map(([navn, antal]) => ({ navn, antal }))

  return {
    kilde,
    virksomhed,
    enhed: 'kr.',
    diagnostik,
    kolonner: sorteret
      .filter(([, k]) => Object.keys(k.values).length > 0)
      .slice(0, 4)
      .map(([dato, k]) => ({ navn: dato.slice(0, 4), values: k.values }))
  }
}

/**
 * Forklarer på dansk, hvorfor et dokument ikke gav nogen talkolonner, ud fra
 * diagnostikken fra parseXbrlDokument — så brugeren ved, om dokumentet slet
 * ikke var XBRL, brugte en ukendt taksonomi, eller kun havde tallene opdelt
 * på en dimension (fx segment eller selskab i en koncern).
 */
export function diagnostikTekst (diagnostik) {
  if (!diagnostik || !diagnostik.antalElementer) {
    return 'Dokumentet ser ikke ud til at indeholde XBRL-mærkede tal. Kontrollér, at adressen peger på selve regnskabsdokumentet og ikke en visningsside.'
  }
  if (!diagnostik.antalMatchede) {
    const navne = diagnostik.ikkeGenkendteNavne || []
    const eksempler = navne.map(n => n.navn).join(', ')
    const optaelling = diagnostik.antalUnikkeIkkeGenkendte > navne.length
      ? ` (${navne.length} af ${diagnostik.antalUnikkeIkkeGenkendte} forskellige navne i dokumentet, mest hyppige først)`
      : ''
    return 'Dokumentet indeholder XBRL-mærkede tal, men ingen af de kendte begreber fra fsa- eller ifrs-full-taksonomien blev genkendt. Regnskabet bruger muligvis en anden taksonomi eller opsætning.' +
      (eksempler ? ` Navne fundet i dokumentet${optaelling}: ${eksempler}.` : '')
  }
  if (diagnostik.antalUdelukketPgaDimension >= diagnostik.antalMatchede) {
    return 'Dokumentet indeholder genkendte tal, men de er alle opdelt på en dimension (fx segment eller selskab i en koncern) uden en samlet sum uden dimension. Prøv evt. et andet dokument fra samme regnskab (fx moderselskabstal i stedet for koncerntal).'
  }
  return 'Der blev fundet genkendte tal, men ingen af dem kunne knyttes til en balancedato.'
}

/**
 * Henter og tolker en iXBRL-adresse gennem serverfunktionen. Både hentning
 * og selve tolkningen sker på serveren (ikke kun proxyet råt igennem), fordi
 * Virk hverken sender CORS-headere eller svarer på kald uden
 * browserlignende headere — og fordi store selskabers årsrapporter kan være
 * adskillige MB store; ved kun at sende det tolkede resultat (nogle få
 * kolonner) tilbage til browseren undgås grænserne for, hvor meget data en
 * browserside kan hente i ét hug.
 */
export async function importerIxbrlLink (url) {
  const svar = await fetch('/.netlify/functions/ixbrl?url=' + encodeURIComponent(url))
  const data = await svar.json().catch(() => null)
  if (!svar.ok || !data) throw new Error(data?.fejl || `Kunne ikke hente dokumentet (${svar.status}).`)
  if (data.fejl) throw new Error(data.fejl)
  return data
}

/** Slår offentliggjorte årsrapporter op på CVR-nummer. */
export async function soegRegnskaber (cvr) {
  const svar = await fetch('/.netlify/functions/regnskaber?cvr=' + encodeURIComponent(cvr))
  const data = await svar.json().catch(() => ({ fejl: 'Uventet svar fra serveren.' }))
  if (!svar.ok || data.fejl) throw new Error(data.fejl || `Opslaget fejlede (${svar.status}).`)
  return data.regnskaber || []
}

export async function importerXbrlFil (file) {
  const tekst = await file.text()
  return parseXbrlDokument(tekst, file.name)
}
