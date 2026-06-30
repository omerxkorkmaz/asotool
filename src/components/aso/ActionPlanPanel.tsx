'use client'

import type { SevenDayActionPlan } from '@/types/aso'

const PRIORITY_COLOR: Record<string, string> = {
  yüksek: 'var(--accent)',
  orta: 'var(--warn)',
  düşük: 'var(--muted)',
}

export default function ActionPlanPanel({ plan }: { plan: SevenDayActionPlan }) {
  return (
    <div className="card" style={{ borderLeft: '3px solid var(--blue)' }}>
      <div className="card-title">Next 7 Days — Aksiyon Planı</div>
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16, lineHeight: 1.6 }}>{plan.summary}</p>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plan.days.map((day) => (
          <li
            key={day.day}
            style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr',
              gap: 12,
              padding: 12,
              background: 'var(--bg)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--blue-dim)',
                color: 'var(--blue)',
                fontFamily: 'var(--mono)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              {day.day}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{day.title}</span>
                <span
                  className="tag"
                  style={{
                    fontSize: 10,
                    color: PRIORITY_COLOR[day.priority] ?? 'var(--muted)',
                    border: `1px solid ${PRIORITY_COLOR[day.priority] ?? 'var(--border)'}`,
                  }}
                >
                  {day.priority}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 6px', lineHeight: 1.6 }}>{day.action}</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>Beklenen: {day.expectedOutcome}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
