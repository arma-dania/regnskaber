import { useState } from 'react'
import { FIELDS, FIELD_MAP, SECTIONS, PRIMO_FIELDS, KOMPONENT_LABELS, withDerived, validate, laegPosterSammen } from '../lib/model.js'
import { parseDanskTal } from '../lib/pdfImport.js'
import { foreslaOmformning } from '../lib/omformning.js'

const visTal = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n))

const postNavn = (dataset, key) => dataset.posterLabels?.[key] ?? FIELD_MAP[key]?.label ?? key

const sammensatForklaring = grupper => 'Lagt sammen af regnskabets egne poster: ' +
  Object.entries(grupper).map(([g, v]) => `${KOMPONENT_LABELS[g] || g} ${visTal(v)}`).join(', ') +
  '. Kan ikke rettes her — ret i så fald enkeltposterne i selve regnskabet.'

export default function DataGrid ({ dataset, setDataset }) {
  const [visPrimo, setVisPrimo] = useState(() => Object.keys(dataset.primo || {}).length > 0)
  const [dragKilde, setDragKilde] = useState(null)
  const [dragOverMaal, setDragOverMaal] = useState(null)
  const [pendingMerge, setPendingMerge] = useState(null)
  const [forslag, setForslag] = useState(null)
  const noter = validate(dataset)

  const kanFlyttes = f => !f.derived

  const foreslaSammenlaegning = (kildeKey, maalKey) => {
    if (!kildeKey || kildeKey === maalKey) return
    const kilde = FIELD_MAP[kildeKey]
    const maal = FIELD_MAP[maalKey]
    if (!kilde || !maal || kilde.derived || maal.derived || kilde.section !== maal.section) return
    setPendingMerge({
      kildeKey,
      maalKey,
      foreslaetNavn: `${postNavn(dataset, maalKey)} (inkl. ${postNavn(dataset, kildeKey).toLowerCase()})`
    })
  }

  const bekraeftSammenlaegning = () => {
    if (!pendingMerge) return
    setDataset(d => laegPosterSammen(d, pendingMerge.kildeKey, pendingMerge.maalKey, pendingMerge.foreslaetNavn.trim() || postNavn(d, pendingMerge.maalKey)))
    setForslag(f => f?.filter(fo => fo.id !== `${pendingMerge.kildeKey}->${pendingMerge.maalKey}`) || null)
    setPendingMerge(null)
  }

  const koerForslag = () => setForslag(foreslaOmformning(dataset))

  const saet = (aarIndex, key, raa) => {
    setDataset(d => {
      const kopi = structuredClone(d)
      const aar = kopi.aar[aarIndex]
      const v = raa.trim() === '' ? null : parseDanskTal(raa)
      aar.values[key] = v
      // Tomt felt betyder "regn den ud for mig"; et tal betyder "brug mit tal".
      if (v == null) delete aar.manual[key]
      else if (FIELDS.find(f => f.key === key)?.derived) aar.manual[key] = true
      return kopi
    })
  }

  const saetPrimo = (key, raa) => {
    setDataset(d => {
      const kopi = structuredClone(d)
      kopi.primo = { ...kopi.primo }
      const v = raa.trim() === '' ? null : parseDanskTal(raa)
      if (v == null) delete kopi.primo[key]
      else kopi.primo[key] = v
      return kopi
    })
  }

  const saetAarLabel = (i, tekst) => setDataset(d => {
    const kopi = structuredClone(d)
    kopi.aar[i].label = tekst
    return kopi
  })

  const beregnede = dataset.aar.map(y => withDerived(y.values, y.manual))

  return (
    <>
      <h2 className="sektion-titel">Regnskabet i analyseform</h2>
      <p className="sektion-intro">
        Tallenes farve viser, hvor de kommer fra. <strong>Kursiveret gråt</strong>: beregnet ud fra
        posterne ovenfor og opdateres automatisk. <strong>Okker</strong>: fra regnskabet eller
        indtastet af dig — bliver aldrig regnet om, heller ikke hvis posterne ovenfor ændres (fx er
        bruttofortjeneste i et klasse B-regnskab ikke altid omsætning minus vareforbrug). Tøm
        feltet, hvis posten alligevel skal beregnes. <strong>Σ</strong>: lagt sammen af flere poster
        fra regnskabet under indlæsningen og kan ikke rettes her — hold musen over tallet for at se
        hvilke poster.
      </p>
      <p className="sektion-intro">
        Omkostninger indtastes som positive tal. Poster inden for samme afsnit kan trækkes ind over
        hinanden for at flytte eller lægge dem sammen.
      </p>

      <div className="kort udskriv-skjul">
        <button className="knap lys" onClick={koerForslag}>Foreslå omformning</button>
        <p className="hjaelp" style={{ marginTop: 8, marginBottom: forslag ? 12 : 0 }}>
          Ser på posterne inden for samme afsnit og foreslår sammenlægninger, hvor en post
          konsekvent er lille i forhold til naboposten. Kun forslag — intet ændres, før du
          godkender det.
        </p>
        {forslag && forslag.length === 0 && (
          <p className="hjaelp" style={{ margin: 0 }}>Ingen oplagte sammenlægninger fundet.</p>
        )}
        {forslag && forslag.length > 0 && (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {forslag.map(fo => (
              <li key={fo.id} className="besked" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>{fo.begrundelse}</span>
                <span style={{ display: 'flex', gap: 6, flex: 'none' }}>
                  <button className="knap primaer" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => foreslaSammenlaegning(fo.kildeKey, fo.maalKey)}>Se forslag</button>
                  <button className="knap lys" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => setForslag(f => f.filter(x => x.id !== fo.id))}>Afvis</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pendingMerge && (
        <div className="kort" style={{ borderColor: 'var(--petrol)' }}>
          <h3>Læg poster sammen?</h3>
          <p className="hjaelp">
            "{postNavn(dataset, pendingMerge.kildeKey)}" lægges sammen med
            "{postNavn(dataset, pendingMerge.maalKey)}" i alle år. "{postNavn(dataset, pendingMerge.kildeKey)}" tømmes.
          </p>
          <label className="felt" htmlFor="nyt-postnavn">Navn på den sammenlagte post</label>
          <input
            id="nyt-postnavn" type="text" value={pendingMerge.foreslaetNavn}
            onChange={e => setPendingMerge(p => ({ ...p, foreslaetNavn: e.target.value }))}
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button className="knap primaer" onClick={bekraeftSammenlaegning}>Bekræft sammenlægning</button>
            <button className="knap lys" onClick={() => setPendingMerge(null)}>Annullér</button>
          </div>
        </div>
      )}

      <div className="kort">
        <div className="gitter-2">
          <div>
            <label className="felt" htmlFor="virksomhed">Virksomhed</label>
            <input id="virksomhed" type="text" value={dataset.virksomhed}
              onChange={e => setDataset(d => ({ ...d, virksomhed: e.target.value }))}
              placeholder="Fx Novo Nordisk A/S" />
          </div>
          <div>
            <label className="felt" htmlFor="enhed">Beløb angivet i</label>
            <select id="enhed" value={dataset.enhed} onChange={e => setDataset(d => ({ ...d, enhed: e.target.value }))}>
              <option>kr.</option>
              <option>1.000 kr.</option>
              <option>mio. kr.</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="felt">
            <input type="checkbox" checked={visPrimo} onChange={e => setVisPrimo(e.target.checked)} style={{ width: 'auto', marginRight: 8 }} />
            Vis kolonne til primobalance
          </label>
          <p className="hjaelp" style={{ marginTop: 4 }}>
            Gennemsnitstal i nøgletal 1, 3, 4, 5 og 6 kræver en åbningsbalance for det ældste år.
            Uden den bruges ultimotallet, og resultatet markeres som skøn.
          </p>
        </div>
      </div>

      {noter.map((n, i) => (
        <div key={i} className={'besked ' + (n.level === 'error' ? 'fejl' : 'advarsel')}>
          <strong>{n.year}:</strong> {n.text}
        </div>
      ))}

      <div className="kort">
        <div className="tabel-omslag">
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>Post</th>
                {visPrimo && <th className="num" style={{ width: 130 }}>Primo</th>}
                {dataset.aar.map((y, i) => (
                  <th key={i} className="num" style={{ width: 150 }}>
                    <input
                      type="text" value={y.label} onChange={e => saetAarLabel(i, e.target.value)}
                      aria-label={`Navn på år ${i + 1}`} style={{ textAlign: 'right' }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(sec => (
                <Fragmenter key={sec.id}>
                  <tr className="gruppe"><td colSpan={1 + (visPrimo ? 1 : 0) + dataset.aar.length}>{sec.title}</td></tr>
                  {FIELDS.filter(f => f.section === sec.id).map(f => (
                    <tr
                      key={f.key}
                      className={(f.derived ? 'sum' : '') + (dragOverMaal === f.key ? ' traek-over' : '')}
                      draggable={kanFlyttes(f)}
                      onDragStart={kanFlyttes(f) ? e => { setDragKilde(f.key); e.dataTransfer.effectAllowed = 'move' } : undefined}
                      onDragEnd={() => { setDragKilde(null); setDragOverMaal(null) }}
                      onDragOver={kanFlyttes(f) ? e => { if (dragKilde && dragKilde !== f.key) { e.preventDefault(); setDragOverMaal(f.key) } } : undefined}
                      onDragLeave={() => setDragOverMaal(m => (m === f.key ? null : m))}
                      onDrop={kanFlyttes(f) ? e => { e.preventDefault(); foreslaSammenlaegning(dragKilde, f.key); setDragKilde(null); setDragOverMaal(null) } : undefined}
                    >
                      <td>
                        <span className={'postnavn' + (kanFlyttes(f) ? ' traekbar' : '')} title={kanFlyttes(f) ? 'Træk til en anden post i samme afsnit for at flytte eller lægge sammen' : undefined}>
                          {postNavn(dataset, f.key)}
                          {f.derived && <span className="mærkat" title={'Beregnes som: ' + f.derived}>beregnes</span>}
                        </span>
                      </td>
                      {visPrimo && (
                        <td className="num">
                          {PRIMO_FIELDS.includes(f.key)
                            ? <input type="text" inputMode="decimal" value={visTal(dataset.primo?.[f.key])}
                                onChange={e => saetPrimo(f.key, e.target.value)}
                                aria-label={`${postNavn(dataset, f.key)}, primo`} />
                            : <span style={{ color: 'var(--linje)' }}>·</span>}
                        </td>
                      )}
                      {dataset.aar.map((y, i) => {
                        const eksplicit = y.values[f.key] != null
                        const vaerdi = eksplicit ? y.values[f.key] : beregnede[i][f.key]
                        const sammensat = y.sammensat?.[f.key]
                        if (sammensat) {
                          return (
                            <td key={i} className="num">
                              <span
                                className="sammensat-vaerdi" tabIndex={0}
                                title={sammensatForklaring(sammensat)}
                                aria-label={`${postNavn(dataset, f.key)}, ${y.label || 'år ' + (i + 1)}: ${visTal(vaerdi)}. ${sammensatForklaring(sammensat)}`}
                              >
                                Σ {visTal(vaerdi)}
                              </span>
                            </td>
                          )
                        }
                        return (
                          <td key={i} className="num">
                            <input
                              type="text" inputMode="decimal"
                              className={f.derived ? (eksplicit ? 'manuel' : 'afledt') : ''}
                              value={visTal(vaerdi)}
                              onChange={e => saet(i, f.key, e.target.value)}
                              aria-label={`${postNavn(dataset, f.key)}, ${y.label || 'år ' + (i + 1)}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragmenter>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }
