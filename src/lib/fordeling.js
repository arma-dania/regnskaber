import { FIELD_MAP } from './model.js'

const erAarstal = navn => /^(19|20)\d{2}$/.test(String(navn).trim())

/**
 * Tre årsregnskaber indeholder fire balancedatoer. De tre nyeste år bliver
 * analyseår; det ældste sammenligningsår bliver primobalance, så gennemsnitstal
 * kan beregnes korrekt allerede i det første analyseår.
 *
 * Hvor to regnskaber dækker samme år, vinder det regnskab, hvor året er
 * hovedåret — sammenligningskolonnen er ofte forkortet. Afviger de to kilder
 * fra hinanden, meldes det som en konflikt i stedet for at blive tiet ihjel.
 */
export function fordelKolonner (kilder) {
  const poster = []
  kilder.forEach((kilde, kildeIndex) => {
    kilde.kolonner.forEach((kol, kolIndex) => {
      poster.push({
        aar: String(kol.navn).trim(),
        values: kol.values,
        kilde: kilde.kilde,
        hovedaar: kolIndex === 0,
        raekkefoelge: kildeIndex * 10 + kolIndex
      })
    })
  })

  if (!poster.length) return null

  const navngivne = poster.filter(p => erAarstal(p.aar))
  const ukendte = poster.filter(p => !erAarstal(p.aar))

  // Uden årstal i PDF'en kan kolonnerne kun stilles op i den rækkefølge, de blev læst.
  if (!navngivne.length) {
    const sorteret = [...ukendte].sort((a, b) => a.raekkefoelge - b.raekkefoelge)
    return {
      aar: sorteret.slice(0, 3).reverse().map((p, i) => ({ label: `År ${i + 1}`, values: p.values, kilder: [p.kilde] })),
      primo: sorteret[3]?.values || {},
      primoKilde: sorteret[3]?.kilde || null,
      konflikter: [],
      advarsler: ['Der blev ikke fundet årstal i dokumenterne. Kolonnerne er stillet op i den rækkefølge, de blev læst — kontrollér årstallene på trin 2.']
    }
  }

  const perAar = new Map()
  navngivne.forEach(p => {
    if (!perAar.has(p.aar)) perAar.set(p.aar, [])
    perAar.get(p.aar).push(p)
  })

  const konflikter = []
  const flettet = [...perAar.entries()].map(([aar, liste]) => {
    const rangeret = [...liste].sort((a, b) => (b.hovedaar - a.hovedaar) || (a.raekkefoelge - b.raekkefoelge))
    const values = {}
    const kilder = []
    rangeret.forEach(p => {
      if (!kilder.includes(p.kilde)) kilder.push(p.kilde)
      Object.entries(p.values).forEach(([key, v]) => {
        if (values[key] == null) { values[key] = v; return }
        if (afviger(values[key], v)) {
          konflikter.push({ aar, felt: key, label: FIELD_MAP[key]?.label || key, valgt: values[key], anden: v, kilde: p.kilde })
        }
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
    konflikter,
    advarsler
  }
}

function afviger (a, b) {
  if (a == null || b == null) return false
  const graense = Math.max(1, Math.abs(a) * 0.005)
  return Math.abs(a - b) > graense
}

/** Lægger fordelingen ind i datasættet uden at røre virksomhedsnavn og enhed. */
export function anvendFordeling (dataset, fordeling) {
  const kopi = structuredClone(dataset)
  fordeling.aar.forEach((a, i) => {
    if (!kopi.aar[i]) return
    kopi.aar[i].label = a.label
    kopi.aar[i].values = { ...kopi.aar[i].values, ...a.values }
    kopi.aar[i].manual = {}
  })
  kopi.primo = { ...kopi.primo, ...fordeling.primo }
  return kopi
}
