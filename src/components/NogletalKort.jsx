import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid
} from 'recharts'
import { formatVaerdi } from '../lib/nogletal.js'

const PETROL = '#1f5c6e'
const OKKER = '#9a6a16'
const NED = '#9c3a2b'

const tal = v => (v == null || !Number.isFinite(v) ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v))

export default function NogletalKort ({ nogletal: n, resultater, aarNavne, enhed }) {
  const [visAar, setVisAar] = useState(resultater.length - 1)
  const [visForklaring, setVisForklaring] = useState(false)

  const data = resultater.map((r, i) => ({
    aar: aarNavne[i],
    vaerdi: r[n.nr].value == null || !Number.isFinite(r[n.nr].value) ? null : Math.round(r[n.nr].value * 100) / 100
  }))

  const gyldige = data.filter(d => d.vaerdi != null)
  const foerste = gyldige[0]?.vaerdi
  const sidste = gyldige[gyldige.length - 1]?.vaerdi
  const aendring = foerste != null && sidste != null && gyldige.length > 1 ? sidste - foerste : null
  const retning = aendring == null || Math.abs(aendring) < 0.05
    ? 'neutral'
    : ((aendring > 0) === (n.bedre !== 'ned') ? 'op' : 'ned')

  const aktuel = resultater[visAar][n.nr]
  const harTal = gyldige.length > 0

  return (
    <article className="nt-kort">
      <div className="nt-hoved">
        <span className="nt-nr">{n.nr}</span>
        <div style={{ minWidth: 0 }}>
          <div className="nt-navn">{n.navn}</div>
        </div>
        <div className="nt-vaerdi">
          <div className="stor">{formatVaerdi(n, resultater[resultater.length - 1][n.nr].value, enhed)}</div>
          {aendring != null && (
            <div className={'aendring ' + (n.bedre === 'neutral' ? 'neutral' : retning)}>
              {aendring > 0 ? '+' : ''}{new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(aendring)} over perioden
            </div>
          )}
        </div>
      </div>

      <div className="fraktion">
        <div className="fraktion-omslag">
          <div className="taeller">
            <span className="tekst">{n.taeller}</span>
            {harTal && <><br /><span className="tal-indsat">{tal(aktuel.num)}</span></>}
          </div>
          <div className="naevner">
            <span className="tekst">{n.naevner}</span>
            {harTal && <><br /><span className="tal-indsat">{tal(aktuel.den)}</span></>}
          </div>
        </div>
      </div>

      <div className="nt-graf" data-graf-nr={n.nr}>
        {harTal
          ? (
            <ResponsiveContainer width="100%" height={158}>
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e8ebe7" vertical={false} />
                <XAxis dataKey="aar" tick={{ fontSize: 11, fill: '#5f6b72' }} axisLine={{ stroke: '#d7ddd7' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#5f6b72' }} axisLine={false} tickLine={false} width={46} />
                <Tooltip
                  formatter={v => formatVaerdi(n, v, enhed)}
                  contentStyle={{ fontSize: 12, borderRadius: 3, border: '1px solid #d7ddd7' }}
                />
                <ReferenceLine y={0} stroke="#14202e" />
                {n.enhed === '%' && n.nr === 23 && <ReferenceLine y={100} stroke={OKKER} strokeDasharray="4 3" />}
                <Bar dataKey="vaerdi" radius={[2, 2, 0, 0]} maxBarSize={64} isAnimationActive={false}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.vaerdi < 0 ? NED : (i === data.length - 1 ? PETROL : '#9db6bc')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            )
          : (
            <p className="forklaring" style={{ padding: '22px 0' }}>
              Kan ikke beregnes med de indtastede tal. {manglerTekst(n)}
            </p>
            )}
      </div>

      {visForklaring && <p className="forklaring">{n.forklaring}</p>}

      <div className="nt-fod">
        <span>
          Tal fra{' '}
          <select
            value={visAar} onChange={e => setVisAar(Number(e.target.value))}
            style={{ width: 'auto', display: 'inline-block', padding: '1px 4px', fontSize: 11 }}
            aria-label={`Vælg år for udregningen af ${n.navn}`}
          >
            {aarNavne.map((a, i) => <option key={i} value={i}>{a}</option>)}
          </select>
          {aktuel.skoen && <span className="skoen-mærke" title="Gennemsnittet er beregnet på ultimotal, fordi primobalancen mangler"> · skøn</span>}
        </span>
        <button onClick={() => setVisForklaring(v => !v)}>{visForklaring ? 'Skjul forklaring' : 'Hvad viser tallet?'}</button>
      </div>
    </article>
  )
}

function manglerTekst (n) {
  if (n.omraade === 'boers') return 'Udfyld antal aktier og børskurs under "Pengestrøm og aktieoplysninger".'
  if (n.nr === 19) return 'Udfyld pengestrøm fra primær drift.'
  return 'Tjek at både tæller og nævner er udfyldt i analyseformen.'
}
