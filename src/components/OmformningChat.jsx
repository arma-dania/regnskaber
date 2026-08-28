import { useState } from 'react'
import { spoergOmOmformning } from '../lib/aiOmformning.js'

export default function OmformningChat ({ dataset }) {
  const [meddelelser, setMeddelelser] = useState([])
  const [tekst, setTekst] = useState('')
  const [arbejder, setArbejder] = useState(false)
  const [fejl, setFejl] = useState(null)

  async function send (e) {
    e.preventDefault()
    const besked = tekst.trim()
    if (!besked || arbejder) return
    const nye = [...meddelelser, { rolle: 'bruger', tekst: besked }]
    setMeddelelser(nye)
    setTekst('')
    setArbejder(true)
    setFejl(null)
    try {
      const svar = await spoergOmOmformning(nye, dataset)
      setMeddelelser(m => [...m, { rolle: 'ai', tekst: svar }])
    } catch (fejlOmError) {
      setFejl(fejlOmError.message)
    }
    setArbejder(false)
  }

  return (
    <div className="kort udskriv-skjul">
      <h3>Spørg om omformningen</h3>
      <p className="hjaelp">
        Skemaet ovenfor viser regnskabets tal, sådan som appen foreslår at lægge dem om til
        analyseform — kursiverede poster er beregnet, okkerfarvede er rettet af dig eller læst
        direkte fra regnskabet, og Σ-poster er lagt sammen af enkeltposter ved importen. Skriv
        herunder, hvis du er i tvivl om en post, fx om noget bør flyttes eller lægges sammen.
        AI'en retter ikke selv tallene — forslag skal du selv skrive ind i skemaet ovenfor.
      </p>

      {meddelelser.length > 0 && (
        <div className="ai-dialog">
          {meddelelser.map((m, i) => (
            <div key={i} className={'ai-besked ' + m.rolle}>
              <span className="ai-afsender">{m.rolle === 'ai' ? 'AI' : 'Dig'}</span>
              <span className="ai-tekst">{m.tekst}</span>
            </div>
          ))}
          {arbejder && (
            <div className="ai-besked ai">
              <span className="ai-afsender">AI</span>
              <span className="ai-tekst"><em>Skriver …</em></span>
            </div>
          )}
        </div>
      )}

      {fejl && <div className="besked fejl">{fejl}</div>}

      <form onSubmit={send} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input
          type="text" value={tekst} onChange={e => setTekst(e.target.value)}
          placeholder="Fx: Bør andre driftsindtægter lægges til omsætningen?"
          aria-label="Spørgsmål til AI om omformningen"
          style={{ flex: 1 }}
        />
        <button className="knap primaer" type="submit" disabled={arbejder || !tekst.trim()}>
          {arbejder ? 'Sender …' : 'Send'}
        </button>
      </form>
    </div>
  )
}
