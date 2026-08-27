import { emptyDataset } from './model.js'

const AAR = [
  ['2023', {
    omsaetning: 48000, vareforbrug: 28800, personaleomkostninger: 11500, andreEksterne: 3900, afskrivninger: 1400,
    finansielleIndtaegter: 60, finansielleOmkostninger: 640, skat: 400,
    immaterielleAnlaeg: 900, materielleAnlaeg: 12400, finansielleAnlaeg: 300,
    varelager: 7200, varedebitorer: 6100, andreTilgodehavender: 700, likvider: 1900,
    egenkapital: 9400, hensatteForpligtelser: 400, langfristetGaeld: 9700,
    leverandoergaeld: 5800, andenKortfristetGaeld: 4200,
    pengestroemPrimaerDrift: 2100, antalAktier: 500000, boerskurs: 38
  }],
  ['2024', {
    omsaetning: 53500, vareforbrug: 32700, personaleomkostninger: 12400, andreEksterne: 4100, afskrivninger: 1500,
    finansielleIndtaegter: 80, finansielleOmkostninger: 700, skat: 480,
    immaterielleAnlaeg: 800, materielleAnlaeg: 13200, finansielleAnlaeg: 300,
    varelager: 8400, varedebitorer: 7000, andreTilgodehavender: 750, likvider: 1200,
    egenkapital: 10600, hensatteForpligtelser: 450, langfristetGaeld: 9200,
    leverandoergaeld: 6900, andenKortfristetGaeld: 4500,
    pengestroemPrimaerDrift: 1500, antalAktier: 500000, boerskurs: 42
  }],
  ['2025', {
    omsaetning: 57200, vareforbrug: 35900, personaleomkostninger: 13100, andreEksterne: 4500, afskrivninger: 1700,
    finansielleIndtaegter: 70, finansielleOmkostninger: 820, skat: 275,
    immaterielleAnlaeg: 700, materielleAnlaeg: 14600, finansielleAnlaeg: 300,
    varelager: 9600, varedebitorer: 7900, andreTilgodehavender: 800, likvider: 700,
    egenkapital: 11075, hensatteForpligtelser: 500, langfristetGaeld: 9500,
    leverandoergaeld: 8100, andenKortfristetGaeld: 5425,
    pengestroemPrimaerDrift: 900, antalAktier: 500000, boerskurs: 34
  }]
]

/**
 * Et opdigtet handelsselskab, hvor omsætningen vokser, mens varelager og
 * debitorer vokser hurtigere. Et taknemmeligt case til undervisning.
 */
export function EKSEMPEL () {
  const d = emptyDataset()
  d.virksomhed = 'Nordkajen Handel A/S'
  d.enhed = '1.000 kr.'
  d.indeksFelt = 'omsaetning'
  d.indeksBasisaar = 0
  d.aar = AAR.map(([label, values]) => ({
    label,
    values: { ...d.aar[0].values, ...values },
    manual: {}
  }))
  d.primo = {
    aktiverIAlt: 27800, egenkapital: 8500, varelager: 6500, anlaegsaktiver: 13100,
    immaterielleAnlaeg: 1000, materielleAnlaeg: 11800, kortfristetGaeld: 9600,
    langfristetGaeld: 9300, omsaetningsaktiver: 14700, varedebitorer: 5600, leverandoergaeld: 5200
  }
  return d
}
