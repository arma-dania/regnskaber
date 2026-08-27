import { useState } from 'react'
import { FIELDS, SECTIONS, PRIMO_FIELDS, withDerived, validate } from '../lib/model.js'
import { parseDanskTal } from '../lib/pdfImport.js'

const visTal = n => (n == null || Number.isNaN(n) ? '' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(n))

export default function DataGrid ({ dataset, setDataset }) {
  const [visPrimo, setVisPrimo] = useState(() => Object.keys(dataset.primo || {}).length > 0)
  const noter = validate(dataset)

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
        Kursiverede grå tal er beregnet ud fra posterne over dem. Står der et tal med okker,
        kommer det fra regnskabet eller fra dig, og det bliver aldrig regnet om — bruttofortjeneste
        i et klasse B-regnskab er jo ikke altid omsætning minus vareforbrug. Tøm feltet, hvis posten
        alligevel skal beregnes. Omkostninger indtastes som positive tal.
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
                    <tr key={f.key} className={f.derived ? 'sum' : ''}>
                      <td>
                        <span className="postnavn">
                          {f.label}
                          {f.derived && <span className="mærkat" title={'Beregnes som: ' + f.derived}>beregnes</span>}
                        </span>
                      </td>
                      {visPrimo && (
                        <td className="num">
                          {PRIMO_FIELDS.includes(f.key)
                            ? <input type="text" inputMode="decimal" value={visTal(dataset.primo?.[f.key])}
                                onChange={e => saetPrimo(f.key, e.target.value)}
                                aria-label={`${f.label}, primo`} />
                            : <span style={{ color: 'var(--linje)' }}>·</span>}
                        </td>
                      )}
                      {dataset.aar.map((y, i) => {
                        const eksplicit = y.values[f.key] != null
                        const vaerdi = eksplicit ? y.values[f.key] : beregnede[i][f.key]
                        return (
                          <td key={i} className="num">
                            <input
                              type="text" inputMode="decimal"
                              className={f.derived ? (eksplicit ? 'manuel' : 'afledt') : ''}
                              value={visTal(vaerdi)}
                              onChange={e => saet(i, f.key, e.target.value)}
                              aria-label={`${f.label}, ${y.label || 'år ' + (i + 1)}`}
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
