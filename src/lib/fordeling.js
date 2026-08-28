const erAarstal = navn => /^(19|20)\d{2}$/.test(String(navn).trim())

/**
 * Tre årsregnskaber indeholder fire balancedatoer. De tre nyeste år bliver
 * analyseår; det ældste sammenligningsår bliver primobalance, så gennemsnitstal
 * kan beregnes korrekt allerede i det første analyseår.
 *
 * Hvor to regnskaber dækker samme år, vinder tallet fra den nyeste årsrapport
 * — en 2025-rapports sammenligningstal for 2024 går forud for 2024-rapportens
 * egne tal, fordi en senere rapport kan indeholde rettede eller omgjorte tal.
 * "Nyest" afgøres af regnskabets eget hovedår (den første kolonne i det
 * enkelte dokument), ikke af den rækkefølge, regnskaberne blev indlæst i.
 */
export function fordelKolonner (kilder) {
  const poster = []
  kilder.forEach((kilde, kildeIndex) => {
    const kildeHovedaar = Number(kilde.kolonner[0]?.navn) || 0
    kilde.kolonner.forEach((kol, kolIndex) => {
      poster.push({
        aar: String(kol.navn).trim(),
        values: kol.values,
        sammensat: kol.sammensat || {},
        kilde: kilde.kilde,
        kildeHovedaar,
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
      aar: sorteret.slice(0, 3).reverse().map((p, i) => ({ label: `År ${i + 1}`, values: p.values, kilder: [p.kilde], sammensat: p.sammensat })),
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
    const sammensat = {}
    const kilder = []
    rangeret.forEach(p => {
      if (!kilder.includes(p.kilde)) kilder.push(p.kilde)
      Object.entries(p.values).forEach(([key, v]) => {
        if (values[key] == null) values[key] = v
      })
      Object.entries(p.sammensat || {}).forEach(([key, grupper]) => {
        if (sammensat[key] == null) sammensat[key] = grupper
      })
    })
    return { aar, values, kilder, sammensat }
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
    aar: analyseaar.map(a => ({ label: a.aar, values: a.values, kilder: a.kilder, sammensat: a.sammensat })),
    primo: primoPost?.values || {},
    primoAar: primoPost?.aar || null,
    primoKilde: primoPost?.kilder?.[0] || null,
    advarsler
  }
}

/** Lægger fordelingen ind i datasættet uden at røre virksomhedsnavn og enhed. */
export function anvendFordeling (dataset, fordeling) {
  const kopi = structuredClone(dataset)
  fordeling.aar.forEach((a, i) => {
    if (!kopi.aar[i]) return
    kopi.aar[i].label = a.label
    kopi.aar[i].values = { ...kopi.aar[i].values, ...a.values }
    kopi.aar[i].sammensat = { ...(a.sammensat || {}) }
    kopi.aar[i].manual = {}
  })
  kopi.primo = { ...kopi.primo, ...fordeling.primo }
  return kopi
}
