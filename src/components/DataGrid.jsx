import { useState } from 'react'
import { FIELDS, FIELD_MAP, SECTIONS, PRIMO_FIELDS, PERSONALE_KOMPONENTER, withDerived, validate, laegPosterSammen, visFelt } from '../lib/model.js'

const visTal = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n))

const postNavn = (dataset, key) => dataset.posterLabels?.[key] ?? FIELD_MAP[key]?.label ?? key

export default function DataGrid ({ dataset, setDataset }) {
  const [visPrimo, setVisPrimo] = useState(() => Object.keys(dataset.primo || {}).length > 0)
  const [dragKilde, setDragKilde] = useState(null)
  const [dragOverMaal, setDragOverMaal] = useState(null)
  const [pendingMerge, setPendingMerge] = useState(null)
  const noter = validate(dataset)

  const kanFlyttes = f => !f.derived

  const foreslaSammenlaegning = (kildeKey, maalKey) => {
    if (!kildeKey || kildeKey === maalKey) return
    const kilde = FIELD_MAP[kildeKey]
    const maal = FIELD_MAP[maalKey]
    if (!kilde || !maal || kilde.derived || maal.derived || kilde.section !== maal.section) return
    // Lønkomponenterne (løn, pension, …) er en kendt gruppe under den ene,
    // rigtige post "Personaleomkostninger" — foreslå den direkte i stedet
    // for at kæde navnet længere for hver sammenlægning (fx "... (inkl. X)
    // (inkl. Y)"), uanset hvilken retning de trækkes i.
    const erLoenkomponentGruppe = PERSONALE_KOMPONENTER.includes(kildeKey) &&
      (PERSONALE_KOMPONENTER.includes(maalKey) || maalKey === 'personaleomkostninger')
    setPendingMerge({
      kildeKey,
      maalKey,
      foreslaetNavn: erLoenkomponentGruppe
        ? FIELD_MAP.personaleomkostninger.label
        : `${postNavn(dataset, maalKey)} (inkl. ${postNavn(dataset, kildeKey).toLowerCase()})`
    })
  }

  const bekraeftSammenlaegning = () => {
    if (!pendingMerge) return
    setDataset(d => laegPosterSammen(d, pendingMerge.kildeKey, pendingMerge.maalKey, pendingMerge.foreslaetNavn.trim() || postNavn(d, pendingMerge.maalKey)))
    setPendingMerge(null)
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
        Her ser du de indlæste regnskaber omregnet til de faste poster, som de 28 nøgletal
        beregnes ud fra. Tallene kan ikke rettes her — de kommer udelukkende fra det, du har
        indlæst under "Indlæs regnskaber". Er et tal forkert, skal det rettes i selve importen.
      </p>
      <p className="sektion-intro">
        <strong>Kursiveret gråt</strong> er beregnet ud fra posterne ovenfor og opdateres
        automatisk. <strong>Okker</strong> er en post, regnskabet selv oplyser direkte, og
        bliver derfor aldrig regnet om — fx er bruttofortjeneste i et klasse B-regnskab ikke
        altid omsætning minus vareforbrug.
      </p>
      <p className="sektion-intro">
        Oplyser regnskabet en post i flere enkeltdele (fx løn og pension hver for sig), kan du
        trække dem ind over hinanden for at lægge dem sammen til den rigtige, samlede post —
        poster kan kun lægges sammen inden for samme afsnit.
      </p>

      {pendingMerge && (
        <div className="kort sammenlaegning-flydende" style={{ borderColor: 'var(--petrol)' }}>
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
                  {FIELDS.filter(f => f.section === sec.id && visFelt(f, dataset)).map(f => (
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
                            ? <span className="tal-vaerdi" aria-label={`${postNavn(dataset, f.key)}, primo`}>
                                {visTal(dataset.primo?.[f.key])}
                              </span>
                            : <span style={{ color: 'var(--linje)' }}>·</span>}
                        </td>
                      )}
                      {dataset.aar.map((y, i) => {
                        const eksplicit = y.values[f.key] != null
                        const vaerdi = eksplicit ? y.values[f.key] : beregnede[i][f.key]
                        return (
                          <td key={i} className="num">
                            <span
                              className={'tal-vaerdi' + (f.derived ? (eksplicit ? ' manuel' : ' afledt') : '')}
                              aria-label={`${postNavn(dataset, f.key)}, ${y.label || 'år ' + (i + 1)}`}
                            >
                              {visTal(vaerdi)}
                            </span>
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
