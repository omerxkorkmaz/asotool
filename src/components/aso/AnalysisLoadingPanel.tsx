'use client'

import { Spinner } from '@/components/ui/Spinner'
import { STANDARD_LOADING_STEPS } from '@/lib/gemini-prompts'

interface AnalysisLoadingPanelProps {
  title?: string
  steps?: string[]
  activeStep?: number
}

export default function AnalysisLoadingPanel({
  title = 'Analiz çalışıyor…',
  steps = STANDARD_LOADING_STEPS,
  activeStep = 0,
}: AnalysisLoadingPanelProps) {
  const progress = Math.min(100, Math.round(((activeStep + 0.5) / steps.length) * 100))

  return (
    <div className="analysis-loading-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Spinner />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Scrape → Analiz → Öneriler — 30–90 saniye sürebilir
          </div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--blue)' }}>{progress}%</span>
      </div>

      <div className="analysis-progress-track" style={{ marginBottom: 20 }}>
        <div className="analysis-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <ul className="analysis-steps">
        {steps.map((step, i) => {
          const done = i < activeStep
          const active = i === activeStep
          return (
            <li key={step} className={`analysis-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <span className="analysis-step-icon">{done ? '✓' : active ? '▸' : '○'}</span>
              <span>{step}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
