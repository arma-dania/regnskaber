import { useState, useRef, useMemo } from 'react'
import { importerPdf } from '../lib/pdfImport.js'
import { importerIxbrlLink, importerXbrlFil, soegRegnskaber, diagnostikTekst } from '../lib/ixbrlImport.js'
import { fordelKolonner, anvendFordeling } from '../lib/fordeling.js'
import { FIELDS, FIELD_MAP, SECTIONS } from '../lib/model.js'

const fmt = n => (n == null ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(n))

export default function ImportPanel ({ dataset, setDataset, gaaTilTrin, fund, setFund, cvr, setCvr, traf, setTraf }) {
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
          const forklaring = erXbrl ? diagnostikTekst(r.diagnostik) : 'Indtast tallene i trin 2, eller prøv en iXBRL-adresse i stedet.'
          setStatus({ type: 'advarsel', tekst: `${f.name}: ingen regnskabsposter blev genkendt. ${forklaring}` })
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
        setStatus({ type: 'advarsel', tekst: `Dokumentet blev hentet, men indeholdt ingen genkendte XBRL-poster. ${diagnostikTekst(r.diagnostik)}` })
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

  async function soeg (e) {
    e.preventDefault()
    const rent = cvr.replace(/\D/g, '')
    if (rent.length !== 8) { setStatus({ type: 'fejl', tekst: 'Et CVR-nummer er otte cifre.' }); return }
    setArbejder(true); setStatus(null); setTraf(null)
    try {
      const liste = await soegRegnskaber(rent)
      if (!liste.length) setStatus({ type: 'advarsel', tekst: 'Der blev ikke fundet offentliggjorte regnskaber på det CVR-nummer.' })
      setTraf(liste)
    } catch (e) {
      setStatus({ type: 'fejl', tekst: e.message })
    }
    setArbejder(false)
  }

  async function hentFraTraef (liste) {
    setArbejder(true); setStatus(null)
    const nye = []
    const advarsler = []
    for (const r of liste) {
      if (!r.xbrl) continue
      try {
        const d = await importerIxbrlLink(r.xbrl)
        if (!d.kolonner.length) {
          advarsler.push(`Årsrapport ${r.aar}: ingen regnskabsposter blev genkendt. ${diagnostikTekst(d.diagnostik)}`)
        }
        nye.push({ ...d, kilde: `Årsrapport ${r.aar}` })
      } catch (e) {
        advarsler.push(`Årsrapport ${r.aar}: ${e.message}`)
      }
    }
    if (nye.length) {
      setFund(f => [...f, ...nye])
      setDataset(d => ({ ...d, virksomhed: d.virksomhed || nye[0].virksomhed || '' }))
    }
    if (advarsler.length) {
      setStatus({ type: nye.length ? 'advarsel' : 'fejl', tekst: advarsler.join(' ') })
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
        aar.sammensat = { ...(aar.sammensat || {}), ...(kolonne.sammensat || {}) }
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
          <h3>Slå op på CVR-nummer</h3>
          <p className="hjaelp">Den nemmeste vej: appen finder selv de offentliggjorte årsrapporter og deres XBRL-dokumenter.</p>
          <form onSubmit={soeg}>
            <label className="felt" htmlFor="cvr">CVR-nummer</label>
            <input id="cvr" type="text" inputMode="numeric" value={cvr} placeholder="12345678"
              onChange={e => setCvr(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="knap lys" type="submit" disabled={arbejder}>
                {arbejder ? 'Søger …' : 'Find årsrapporter'}
              </button>
            </div>
          </form>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--daempet)' }}>Eller indsæt en dokumentadresse direkte</summary>
            <form onSubmit={haandterLink} style={{ marginTop: 10 }}>
              <input type="url" value={link} placeholder="http://regnskaber.virk.dk/12345678/….xml"
                onChange={e => setLink(e.target.value)} />
              <p className="hjaelp" style={{ marginTop: 6 }}>
                Adressen skal pege på selve XBRL-dokumentet — typisk en .xml-fil, fx
                http://regnskaber.virk.dk/12345678/….xml. Et link kopieret fra en "download"-knap på
                datacvr.virk.dk (adresser med /gateway/) virker ikke her — brug CVR-opslaget ovenfor i stedet.
              </p>
              <button className="knap lys" type="submit" disabled={arbejder || !link.trim()} style={{ marginTop: 8 }}>Hent regnskab</button>
            </form>
          </details>
        </div>
      </div>

      {status && <div className={'besked ' + (status.type === 'info' ? '' : status.type)}>{status.tekst}</div>}

      {traf && traf.length > 0 && (
        <div className="kort">
          <h3>Offentliggjorte årsrapporter</h3>
          <p className="hjaelp">Vælg de tre nyeste, eller hent en enkelt.</p>
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr><th>Regnskabsår</th><th>Periode</th><th>Offentliggjort</th><th>Format</th><th /></tr>
              </thead>
              <tbody>
                {traf.map((r, i) => (
                  <tr key={i}>
                    <td className="tal">{r.aar || '–'}</td>
                    <td style={{ fontSize: 13 }}>{r.start && r.slut ? `${r.start} → ${r.slut}` : '–'}</td>
                    <td style={{ fontSize: 13 }}>{(r.offentliggjort || '').slice(0, 10)}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.xbrl ? 'XBRL' : ''}{r.xbrl && r.pdf ? ' · ' : ''}
                      {r.pdf && <a href={r.pdf} target="_blank" rel="noreferrer">PDF</a>}
                    </td>
                    <td className="num">
                      <button className="knap lys" style={{ padding: '4px 10px', fontSize: 12 }}
                        disabled={!r.xbrl || arbejder} onClick={() => hentFraTraef([r])}>Hent</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="knap primaer" style={{ marginTop: 12 }} disabled={arbejder}
            onClick={() => hentFraTraef(traf.filter(r => r.xbrl).slice(0, 3))}>
            Hent de tre nyeste med XBRL
          </button>
        </div>
      )}

      {fordeling && <Fordelingskort fordeling={fordeling} anvend={anvend} />}

      {fund.length > 0 && !fordeling && (
        <div className="besked advarsel">
          Ingen af de {fund.length} indlæste dokumenter indeholdt regnskabsposter, der kunne
          genkendes, så der kan endnu ikke vises en samlet tabel. Se forklaringen ud for hvert
          dokument nedenfor, eller indtast tallene i trin 2.
        </div>
      )}

      {fund.length > 0 && fordeling && (
        <p className="hjaelp" style={{ marginTop: -6 }}>
          Tabellen ovenfor viser de fordelte tal. Her nedenfor er hvert regnskabs egne,
          rå kolonner — til at kontrollere kilden eller placere en enkelt kolonne manuelt,
          hvis den automatiske fordeling ikke rammer.
        </p>
      )}

      {fund.map((f, i) => (
        <details className="kort" key={i}>
          <summary style={{ cursor: 'pointer', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>
              {f.kilde} — {f.kolonner.length} talkolonne{f.kolonner.length === 1 ? '' : 'r'}
              {f.antalFundne != null && `, ${f.antalFundne} poster genkendt`}
            </span>
            <button
              type="button" className="knap lys" style={{ padding: '2px 10px', fontSize: 12 }}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setFund(nu => nu.filter((_, idx) => idx !== i)) }}
            >
              Fjern
            </button>
          </summary>
          {!f.kolonner.length && (
            <p className="hjaelp">
              {f.diagnostik ? diagnostikTekst(f.diagnostik) : 'Ingen regnskabsposter blev genkendt i dokumentet. Indtast tallene i trin 2.'}
            </p>
          )}
          <div className="tabel-omslag">
            <table className="data">
              <thead>
                <tr>
                  <th>Post</th>
                  {f.kolonner.map((k, j) => <th key={j} className="num">{k.navn}</th>)}
                </tr>
              </thead>
              <tbody>
                {alleFundne(f).map(key => (
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
  const { aar, primoAar, primo, advarsler } = fordeling
  const antalPrimo = Object.keys(primo || {}).length

  const kolonner = [
    { label: primoAar ? `Primo ${primoAar}` : 'Primo', values: primo || {} },
    ...aar.map(a => ({ label: a.label, values: a.values }))
  ]

  return (
    <div className="kort" style={{ borderColor: 'var(--petrol)' }}>
      <h3>Sådan fordeles årene</h3>
      <p className="hjaelp">Tjek tidslinjen og tallene, før de lægges i skemaet.</p>

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

      <div className="tabel-omslag" style={{ marginTop: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Post</th>
              {kolonner.map((k, i) => <th key={i} className="num">{k.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(sec => {
              const felter = FIELDS.filter(f => f.section === sec.id && kolonner.some(k => k.values[f.key] != null))
              if (!felter.length) return null
              return (
                <Fragmenter key={sec.id}>
                  <tr className="gruppe"><td colSpan={1 + kolonner.length}>{sec.title}</td></tr>
                  {felter.map(f => (
                    <tr key={f.key}>
                      <td>{f.label}</td>
                      {kolonner.map((k, i) => <td key={i} className="num">{fmt(k.values[f.key])}</td>)}
                    </tr>
                  ))}
                </Fragmenter>
              )
            })}
          </tbody>
        </table>
      </div>

      {advarsler.map((a, i) => <div className="besked advarsel" key={i}>{a}</div>)}

      <button className="knap primaer" onClick={anvend} style={{ marginTop: 16 }}>
        Læg tallene i skemaet
      </button>
    </div>
  )
}

// Lille hjælper, så tabelrækker kan grupperes uden ekstra DOM-element.
function Fragmenter ({ children }) { return <>{children}</> }

const VIGTIGE = ['omsaetning', 'bruttoresultat', 'resultatPrimaerDrift', 'aaretsResultat', 'anlaegsaktiver', 'omsaetningsaktiver', 'aktiverIAlt', 'egenkapital', 'kortfristetGaeld']

// Alle genkendte poster, med de vigtigste øverst. Ingen grænse — brugeren skal
// se regnskabstallene, som de er læst, ikke kun et udvalg.
function alleFundne (f) {
  const set = new Set()
  f.kolonner.forEach(k => Object.keys(k.values).forEach(key => set.add(key)))
  const fundne = [...set]
  const vigtige = VIGTIGE.filter(k => set.has(k))
  const resten = fundne.filter(k => !vigtige.includes(k))
  return [...vigtige, ...resten]
}
