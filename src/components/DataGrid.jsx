import { useState } from 'react'
import { FIELDS, SECTIONS, PRIMO_FIELDS, withDerived, validate, placerPost, flytLinje } from '../lib/model.js'

const visTal = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n))

// Regnskabets afsnit -> analyseformens afsnit, hvor de ikke-placerede poster vises.
const ANALYSEAFSNIT = { resultat: 'resultat', aktiver: 'aktiver', passiver: 'passiver', pengestroem: 'ovrigt' }

/**
 * Deler de ikke-placerede poster i ét afsnit i to: dem, den studerende skal
 * tage stilling til, og regnskabets egne summer og delposter, der allerede
 * er dækket af en placeret sum (fx selskabskapital, når egenkapitalen er
 * placeret). En delpost hører til den næste sum efter den i regnskabet.
 */
function ikkePlacerede (poster, placering, sektion) {
  const liste = poster.filter(p => p.sektion === sektion)
  const aabne = []
  const daekkede = []
  liste.forEach((p, i) => {
    if (placering[p.id]) return
    const naesteSum = liste.slice(i + 1).find(q => q.erSum)
    if (p.erSum || (naesteSum && placering[naesteSum.id])) daekkede.push(p)
    else aabne.push(p)
  })
  return { aabne, daekkede }
}

export default function DataGrid ({ dataset, setDataset }) {
  const [visPrimo, setVisPrimo] = useState(() => Object.keys(dataset.primoPoster || {}).length > 0)
  const [traekker, setTraekker] = useState(null)
  const [over, setOver] = useState(null)
  const [valgt, setValgt] = useState(null)
  const [visDaekkede, setVisDaekkede] = useState({})
  const noter = validate(dataset)

  const poster = dataset.poster || []
  const placering = dataset.placering || {}
  const beregnede = dataset.aar.map(y => withDerived(y.values))
  const primoBeregnet = withDerived(dataset.primo || {})
  const antalKolonner = 1 + (visPrimo ? 1 : 0) + dataset.aar.length

  const slip = (kilde, key) => {
    if (!kilde) return
    if (kilde.type === 'post') setDataset(d => placerPost(d, kilde.id, key))
    else if (kilde.key !== key) setDataset(d => flytLinje(d, kilde.key, key))
  }

  const traekProps = kilde => ({
    draggable: true,
    onDragStart: e => {
      e.stopPropagation()
      e.dataTransfer.setData('text/plain', JSON.stringify(kilde))
      e.dataTransfer.effectAllowed = 'move'
      setTraekker(kilde)
    },
    onDragEnd: () => { setTraekker(null); setOver(null) }
  })

  // key = en linje i analyseformen, eller null for "ikke placeret".
  const modtagProps = (key, markering) => ({
    onDragOver: e => { if (traekker) { e.preventDefault(); setOver(markering) } },
    onDragLeave: () => setOver(o => (o === markering ? null : o)),
    onDrop: e => {
      e.preventDefault()
      let kilde = traekker
      if (!kilde) { try { kilde = JSON.parse(e.dataTransfer.getData('text/plain')) } catch { kilde = null } }
      slip(kilde, key)
      setTraekker(null); setOver(null)
    }
  })

  const vaelg = id => setValgt(v => (v === id ? null : id))
  const placerValgt = key => { if (valgt) { slip({ type: 'post', id: valgt }, key); setValgt(null) } }

  const saetAarLabel = (i, tekst) => setDataset(d => {
    const kopi = structuredClone(d)
    kopi.aar[i].label = tekst
    return kopi
  })

  const talceller = p => (
    <>
      {visPrimo && <td className="num">{p.sektion === 'aktiver' || p.sektion === 'passiver' ? visTal(dataset.primoPoster?.[p.id]) : ''}</td>}
      {dataset.aar.map((y, i) => <td key={i} className="num">{visTal(y.poster?.[p.id])}</td>)}
    </>
  )

  // modtager = den linje (eller null for "ikke placeret"), et slip på rækken gælder.
  const postRaekke = (p, klasse, modtager, markering, ekstra) => (
    <tr
      key={p.id} className={klasse + (valgt === p.id ? ' valgt' : '') + (p.erSum ? ' regnskabssum' : '') + (over === markering ? ' traek-over' : '')}
      {...modtagProps(modtager, markering)}
      {...traekProps({ type: 'post', id: p.id })}
      onClick={e => { e.stopPropagation(); vaelg(p.id) }}
      title="Træk til en linje i analyseformen for at flytte posten dertil"
    >
      <td><span className="postnavn traekbar">{p.label}{ekstra}</span></td>
      {talceller(p)}
    </tr>
  )

  return (
    <>
      <h2 className="sektion-titel">Regnskabet i analyseform</h2>
      <p className="sektion-intro">
        Regnskabets poster står under den linje i analyseformen, de svarer direkte til. Poster
        uden en oplagt plads står under <strong>Ikke placeret</strong> nederst i hvert afsnit og
        indgår ikke i nøgletallene, før du flytter dem. Værktøjet lægger aldrig selv poster sammen.
      </p>
      <p className="sektion-intro">
        Træk en post over på en anden linje for at flytte den — eller klik på posten og derefter
        på linjen. Lander flere poster på samme linje, lægges de sammen. Du kan også trække en hel
        linje over på en anden for at lægge dem sammen, eller trække en post ned under Ikke
        placeret for at tage den ud. Linjer mærket <strong>beregnes</strong> udregnes automatisk.
      </p>

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

      {!poster.length && (
        <div className="besked advarsel">Der er ikke indlæst nogen regnskaber endnu. Indlæs dem under "Indlæs regnskaber".</div>
      )}

      {valgt && (
        <div className="besked valg-flydende">
          Klik på den linje, hvor "{poster.find(p => p.id === valgt)?.label}" skal stå.
          <button className="knap lys" style={{ padding: '2px 8px', fontSize: 12, marginLeft: 8 }} onClick={() => setValgt(null)}>Annullér</button>
          {placering[valgt] && (
            <button className="knap lys" style={{ padding: '2px 8px', fontSize: 12, marginLeft: 6 }} onClick={() => { slip({ type: 'post', id: valgt }, null); setValgt(null) }}>
              Tag ud af analyseformen
            </button>
          )}
        </div>
      )}

      <div className="kort">
        <div className="tabel-omslag">
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: 280 }}>Post</th>
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
              {SECTIONS.map(sec => {
                const regnskabsafsnit = Object.keys(ANALYSEAFSNIT).filter(k => ANALYSEAFSNIT[k] === sec.id)
                const aabne = []
                const daekkede = []
                regnskabsafsnit.forEach(s => {
                  const r = ikkePlacerede(poster, placering, s)
                  aabne.push(...r.aabne)
                  daekkede.push(...r.daekkede)
                })
                const ikkePlaceretMarkering = 'ikke:' + sec.id
                return (
                  <Fragmenter key={sec.id}>
                    <tr className="gruppe"><td colSpan={antalKolonner}>{sec.title}</td></tr>
                    {FIELDS.filter(f => f.section === sec.id).map(f => {
                      const placerede = f.derived ? [] : poster.filter(p => placering[p.id] === f.key)
                      const kanTraekkes = placerede.length > 0
                      return (
                        <Fragmenter key={f.key}>
                          <tr
                            className={(f.derived ? 'sum' : 'modtager') + (over === f.key ? ' traek-over' : '') + (valgt && !f.derived ? ' kan-modtage' : '')}
                            {...(f.derived ? {} : modtagProps(f.key, f.key))}
                            {...(kanTraekkes ? traekProps({ type: 'linje', key: f.key }) : {})}
                            onClick={f.derived ? undefined : () => placerValgt(f.key)}
                            title={kanTraekkes ? 'Træk hele linjen over på en anden linje for at lægge dem sammen' : undefined}
                          >
                            <td>
                              <span className={'postnavn' + (kanTraekkes ? ' traekbar' : '')}>
                                {f.label}
                                {f.derived && <span className="mærkat" title={'Beregnes som: ' + f.derived}>beregnes</span>}
                              </span>
                            </td>
                            {visPrimo && (
                              <td className="num">
                                {PRIMO_FIELDS.includes(f.key)
                                  ? <span className={'tal-vaerdi' + (f.derived ? ' afledt' : '')}>{visTal(primoBeregnet[f.key])}</span>
                                  : <span style={{ color: 'var(--linje)' }}>·</span>}
                              </td>
                            )}
                            {dataset.aar.map((y, i) => (
                              <td key={i} className="num">
                                <span className={'tal-vaerdi' + (f.derived ? ' afledt' : '')} aria-label={`${f.label}, ${y.label || 'år ' + (i + 1)}`}>
                                  {visTal(beregnede[i][f.key])}
                                </span>
                              </td>
                            ))}
                          </tr>
                          {placerede.map(p => postRaekke(p, 'placeret-post', f.key, f.key, (
                            <button
                              className="fjern-placering" aria-label={`Tag ${p.label} ud af ${f.label}`}
                              title="Tag ud af analyseformen" onClick={e => { e.stopPropagation(); slip({ type: 'post', id: p.id }, null) }}
                            >×</button>
                          )))}
                        </Fragmenter>
                      )
                    })}

                    {(aabne.length > 0 || daekkede.length > 0) && (
                      <>
                        <tr
                          className={'ikke-placeret-titel' + (over === ikkePlaceretMarkering ? ' traek-over' : '')}
                          {...modtagProps(null, ikkePlaceretMarkering)}
                        >
                          <td colSpan={antalKolonner}>
                            Ikke placeret · indgår ikke i nøgletallene
                            {aabne.length === 0 && <span className="hjaelp-inline"> — ingen poster mangler at blive taget stilling til</span>}
                          </td>
                        </tr>
                        {aabne.map(p => postRaekke(p, 'ikke-placeret-post', null, ikkePlaceretMarkering))}
                        {daekkede.length > 0 && (
                          <tr className="daekkede-knap">
                            <td colSpan={antalKolonner}>
                              <button className="link-knap" onClick={() => setVisDaekkede(v => ({ ...v, [sec.id]: !v[sec.id] }))}>
                                {visDaekkede[sec.id] ? 'Skjul' : 'Vis'} regnskabets summer og delposter, der allerede er dækket ({daekkede.length})
                              </button>
                            </td>
                          </tr>
                        )}
                        {visDaekkede[sec.id] && daekkede.map(p => postRaekke(p, 'ikke-placeret-post daekket', null, ikkePlaceretMarkering))}
                      </>
                    )}
                  </Fragmenter>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }
