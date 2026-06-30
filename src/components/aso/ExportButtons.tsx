'use client'

import { exportAnalysis, type ExportKind } from '@/lib/export-utils'

interface ExportButtonsProps {
  kind: ExportKind
  data: unknown
  label?: string
  prominent?: boolean
}

export default function ExportButtons({ kind, data, label = 'Rapor', prominent }: ExportButtonsProps) {
  return (
    <div className={`export-toolbar ${prominent ? 'export-toolbar-prominent' : ''}`}>
      <span className="export-toolbar-label">Export</span>
      <button type="button" className="btn btn-ghost export-btn" onClick={() => exportAnalysis(kind, 'json', data)}>
        JSON
      </button>
      <button type="button" className="btn btn-ghost export-btn" onClick={() => exportAnalysis(kind, 'csv', data)}>
        CSV
      </button>
      <button type="button" className="btn btn-primary export-btn" onClick={() => exportAnalysis(kind, 'print', data)}>
        {label} Oluştur
      </button>
    </div>
  )
}
