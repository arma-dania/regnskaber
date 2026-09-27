import { useState } from 'react'
import { FIELDS, FIELD_MAP, SECTIONS, PRIMO_FIELDS, REGNSKABSAFSNIT, withDerived, validate, placerPost } from '../lib/model.js'

const visTal = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n))

export default function DataGrid ({ dataset, setDataset }) {
  const [visPrimo, setVisPrimo] = useState(() => Object.keys(dataset.primoPoster || {}).length > 0)
  const [traekker, setTraekker] = useState(null)
  const [over, setOver] = useState(null)
  const [valgt, setValgt] = useState(null)
  const noter = validate(dataset)

  const poster = dataset.poster || []
  const placering = dataset.placering || {}
  const antalPlaceret = poster.filter(p => placering[p.id]).length
  const nyeste = [...dataset.aar].reverse().find(y => Object.keys(y.poster || {}).length) || null
  const beregnede = dataset.aar.map(y => withDerived(y.values))
  const primoBeregnet = withDerived(dataset.primo || {})

  const placer = (postId, key) => setDataset(d => placerPost(d, postId, key))

  const traekProps = p => ({
    draggable: true,
    onDragStart: e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setTraekker(p.id) },
    onDragEnd: () => { setTraekker(null); setOver(null) }
  })

  // 'regnskab' = listen over regnskabets poster; at slippe dér fjerner placeringen.
  const modtagProps = key => ({
    onDragOver: e => { if (traekker) { e.preventDefault(); setOver(key) } },
    onDragLeave: () => setOver(o => (o === key ? null : o)),
    onDrop: e => {
      e.preventDefault()
      const id = traekker || e.dataTransfer.getData('text/plain')
      if (id) placer(id, key === 'regnskab' ? null : key)
      setTraekker(null); setOver(null)
    }
  })

  const vaelg = id => setValgt(v => (v === id ? null : id))
  const placerValgt = key => { if (valgt) { placer(valgt, key); setValgt(null) } }

  const saetAarLabel = (i, tekst) => setDataset(d => {
    const kopi = structuredClone(d)
    kopi.aar[i].label = tekst
    return kopi
  })

  const antalKolonner = 1 + (visPrimo ? 1 : 0) + dataset.aar.length

  return (
    <>
      <h2 className="sektion-titel">Regnskabet i analyseform</h2>
      <p className="sektion-intro">
        Her omformer du selv regnskabet til analysebrug. Til venstre står regnskabets egne
        poster, præcis som de er indlæst. Træk hver post over på den linje i analyseformen, hvor
        den hører hjemme — eller klik på posten og derefter på linjen. Lægger du flere poster på
        samme linje, lægges de sammen. En placeret post kan trækkes videre til en anden linje
        eller tilbage til listen.
      </p>
      <p className="sektion-intro">
        Linjer mærket <strong>beregnes</strong> (grå kursiv) udregnes automatisk ud fra de andre
        linjer. Regnskabets egne sumposter står med fed — placér enten summen eller de poster,
        den består af, ikke begge. Tallene kan ikke rettes her; de kommer fra de indlæste regnskaber.
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

      <div className="omform">
        <div className={'kort omform-poster' + (over === 'regnskab' ? ' traek-over' : '')} {...modtagProps('regnskab')}>
          <h3>Regnskabets poster</h3>
          <p className="hjaelp">{antalPlaceret} af {poster.length} placeret{nyeste?.label ? ` · tal for ${nyeste.label}` : ''}</p>
          {REGNSKABSAFSNIT.map(afs => {
            const liste = poster.filter(p => p.sektion === afs.id)
            if (!liste.length) return null
            return (
              <div key={afs.id} className="omform-afsnit">
                <div className="omform-afsnit-titel">{afs.title}</div>
                {liste.map(p => (
                  <div
                    key={p.id} role="button" tabIndex={0} aria-pressed={valgt === p.id}
                    className={'regnskabspost' + (p.erSum ? ' sum' : '') + (placering[p.id] ? ' placeret' : '') + (valgt === p.id ? ' valgt' : '')}
                    title={placering[p.id] ? `Placeret på ${FIELD_MAP[placering[p.id]]?.label}` : 'Træk til en linje i analyseformen'}
                    onClick={() => vaelg(p.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); vaelg(p.id) } }}
                    {...traekProps(p)}
                  >
                    <span className="regnskabspost-navn">
                      {p.label}
                      {placering[p.id] && <span className="regnskabspost-placering">→ {FIELD_MAP[placering[p.id]]?.label}</span>}
                    </span>
                    <span className="regnskabspost-tal">{visTal(nyeste?.poster?.[p.id])}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="kort">
          {valgt && (
            <div className="besked">
              Klik på den linje i analyseformen, hvor "{poster.find(p => p.id === valgt)?.label}" skal placeres.
              {placering[valgt] && (
                <button className="knap lys" style={{ padding: '2px 8px', fontSize: 12, marginLeft: 8 }} onClick={() => { placer(valgt, null); setValgt(null) }}>
                  Fjern placering
                </button>
              )}
            </div>
          )}
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Analyseform</th>
                  {visPrimo && <th className="num" style={{ width: 120 }}>Primo</th>}
                  {dataset.aar.map((y, i) => (
                    <th key={i} className="num" style={{ width: 140 }}>
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
                    <tr className="gruppe"><td colSpan={antalKolonner}>{sec.title}</td></tr>
                    {FIELDS.filter(f => f.section === sec.id).map(f => {
                      const placerede = f.derived ? [] : poster.filter(p => placering[p.id] === f.key)
                      return (
                        <Fragmenter key={f.key}>
                          <tr
                            className={(f.derived ? 'sum' : 'modtager') + (over === f.key ? ' traek-over' : '') + (valgt && !f.derived ? ' kan-modtage' : '')}
                            {...(f.derived ? {} : modtagProps(f.key))}
                            onClick={f.derived ? undefined : () => placerValgt(f.key)}
                          >
                            <td>
                              <span className="postnavn">
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
                          {placerede.map(p => (
                            <tr key={p.id} className={'placeret-post' + (valgt === p.id ? ' valgt' : '')} {...traekProps(p)}>
                              <td>
                                <span className="postnavn traekbar" onClick={() => vaelg(p.id)}>
                                  ↳ {p.label}
                                  <button
                                    className="fjern-placering" aria-label={`Fjern ${p.label} fra ${f.label}`}
                                    title="Fjern placering" onClick={e => { e.stopPropagation(); placer(p.id, null) }}
                                  >×</button>
                                </span>
                              </td>
                              {visPrimo && <td className="num">{PRIMO_FIELDS.includes(f.key) ? visTal(dataset.primoPoster?.[p.id]) : ''}</td>}
                              {dataset.aar.map((y, i) => <td key={i} className="num">{visTal(y.poster?.[p.id])}</td>)}
                            </tr>
                          ))}
                        </Fragmenter>
                      )
                    })}
                  </Fragmenter>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }
