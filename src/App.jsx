import { useEffect, useMemo, useState } from 'react'
import ImportPanel from './components/ImportPanel.jsx'
import DataGrid from './components/DataGrid.jsx'
import NogletalKort from './components/NogletalKort.jsx'
import { emptyDataset, FIELDS, SECTIONS } from './lib/model.js'
import { NOGLETAL, OMRAADER, beregnAlle, byggIndeksNogletal, formatVaerdi } from './lib/nogletal.js'
import { hentExcel } from './lib/exportExcel.js'
import { hentWord } from './lib/exportWord.js'
import { EKSEMPEL } from './lib/eksempel.js'

// v2: en række rettelser (fjernelse af automatisk sammenlægning af
// lønposter, af at nye tal blev blandet med gamle ved indlæsning, m.m.)
// kan have efterladt forkerte tal i ældre gemte data. Ved at skifte nøgle
// ignoreres alt gemt under v1 automatisk, så alle starter med et rent,
// korrekt udgangspunkt i stedet for at bære en tidligere fejl videre.
const NOEGLE = 'regnskabsanalyse-data-v2'
const NOEGLE_FUND = 'regnskabsanalyse-fund-v2'

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
  // Ligger her (og ikke i ImportPanel) så de indlæste regnskaber, det indtastede
  // CVR-nummer og søgeresultatet ikke forsvinder, hvis man går videre til et
  // andet trin og siden vender tilbage for at rette i dem. Gemmes også i
  // localStorage: uden det ville "Sådan fordeles årene" forsvinde ved en
  // genindlæsning af siden, selvom de anvendte tal i Omform (dataset) består —
  // og så ville Omforms tal ikke længere kunne eftervises mod den tabel, de
  // stammer fra.
  const [fund, setFund] = useState(() => {
    try {
      const gemt = localStorage.getItem(NOEGLE_FUND)
      if (gemt) return JSON.parse(gemt)
    } catch { /* faldbagud til ingen indlæste regnskaber */ }
    return []
  })
  const [cvr, setCvr] = useState('')
  const [traf, setTraf] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(NOEGLE, JSON.stringify(dataset)) } catch { /* fx privat browsing */ }
  }, [dataset])

  useEffect(() => {
    try { localStorage.setItem(NOEGLE_FUND, JSON.stringify(fund)) } catch { /* fx privat browsing */ }
  }, [fund])

  const ekstraNogletal = useMemo(() => byggIndeksNogletal(dataset), [dataset.indeksFelter, dataset.indeksFelt])
  const resultater = useMemo(() => beregnAlle(dataset, ekstraNogletal), [dataset, ekstraNogletal])
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
    setFund([])
    setCvr('')
    setTraf(null)
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
            <button className="knap" onClick={() => { setDataset(EKSEMPEL()); setFund([]); setTraf(null) }}>Indlæs eksempel</button>
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

        {trin === 0 && (
          <ImportPanel
            dataset={dataset} setDataset={setDataset} gaaTilTrin={setTrin}
            fund={fund} setFund={setFund} cvr={cvr} setCvr={setCvr} traf={traf} setTraf={setTraf}
          />
        )}
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

            {OMRAADER.map(o => {
              const gruppeNogletal = NOGLETAL.filter(n => n.omraade === o.id)
              return (
                <section key={o.id}>
                  <div className="omraade-overskrift">
                    <h2>{o.title}</h2>
                    <span className="antal">nøgletal {o.nrs[0]}–{o.nrs[o.nrs.length - 1]}</span>
                  </div>
                  <NogletalTabel nogletal={gruppeNogletal} resultater={resultater} aarNavne={aarNavne} enhed={dataset.enhed} />
                  <div className="nogletal-gitter" style={{ '--nt-kolonner': optimalKolonner(gruppeNogletal.length) }}>
                    {gruppeNogletal.map(n => (
                      <NogletalKort
                        key={n.nr} nogletal={n} resultater={resultater}
                        aarNavne={aarNavne} enhed={dataset.enhed}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            <div className="kort udskriv-skjul">
              <label className="felt">Indekstal (nøgletal 8) beregnes på</label>
              <p className="hjaelp" style={{ marginTop: -6 }}>Vælg én eller flere poster. Der beregnes et eget indekstal for hver post — de vises nedenfor.</p>
              <div className="indeks-poster">
                {SECTIONS.filter(sec => sec.id !== 'ovrigt').map(sec => (
                  <div className="indeks-gruppe" key={sec.id}>
                    <div className="indeks-gruppe-titel">{sec.title}</div>
                    <div className="indeks-gruppe-felter">
                      {FIELDS.filter(f => f.section === sec.id).map(f => {
                        const valgte = Array.isArray(dataset.indeksFelter) ? dataset.indeksFelter : [dataset.indeksFelt || 'omsaetning']
                        const valgt = valgte.includes(f.key)
                        return (
                          <label key={f.key} className="indeks-post">
                            <input
                              type="checkbox" checked={valgt}
                              onChange={e => setDataset(d => {
                                const nuvaerende = Array.isArray(d.indeksFelter) ? d.indeksFelter : [d.indeksFelt || 'omsaetning']
                                const nye = e.target.checked ? [...nuvaerende, f.key] : nuvaerende.filter(k => k !== f.key)
                                return { ...d, indeksFelter: nye }
                              })}
                            />
                            {f.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <select
                style={{ marginTop: 12 }}
                value={dataset.indeksBasisaar ?? 0}
                onChange={e => setDataset(d => ({ ...d, indeksBasisaar: Number(e.target.value) }))}
                aria-label="Basisår for indekstal"
              >
                {aarNavne.map((a, i) => <option key={i} value={i}>Basisår: {a}</option>)}
              </select>
            </div>

            {ekstraNogletal.length > 0 && (
              <section>
                <div className="omraade-overskrift">
                  <h2>Indekstal</h2>
                  <span className="antal">nøgletal 8</span>
                </div>
                <NogletalTabel nogletal={ekstraNogletal} resultater={resultater} aarNavne={aarNavne} enhed={dataset.enhed} />
                <div className="nogletal-gitter" style={{ '--nt-kolonner': optimalKolonner(ekstraNogletal.length) }}>
                  {ekstraNogletal.map(n => (
                    <NogletalKort
                      key={n.nr} nogletal={n} resultater={resultater}
                      aarNavne={aarNavne} enhed={dataset.enhed}
                    />
                  ))}
                </div>
              </section>
            )}

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

// Vælger det bedste antal kolonner (højst 3), så graferne fordeler sig så
// jævnt som muligt: tre i bredden, medmindre gruppens antal går bedre op
// med to (fx 4 grafer bliver 2+2 i stedet for 3+1 med en ensom sidste graf).
function optimalKolonner (antal, maks = 3) {
  if (antal <= maks) return Math.max(antal, 1)
  for (let k = maks; k >= 2; k--) {
    const rest = antal % k
    if (rest === 0 || rest >= 2) return k
  }
  return maks
}

// Sammendrag af en gruppes nøgletal for alle år, vist over graferne, så
// tallene kan aflæses samlet, før man kigger på udviklingen i den enkelte graf.
function NogletalTabel ({ nogletal, resultater, aarNavne, enhed }) {
  const harSkoen = nogletal.some(n => resultater.some(r => r[n.nr].skoen))
  return (
    <div className="tabel-omslag">
      <table className="data">
        <thead>
          <tr>
            <th>Nøgletal</th>
            {aarNavne.map((a, i) => <th key={i} className="num">{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {nogletal.map(n => (
            <tr key={n.nr}>
              <td>{typeof n.nr === 'number' && `${n.visNr ?? n.nr}. `}{n.navn}</td>
              {resultater.map((r, i) => (
                <td key={i} className="num">
                  {formatVaerdi(n, r[n.nr].value, enhed)}
                  {r[n.nr].skoen && <span className="skoen-mærke" title="Beregnet på ultimotal, fordi primobalancen mangler">*</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {harSkoen && <p className="hjaelp" style={{ marginTop: 6 }}>* Skøn — beregnet på ultimotal, fordi primobalancen mangler.</p>}
    </div>
  )
}
