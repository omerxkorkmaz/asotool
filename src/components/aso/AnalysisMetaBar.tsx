'use client'

import { fmtDateTime } from '@/lib/languages'
import ExportButtons from '@/components/aso/ExportButtons'
import type { ExportKind } from '@/lib/export-utils'

interface AnalysisMetaBarProps {
  analyzedAt: string
  fromCache?: boolean
  fallbackMode?: boolean
  aiAvailable?: boolean
  extra?: React.ReactNode
  exportKind?: ExportKind
  exportData?: unknown
  reportLabel?: string
}

export default function AnalysisMetaBar({
  analyzedAt,
  fromCache,
  fallbackMode,
  aiAvailable,
  extra,
  exportKind,
  exportData,
  reportLabel,
}: AnalysisMetaBarProps) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 0,
      }}
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
        <span style={{ color: 'var(--muted)' }}>
          Son analiz:{' '}
          <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtDateTime(analyzedAt)}</strong>
        </span>
        {fromCache && (
          <span className="tag" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
            Önbellek
          </span>
        )}
        {fallbackMode && (
          <span className="tag" style={{ color: 'var(--warn)', borderColor: 'var(--warn)' }}>
            Heuristik mod
          </span>
        )}
        {aiAvailable === false && (
          <span className="tag" style={{ color: 'var(--warn)' }}>
            Gemini yok
          </span>
        )}
        {extra}
      </div>
      {exportKind && exportData != null && (
        <ExportButtons kind={exportKind} data={exportData} label={reportLabel} prominent />
      )}
    </div>
  )
}
