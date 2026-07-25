'use client'

import type { EnrichedStep } from '@/lib/api/enrich'

const ROW_H = 26
const LABEL_W = 190
const PAD = 16

export function Gantt({ steps, highlight }: { steps: EnrichedStep[]; highlight?: string | null }) {
  if (steps.length === 0) return null

  const maxDay = Math.max(...steps.map((s) => s.finishDay))
  const width = 900
  const chartW = width - LABEL_W - PAD * 2
  const height = steps.length * ROW_H + 44

  const x = (day: number) => LABEL_W + (day / maxDay) * chartW

  // one gridline per 6 months, which reads better than arbitrary day ticks
  const tickEvery = 182
  const ticks: number[] = []
  for (let d = 0; d <= maxDay; d += tickEvery) ticks.push(d)

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-[900px]" role="img" aria-label="Filing schedule">
        {ticks.map((d) => (
          <g key={d}>
            <line x1={x(d)} y1={22} x2={x(d)} y2={height - 12} stroke="var(--line)" strokeWidth={1} />
            <text x={x(d)} y={14} fontSize={10} fill="var(--ink-soft)" textAnchor="middle" className="tnum">
              {Math.round(d / 30.4)}mo
            </text>
          </g>
        ))}

        {steps.map((step, i) => {
          const y = 28 + i * ROW_H
          const x1 = x(step.startDay)
          const x2 = x(step.finishDay)
          const w = Math.max(x2 - x1, 2)
          const isEnabler = step.role === 'enabler'
          const dim = highlight && step.marketId !== highlight && !step.reliesOn.length
          return (
            <g key={step.marketId + step.routeId} opacity={dim ? 0.45 : 1}>
              <text x={0} y={y + 13} fontSize={11} fill="var(--ink)" fontWeight={isEnabler ? 600 : 400}>
                {step.market.length > 24 ? `${step.market.slice(0, 23)}…` : step.market}
              </text>
              <text x={LABEL_W - 34} y={y + 13} fontSize={10} fill="var(--ink-soft)" className="tnum">
                {step.marketId}
              </text>

              <rect
                x={x1}
                y={y + 3}
                width={w}
                height={ROW_H - 10}
                rx={2}
                fill={isEnabler ? 'var(--brand)' : 'rgba(30,58,138,0.28)'}
                stroke={isEnabler ? 'var(--brand-strong)' : 'rgba(30,58,138,0.45)'}
                strokeWidth={1}
              />
              {w > 90 && (
                <text
                  x={x1 + 6}
                  y={y + 15}
                  fontSize={9.5}
                  fill={isEnabler ? '#fff' : 'var(--ink)'}
                  className="tnum"
                >
                  {step.program ?? step.route}
                </text>
              )}
              {step.reliesOn.length > 0 && (
                <text x={x2 + 5} y={y + 15} fontSize={9} fill="var(--ink-soft)">
                  ← {step.reliesOn.join('+')}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
