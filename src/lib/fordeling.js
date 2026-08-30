import { emptyYear } from './model.js'

const erAarstal = navn => /^(19|20)\d{2}$/.test(String(navn).trim())

/**
 * Tre årsregnskaber indeholder fire balancedatoer. De tre nyeste år bliver
 * analyseår; det ældste sammenligningsår bliver primobalance, så gennemsnitstal
 * kan beregnes korrekt allerede i det første analyseår.
 *
 * Hvert regnskab bidrager kun med sit eget hovedår (den første kolonne i
 * dokumentet) — bortset fra det ældste regnskab, som også bidrager med sit
 * sammenligningsår, der bruges til primobalancen. Det undgår at et regnskabs
 * ofte forkortede sammenligningstal for et år fortrænger et andet regnskabs
 * egne, fyldige tal for samme år: en 2025-rapport bidrager kun med 2025, en
 * 2024-rapport kun med 2024, mens en 2023-rapport bidrager med både 2023 og
 * 2022. "Ældst" afgøres af regnskabets eget hovedår, ikke af den rækkefølge,
 * regnskaberne blev indlæst i.
 */
export function fordelKolonner (kilder) {
  const poster = []
  kilder.forEach((kilde, kildeIndex) => {
    const kildeHovedaar = Number(kilde.kolonner[0]?.navn) || 0
    kilde.kolonner.forEach((kol, kolIndex) => {
      poster.push({
        aar: String(kol.navn).trim(),
        values: kol.values,
        kilde: kilde.kilde,
        kildeHovedaar,
        kolIndex,
        raekkefoelge: kildeIndex * 10 + kolIndex
      })
    })
  })

  if (!poster.length) return null

  const navngivneAlle = poster.filter(p => erAarstal(p.aar))
  const ukendte = poster.filter(p => !erAarstal(p.aar))

  // Kun det ældste regnskab (laveste hovedår) bidrager med sit sammenligningsår.
  const hovedaarSet = [...new Set(navngivneAlle.filter(p => p.kolIndex === 0 && p.kildeHovedaar).map(p => p.kildeHovedaar))]
  const aeldsteHovedaar = hovedaarSet.length ? Math.min(...hovedaarSet) : null
  const navngivne = navngivneAlle.filter(p => p.kolIndex === 0 || p.kildeHovedaar === aeldsteHovedaar)

  // Uden årstal i PDF'en kan kolonnerne kun stilles op i den rækkefølge, de blev læst.
  if (!navngivne.length) {
    const sorteret = [...ukendte].sort((a, b) => a.raekkefoelge - b.raekkefoelge)
    return {
      aar: sorteret.slice(0, 3).reverse().map((p, i) => ({ label: `År ${i + 1}`, values: p.values, kilder: [p.kilde] })),
      primo: sorteret[3]?.values || {},
      primoKilde: sorteret[3]?.kilde || null,
      advarsler: ['Der blev ikke fundet årstal i dokumenterne. Kolonnerne er stillet op i den rækkefølge, de blev læst — kontrollér årstallene på trin 2.']
    }
  }

  const perAar = new Map()
  navngivne.forEach(p => {
    if (!perAar.has(p.aar)) perAar.set(p.aar, [])
    perAar.get(p.aar).push(p)
  })

  const flettet = [...perAar.entries()].map(([aar, liste]) => {
    const rangeret = [...liste].sort((a, b) => (b.kildeHovedaar - a.kildeHovedaar) || (a.raekkefoelge - b.raekkefoelge))
    const values = {}
    const kilder = []
    rangeret.forEach(p => {
      if (!kilder.includes(p.kilde)) kilder.push(p.kilde)
      Object.entries(p.values).forEach(([key, v]) => {
        if (values[key] == null) values[key] = v
      })
    })
    return { aar, values, kilder }
  }).sort((a, b) => Number(b.aar) - Number(a.aar))

  const analyseaar = flettet.slice(0, 3).reverse()
  const primoPost = flettet[3]

  const advarsler = []
  if (flettet.length < 4) {
    advarsler.push('Der er kun ' + flettet.length + ' balancedato' + (flettet.length === 1 ? '' : 'er') + ' at arbejde med. Med tre årsregnskaber bør der være fire — kontrollér at alle tre filer er læst.')
  }
  const aarstal = analyseaar.map(a => Number(a.aar))
  for (let i = 1; i < aarstal.length; i++) {
    if (aarstal[i] - aarstal[i - 1] !== 1) {
      advarsler.push(`Der er spring mellem ${aarstal[i - 1]} og ${aarstal[i]}. Nøgletallenes udvikling kan ikke læses som en sammenhængende periode.`)
    }
  }

  return {
    aar: analyseaar.map(a => ({ label: a.aar, values: a.values, kilder: a.kilder })),
    primo: primoPost?.values || {},
    primoAar: primoPost?.aar || null,
    primoKilde: primoPost?.kilder?.[0] || null,
    advarsler
  }
}

/**
 * Lægger fordelingen ind i datasættet uden at røre virksomhedsnavn og enhed.
 * Hvert års tal erstattes helt af den nye fordeling — de må ikke blandes med
 * gamle tal fra et tidligere selskab eller eksempeldata, for så vil poster,
 * som det nye regnskab ikke oplyser (fx omsætning), fejlagtigt beholde det
 * gamle tal og se ud som om de kommer fra det nye regnskab. Har den nye
 * fordeling færre år end skemaet (fx kun to regnskaber fundet), nulstilles
 * de resterende år også — ellers ville de beholde tal fra et tidligere,
 * urelateret selskab.
 */
export function anvendFordeling (dataset, fordeling) {
  const kopi = structuredClone(dataset)
  kopi.aar.forEach((y, i) => {
    const a = fordeling.aar[i]
    if (a) {
      y.label = a.label
      y.values = { ...a.values }
      y.manual = {}
    } else {
      Object.assign(y, emptyYear())
    }
  })
  kopi.primo = { ...fordeling.primo }
  // Et nyt regnskab lægges ind – afkrydsningerne til indekstal er for det
  // forrige selskab og skal ikke følge med.
  kopi.indeksFelter = []
  delete kopi.indeksFelt
  return kopi
}
