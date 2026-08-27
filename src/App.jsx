import { useEffect, useMemo, useState } from 'react'
import ImportPanel from './components/ImportPanel.jsx'
import DataGrid from './components/DataGrid.jsx'
import NogletalKort from './components/NogletalKort.jsx'
import { emptyDataset, FIELDS } from './lib/model.js'
import { NOGLETAL, OMRAADER, beregnAlle } from './lib/nogletal.js'
import { hentExcel } from './lib/exportExcel.js'
import { hentWord } from './lib/exportWord.js'
import { EKSEMPEL } from './lib/eksempel.js'

const NOEGLE = 'regnskabsanalyse-data-v1'

const TRIN = [
  { id: 0, navn: 'Indlæs regnskaber' },
  { id: 1, navn: 'Analyseform' },
  { id: 2, navn: 'Nøgletal og grafer' }
]

export default function App () {
  const [dataset, setDataset] = useState(() => {
    try {
      const gemt = localStorage.getItem(NOEGLE)
      if (gemt) return { ...emptyDataset(), ...JSON.parse(gemt) }
    } catch { /* faldbagud til tomt skema */ }
    return emptyDataset()
  })
  const [trin, setTrin] = useState(0)
  const [travl, setTravl] = useState(null)
  const [kvittering, setKvittering] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(NOEGLE, JSON.stringify(dataset)) } catch { /* fx privat browsing */ }
  }, [dataset])

  const resultater = useMemo(() => beregnAlle(dataset), [dataset])
  const aarNavne = dataset.aar.map((y, i) => y.label || `År ${i + 1}`)
  const harData = dataset.aar.some(y => FIELDS.some(f => y.values[f.key] != null))

  async function eksporterWord () {
    if (trin !== 2) {
      setTrin(2)
      setKvittering('Graferne skal være tegnet, før de kan lægges i Word. Tryk igen om et øjeblik.')
      return
    }
    setTravl('word'); setKvittering(null)
    try {
      const navn = await hentWord(dataset)
      setKvittering(`${navn} er hentet.`)
    } catch (e) {
      setKvittering('Word-dokumentet kunne ikke dannes: ' + e.message)
    }
    setTravl(null)
  }

  function eksporterExcel () {
    setTravl('excel'); setKvittering(null)
    try {
      const navn = hentExcel(dataset)
      setKvittering(`${navn} er hentet.`)
    } catch (e) {
      setKvittering('Excel-filen kunne ikke dannes: ' + e.message)
    }
    setTravl(null)
  }

  function nulstil () {
    if (!confirm('Alle indtastede tal slettes. Fortsæt?')) return
    setDataset(emptyDataset())
    setTrin(0)
    setKvittering('Skemaet er tømt.')
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-indhold">
          <h1>Regnskabsanalyse</h1>
          <span className="undertekst">28 nøgletal · 5 analyseområder · 3 år</span>
          <div className="topbar-handlinger">
            <button className="knap" onClick={() => setDataset(EKSEMPEL())}>Indlæs eksempel</button>
            <button className="knap" onClick={nulstil}>Tøm skema</button>
            <button className="knap" onClick={eksporterExcel} disabled={!harData || travl === 'excel'}>
              {travl === 'excel' ? 'Danner …' : 'Hent Excel'}
            </button>
            <button className="knap primaer" onClick={eksporterWord} disabled={!harData || travl === 'word'}>
              {travl === 'word' ? 'Danner …' : 'Hent Word'}
            </button>
          </div>
        </div>
        <nav className="trin-navigation" aria-label="Trin">
          {TRIN.map(t => (
            <button
              key={t.id} className="trin-knap" aria-current={trin === t.id}
              onClick={() => setTrin(t.id)}
            >
              <span className="nummer">{t.id + 1}</span>{t.navn}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {kvittering && <div className="besked">{kvittering}</div>}

        {trin === 0 && <ImportPanel dataset={dataset} setDataset={setDataset} gaaTilTrin={setTrin} />}
        {trin === 1 && (
          <>
            <DataGrid dataset={dataset} setDataset={setDataset} />
            <button className="knap lys" onClick={() => setTrin(2)}>Se nøgletallene</button>
          </>
        )}
        {trin === 2 && (
          <>
            <h2 className="sektion-titel">{dataset.virksomhed || 'Nøgletal'}</h2>
            <p className="sektion-intro">
              Beløb i {dataset.enhed}. Grafen under hvert nøgletal viser {aarNavne.join(', ')}.
              Word-dokumentet indeholder de samme grafer plus et tomt kommentarfelt til hvert nøgletal.
            </p>

            <div className="kort udskriv-skjul">
              <label className="felt" htmlFor="indeksfelt">Indekstal (nøgletal 8) beregnes på</label>
              <div className="gitter-2">
                <select
                  id="indeksfelt" value={dataset.indeksFelt || 'omsaetning'}
                  onChange={e => setDataset(d => ({ ...d, indeksFelt: e.target.value }))}
                >
                  {FIELDS.filter(f => f.section !== 'ovrigt').map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select
                  value={dataset.indeksBasisaar ?? 0}
                  onChange={e => setDataset(d => ({ ...d, indeksBasisaar: Number(e.target.value) }))}
                  aria-label="Basisår for indekstal"
                >
                  {aarNavne.map((a, i) => <option key={i} value={i}>Basisår: {a}</option>)}
                </select>
              </div>
            </div>

            {OMRAADER.map(o => (
              <section key={o.id}>
                <div className="omraade-overskrift">
                  <h2>{o.title}</h2>
                  <span className="antal">nøgletal {o.nrs[0]}–{o.nrs[o.nrs.length - 1]}</span>
                </div>
                <div className="nogletal-gitter">
                  {NOGLETAL.filter(n => n.omraade === o.id).map(n => (
                    <NogletalKort
                      key={n.nr} nogletal={n} resultater={resultater}
                      aarNavne={aarNavne} enhed={dataset.enhed}
                    />
                  ))}
                </div>
              </section>
            ))}

            <p className="fodnote" style={{ marginTop: 30 }}>
              Nøgletal markeret som skøn er beregnet på ultimotal, fordi primobalancen mangler.
              Med tre årsregnskaber leverer det ældste sammenligningsår den fjerde balancedato,
              og så er gennemsnittene rigtige hele vejen igennem. Selve vurderingen af tallene er din egen – appen regner, den konkluderer ikke.
            </p>
          </>
        )}
      </main>
    </>
  )
}
