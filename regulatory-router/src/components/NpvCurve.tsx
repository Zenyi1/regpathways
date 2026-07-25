'use client'

import { useState } from 'react'

export interface CurvePoint {
  markets: number
  priceFloor: number
  npvUsdM: number
  usNetPrice: number
  mfnBindingMarket: string | null
  accessPatientYearsM: number
}

interface Props {
  curve: CurvePoint[]
  cliff: { atMarket: number; dropUsdM: number; dropPct: number; trigger: string | null } | null
  profitMaxMarkets: number
}

const W = 860
const H = 190
const PAD = { top: 16, right: 18, bottom: 26, left: 62 }

function Panel({
  curve,
  valueOf,
  label,
  unit,
  cliffAt,
  profitMaxMarkets,
  hovered,
  setHovered,
  showXAxis,
}: {
  curve: CurvePoint[]
  valueOf: (p: CurvePoint) => number
  label: string
  unit: string
  cliffAt: number | null
  profitMaxMarkets: number
  hovered: number | null
  setHovered: (n: number | null) => void
  showXAxis: boolean
}) {
  const values = curve.map(valueOf)
  const maxV = Math.max(...values)
  const minV = Math.min(...values, 0)
  const maxM = Math.max(...curve.map((p) => p.markets))
  const minM = Math.min(...curve.map((p) => p.markets))

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const x = (m: number) => PAD.left + ((m - minM) / Math.max(1, maxM - minM)) * plotW
  const y = (v: number) => PAD.top + plotH - ((v - minV) / Math.max(1, maxV - minV)) * plotH

  const path = curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.markets)},${y(valueOf(p))}`).join(' ')

  const ticks = [minV, minV + (maxV - minV) / 2, maxV]
  const hoveredPoint = hovered === null ? null : curve.find((p) => p.markets === hovered)

  return (
    <svg
      width={W}
      height={H}
      className="min-w-[860px]"
      role="img"
      aria-label={`${label} against number of markets launched`}
      onMouseLeave={() => setHovered(null)}
    >
      <text x={0} y={11} fontSize={11} fill="var(--ink)" fontWeight={600}>
        {label}
        <tspan fill="var(--ink-soft)" fontWeight={400}>
          {' '}
          ({unit})
        </tspan>
      </text>

      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            y1={y(t)}
            x2={W - PAD.right}
            y2={y(t)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 3}
            fontSize={10}
            fill="var(--ink-soft)"
            textAnchor="end"
            className="tnum"
          >
            {Math.round(t).toLocaleString()}
          </text>
        </g>
      ))}

      {/* the cliff: a labelled rule, so it is never colour-alone */}
      {cliffAt !== null && (
        <g>
          <line
            x1={x(cliffAt)}
            y1={PAD.top}
            x2={x(cliffAt)}
            y2={PAD.top + plotH}
            stroke="var(--warn)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
          <text x={x(cliffAt) + 5} y={PAD.top + 10} fontSize={10} fill="var(--warn)">
            MFN cliff
          </text>
        </g>
      )}

      <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2} />

      {curve.map((p) => {
        const isProfitMax = p.markets === profitMaxMarkets
        return (
          <g key={p.markets}>
            <circle
              cx={x(p.markets)}
              cy={y(valueOf(p))}
              r={isProfitMax ? 5 : 3}
              fill={isProfitMax ? 'var(--brand)' : 'white'}
              stroke="var(--brand)"
              strokeWidth={2}
            />
            {/* generous hit target, larger than the mark */}
            <rect
              x={x(p.markets) - 9}
              y={PAD.top}
              width={18}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHovered(p.markets)}
            />
          </g>
        )
      })}

      {hoveredPoint && (
        <g pointerEvents="none">
          <line
            x1={x(hoveredPoint.markets)}
            y1={PAD.top}
            x2={x(hoveredPoint.markets)}
            y2={PAD.top + plotH}
            stroke="var(--ink-soft)"
            strokeWidth={1}
          />
          <circle
            cx={x(hoveredPoint.markets)}
            cy={y(valueOf(hoveredPoint))}
            r={5}
            fill="var(--brand)"
            stroke="white"
            strokeWidth={2}
          />
          <text
            x={Math.min(x(hoveredPoint.markets) + 8, W - PAD.right - 130)}
            y={y(valueOf(hoveredPoint)) - 8}
            fontSize={11}
            fill="var(--ink)"
            className="tnum"
          >
            {hoveredPoint.markets} markets · {Math.round(valueOf(hoveredPoint)).toLocaleString()}{' '}
            {unit}
          </text>
        </g>
      )}

      {showXAxis && (
        <>
          {curve
            .filter((_, i) => i % Math.ceil(curve.length / 8) === 0)
            .map((p) => (
              <text
                key={p.markets}
                x={x(p.markets)}
                y={H - 8}
                fontSize={10}
                fill="var(--ink-soft)"
                textAnchor="middle"
                className="tnum"
              >
                {p.markets}
              </text>
            ))}
          <text x={W / 2} y={H - 8} fontSize={0} fill="none">
            markets launched
          </text>
        </>
      )}
    </svg>
  )
}

export function NpvCurve({ curve, cliff, profitMaxMarkets }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  if (curve.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <Panel
        curve={curve}
        valueOf={(p) => p.npvUsdM}
        label="Net present value"
        unit="$M"
        cliffAt={cliff?.atMarket ?? null}
        profitMaxMarkets={profitMaxMarkets}
        hovered={hovered}
        setHovered={setHovered}
        showXAxis={false}
      />
      <Panel
        curve={curve}
        valueOf={(p) => p.accessPatientYearsM}
        label="Patient access"
        unit="M patient-years"
        cliffAt={cliff?.atMarket ?? null}
        profitMaxMarkets={profitMaxMarkets}
        hovered={hovered}
        setHovered={setHovered}
        showXAxis
      />
      <p className="text-xs text-ink-soft mt-1">
        Markets launched, ordered by price from highest to lowest. The filled marker is the
        profit-maximising set. NPV is non-monotone by construction — adding a market can destroy
        value once it trips the MFN reference.
      </p>
    </div>
  )
}
