// Mapping fra den danske årsrapporttaksonomi (fsa) til analyseformen.
// Flere navne kan pege på samme post – det første fundne vinder.
const XBRL_MAP = {
  omsaetning: ['Revenue', 'SalesRevenue', 'RevenueFromContractsWithCustomers'],
  vareforbrug: ['CostOfSales', 'RawMaterialsAndConsumablesUsed', 'ProductionCosts', 'CostOfGoodsSold'],
  bruttoresultat: ['GrossProfitLoss', 'GrossResult', 'GrossProfit'],
  personaleomkostninger: ['EmployeeBenefitsExpense', 'StaffCosts'],
  andreEksterne: ['OtherExternalExpenses', 'ExternalExpenses', 'DistributionCosts', 'AdministrativeExpenses'],
  afskrivninger: ['DepreciationAmortisationExpenseAndImpairmentLossesOfPropertyPlantAndEquipmentAndIntangibleAssetsRecognisedInProfitOrLoss', 'DepreciationAmortisationExpense', 'DepreciationAndAmortisation'],
  resultatPrimaerDrift: ['ProfitLossFromOrdinaryOperatingActivities', 'OperatingProfitLoss', 'ProfitLossFromOperatingActivities'],
  finansielleIndtaegter: ['OtherFinanceIncome', 'FinanceIncome', 'FinancialIncome'],
  finansielleOmkostninger: ['OtherFinanceExpenses', 'FinanceCosts', 'FinancialExpenses', 'InterestExpense'],
  resultatFoerSkat: ['ProfitLossFromOrdinaryActivitiesBeforeTax', 'ProfitLossBeforeTax'],
  skat: ['TaxExpense', 'TaxExpenseOnOrdinaryActivities', 'IncomeTaxExpense'],
  aaretsResultat: ['ProfitLoss'],

  immaterielleAnlaeg: ['IntangibleAssets'],
  materielleAnlaeg: ['PropertyPlantAndEquipment', 'TangibleAssets'],
  finansielleAnlaeg: ['LongtermInvestmentsAndReceivables', 'FinancialAssets'],
  anlaegsaktiver: ['NoncurrentAssets', 'FixedAssets'],
  varelager: ['Inventories'],
  varedebitorer: ['ShorttermTradeReceivables', 'TradeReceivables'],
  andreTilgodehavender: ['ShorttermReceivables', 'OtherShorttermReceivables'],
  likvider: ['CashAndCashEquivalents'],
  omsaetningsaktiver: ['CurrentAssets'],
  aktiverIAlt: ['Assets'],

  egenkapital: ['Equity'],
  hensatteForpligtelser: ['Provisions'],
  langfristetGaeld: ['LongtermLiabilitiesOtherThanProvisions', 'NoncurrentLiabilities'],
  leverandoergaeld: ['ShorttermTradePayables', 'TradePayables'],
  kortfristetGaeld: ['ShorttermLiabilitiesOtherThanProvisions', 'CurrentLiabilities'],
  passiverIAlt: ['LiabilitiesAndEquity'],
  pengestroemPrimaerDrift: ['CashFlowFromOperatingActivities', 'CashFlowsFromUsedInOperatingActivities']
}

const POSITIVE = ['vareforbrug', 'personaleomkostninger', 'andreEksterne', 'afskrivninger', 'finansielleOmkostninger', 'skat']

const NAVN_TIL_KEY = new Map(Object.entries(XBRL_MAP).flatMap(([key, navne]) => navne.map((n, i) => [n.toLowerCase(), { key, prioritet: i }])))

function localName (el) {
  return (el.localName || el.nodeName.split(':').pop() || '').toLowerCase()
}

function taelTeksten (raw) {
  const n = parseFloat(String(raw).replace(/[.\s\u00a0]/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function laesKontekster (doc) {
  const ud = {}
  const noder = [...doc.getElementsByTagName('*')].filter(el => localName(el) === 'context')
  noder.forEach(el => {
    const id = el.getAttribute('id')
    if (!id) return
    const harDimension = [...el.getElementsByTagName('*')].some(c => localName(c) === 'explicitmember' || localName(c) === 'typedmember')
    const find = navn => {
      const n = [...el.getElementsByTagName('*')].find(c => localName(c) === navn)
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

/** Læser både inline XBRL (XHTML) og en ren XBRL-instans. */
export function parseXbrlDokument (tekst, kilde = '') {
  const parser = new DOMParser()
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

  const alle = [...doc.getElementsByTagName('*')]
  alle.forEach(el => {
    const ln = localName(el)
    const erInline = ln === 'nonfraction'
    const navnAttr = el.getAttribute('name')
    let konceptNavn = null
    if (erInline && navnAttr) konceptNavn = navnAttr.split(':').pop()
    else if (!erInline && el.getAttribute('contextRef')) konceptNavn = el.nodeName.split(':').pop()
    if (!konceptNavn) return

    const traef = NAVN_TIL_KEY.get(konceptNavn.toLowerCase())
    if (!traef) return

    const ctxId = el.getAttribute('contextRef')
    const ctx = kontekster[ctxId]
    if (!ctx || ctx.harDimension) return

    let raa = taelTeksten(el.textContent)
    if (raa == null) return
    const scale = parseInt(el.getAttribute('scale') || '0', 10)
    if (Number.isFinite(scale) && scale) raa *= Math.pow(10, scale)
    if ((el.getAttribute('sign') || '') === '-') raa = -raa

    const dato = ctx.slut || ctx.instant
    registrer(dato, traef.key, raa, traef.prioritet)
  })

  const sorteret = [...kolonner.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const virksomhed = (doc.querySelector('title')?.textContent || '').trim().slice(0, 80)

  return {
    kilde,
    virksomhed,
    enhed: 'kr.',
    kolonner: sorteret
      .filter(([, k]) => Object.keys(k.values).length > 0)
      .slice(0, 4)
      .map(([dato, k]) => ({ navn: dato.slice(0, 4), values: k.values }))
  }
}

/**
 * Henter en iXBRL-adresse gennem serverfunktionen, fordi Virk hverken sender
 * CORS-headere eller svarer på kald uden browserlignende headere.
 */
export async function importerIxbrlLink (url) {
  const svar = await fetch('/.netlify/functions/ixbrl?url=' + encodeURIComponent(url))
  const tekst = await svar.text()
  if (!svar.ok) throw new Error(tekst.trim() || `Kunne ikke hente dokumentet (${svar.status}).`)
  return parseXbrlDokument(tekst, url)
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
