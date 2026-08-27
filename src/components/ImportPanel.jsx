import { useState, useRef, useMemo } from 'react'
import { importerPdf } from '../lib/pdfImport.js'
import { importerIxbrlLink, importerXbrlFil } from '../lib/ixbrlImport.js'
import { fordelKolonner, anvendFordeling } from '../lib/fordeling.js'
import { FIELD_MAP } from '../lib/model.js'

const fmt = n => (n == null ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n))

export default function ImportPanel ({ dataset, setDataset, gaaTilTrin }) {
  const [fund, setFund] = useState([])
  const [status, setStatus] = useState(null)
  const [arbejder, setArbejder] = useState(false)
  const [link, setLink] = useState('')
  const [over, setOver] = useState(false)
  const filInput = useRef(null)

  const fordeling = useMemo(() => (fund.length ? fordelKolonner(fund) : null), [fund])

  async function haandterFiler (filer) {
    setArbejder(true)
    setStatus(null)
    const nye = []
    for (const f of filer) {
      try {
        const erXbrl = /\.(xml|xhtml|html?)$/i.test(f.name)
        const r = erXbrl ? await importerXbrlFil(f) : await importerPdf(f)
        if (!r.kolonner.length) {
          setStatus({ type: 'advarsel', tekst: `${f.name}: ingen regnskabsposter blev genkendt. Indtast tallene i trin 2, eller prøv en iXBRL-adresse i stedet.` })
        }
        nye.push(r)
      } catch (e) {
        setStatus({ type: 'fejl', tekst: `${f.name} kunne ikke læses: ${e.message}` })
      }
    }
    if (nye.length) {
      setFund(f => [...f, ...nye])
      const foerste = nye[0]
      setDataset(d => ({
        ...d,
        virksomhed: d.virksomhed || foerste.virksomhed || '',
        enhed: foerste.enhed || d.enhed
      }))
    }
    setArbejder(false)
  }

  async function haandterLink (e) {
    e.preventDefault()
    if (!link.trim()) return
    setArbejder(true); setStatus(null)
    try {
      const r = await importerIxbrlLink(link.trim())
      if (!r.kolonner.length) {
        setStatus({ type: 'advarsel', tekst: 'Dokumentet blev hentet, men indeholdt ingen genkendte XBRL-poster. Kontrollér at adressen peger på selve iXBRL-filen.' })
      } else {
        setFund(f => [...f, r])
        setDataset(d => ({ ...d, virksomhed: d.virksomhed || r.virksomhed || '', enhed: r.enhed || d.enhed }))
        setLink('')
      }
    } catch (e) {
      setStatus({ type: 'fejl', tekst: e.message })
    }
    setArbejder(false)
  }

  function anvend () {
    setDataset(d => anvendFordeling(d, fordeling))
    setStatus({ type: 'info', tekst: 'Tallene er lagt i skemaet. Kontrollér dem på trin 2.' })
    gaaTilTrin(1)
  }

  function placerEnkelt (kolonne, maal) {
    setDataset(d => {
      const kopi = structuredClone(d)
      if (maal === 'primo') {
        kopi.primo = { ...kopi.primo, ...kolonne.values }
      } else {
        const aar = kopi.aar[maal]
        aar.values = { ...aar.values, ...kolonne.values }
        if (!aar.label || /^År \d$/.test(aar.label)) aar.label = kolonne.navn
      }
      return kopi
    })
    setStatus({ type: 'info', tekst: maal === 'primo' ? 'Kolonnen er lagt ind som primobalance.' : `Kolonnen er lagt i ${dataset.aar[maal].label || 'År ' + (maal + 1)}.` })
  }

  return (
    <>
      <h2 className="sektion-titel">Indlæs tre årsregnskaber</h2>
      <p className="sektion-intro">
        Hvert årsregnskab indeholder to år, så tre regnskaber giver fire balancedatoer.
        De tre nyeste bliver analyseår; det ældste sammenligningsår bliver primobalance og
        indgår kun i gennemsnitstallene. Læg regnskaberne ind som PDF, eller hent dem som
        iXBRL fra Erhvervsstyrelsens offentliggørelser.
      </p>

      <div className="gitter-2">
        <div className="kort">
          <h3>PDF eller XBRL-fil</h3>
          <p className="hjaelp">Træk filerne herned, eller vælg dem. Alle tre på én gang er i orden.</p>
          <div
            className={'filfelt' + (over ? ' over' : '')}
            onDragOver={e => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); haandterFiler([...e.dataTransfer.files]) }}
          >
            <button className="knap lys" onClick={() => filInput.current.click()} disabled={arbejder}>
              {arbejder ? 'Læser …' : 'Vælg filer'}
            </button>
            <p>PDF, XHTML eller XML · op til ca. 30 MB pr. fil</p>
            <input
              ref={filInput} type="file" multiple accept=".pdf,.xml,.xhtml,.html" hidden
              onChange={e => { haandterFiler([...e.target.files]); e.target.value = '' }}
            />
          </div>
        </div>

        <div className="kort">
          <h3>Adresse på iXBRL-dokument</h3>
          <p className="hjaelp">Fx et offentliggjort regnskab fra regnskaber.virk.dk. Adressen hentes gennem sidens egen serverfunktion.</p>
          <form onSubmit={haandterLink}>
            <label className="felt" htmlFor="ixbrl-url">Adresse</label>
            <input id="ixbrl-url" type="url" value={link} placeholder="https://regnskaber.virk.dk/…" onChange={e => setLink(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="knap lys" type="submit" disabled={arbejder || !link.trim()}>Hent regnskab</button>
            </div>
          </form>
        </div>
      </div>

      {status && <div className={'besked ' + (status.type === 'info' ? '' : status.type)}>{status.tekst}</div>}

      {fordeling && <Fordelingskort fordeling={fordeling} anvend={anvend} />}

      {fund.map((f, i) => (
        <details className="kort" key={i}>
          <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
            {f.kilde} — {f.kolonner.length} talkolonne{f.kolonner.length === 1 ? '' : 'r'}
            {f.antalFundne != null && `, ${f.antalFundne} poster genkendt`}
          </summary>
          <p className="hjaelp" style={{ marginTop: 12 }}>Her kan en enkelt kolonne placeres manuelt, hvis den automatiske fordeling ikke rammer.</p>
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr>
                  <th>Post</th>
                  {f.kolonner.map((k, j) => <th key={j} className="num">{k.navn}</th>)}
                </tr>
              </thead>
              <tbody>
                {nogleVigtige(f).map(key => (
                  <tr key={key}>
                    <td>{FIELD_MAP[key]?.label || key}</td>
                    {f.kolonner.map((k, j) => <td key={j} className="num">{fmt(k.values[key])}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  {f.kolonner.map((k, j) => (
                    <td key={j} className="num">
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value !== '') placerEnkelt(k, e.target.value === 'primo' ? 'primo' : Number(e.target.value)) }}
                      >
                        <option value="">Placér i …</option>
                        {dataset.aar.map((a, idx) => <option key={idx} value={idx}>{a.label || `År ${idx + 1}`}</option>)}
                        <option value="primo">Primobalance</option>
                      </select>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      ))}

      <div className="kort">
        <h3>Eller start med et tomt skema</h3>
        <p className="hjaelp">Alle 28 nøgletal kan også beregnes ud fra tal, du selv taster ind.</p>
        <button className="knap lys" onClick={() => gaaTilTrin(1)}>Gå til analyseformen</button>
      </div>
    </>
  )
}

function Fordelingskort ({ fordeling, anvend }) {
  const { aar, primoAar, primo, konflikter, advarsler } = fordeling
  const antalPrimo = Object.keys(primo || {}).length

  return (
    <div className="kort" style={{ borderColor: 'var(--petrol)' }}>
      <h3>Sådan fordeles årene</h3>
      <p className="hjaelp">Tjek tidslinjen, før tallene lægges i skemaet.</p>

      <div className="tidslinje">
        {primoAar
          ? (
            <div className="tidslinje-punkt primo">
              <span className="aarstal">{primoAar}</span>
              <span className="rolle">Primobalance</span>
              <span className="detalje">{antalPrimo} poster · kun til gennemsnit</span>
            </div>
            )
          : (
            <div className="tidslinje-punkt tom">
              <span className="aarstal">?</span>
              <span className="rolle">Primobalance mangler</span>
              <span className="detalje">Gennemsnitstal bliver skøn</span>
            </div>
            )}
        {aar.map((a, i) => (
          <div className="tidslinje-punkt" key={i}>
            <span className="aarstal">{a.label}</span>
            <span className="rolle">Analyseår {i + 1}</span>
            <span className="detalje">{Object.keys(a.values).length} poster · {a.kilder.length > 1 ? `${a.kilder.length} kilder` : 'én kilde'}</span>
          </div>
        ))}
      </div>

      {advarsler.map((a, i) => <div className="besked advarsel" key={i}>{a}</div>)}

      {konflikter.length > 0 && (
        <div className="besked advarsel">
          <strong>{konflikter.length} tal er læst forskelligt i to regnskaber.</strong> Det sker,
          når en post er tilpasset i sammenligningstallene — eller når en PDF er læst forkert.
          Tallet fra det regnskab, hvor året er hovedår, er valgt.
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {konflikter.slice(0, 6).map((k, i) => (
              <li key={i} style={{ fontSize: 12 }}>
                {k.aar}, {k.label}: <span className="tal">{fmt(k.valgt)}</span> mod <span className="tal">{fmt(k.anden)}</span>
              </li>
            ))}
            {konflikter.length > 6 && <li style={{ fontSize: 12 }}>… og {konflikter.length - 6} mere</li>}
          </ul>
        </div>
      )}

      <button className="knap primaer" onClick={anvend} style={{ marginTop: 6 }}>
        Læg tallene i skemaet
      </button>
    </div>
  )
}

const VIGTIGE = ['omsaetning', 'bruttoresultat', 'resultatPrimaerDrift', 'aaretsResultat', 'anlaegsaktiver', 'omsaetningsaktiver', 'aktiverIAlt', 'egenkapital', 'kortfristetGaeld']

function nogleVigtige (f) {
  const set = new Set()
  f.kolonner.forEach(k => Object.keys(k.values).forEach(key => set.add(key)))
  const fundne = [...set]
  const vigtige = VIGTIGE.filter(k => set.has(k))
  const resten = fundne.filter(k => !vigtige.includes(k))
  return [...vigtige, ...resten].slice(0, 14)
}
