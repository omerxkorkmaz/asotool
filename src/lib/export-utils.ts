/** Client-side export helpers for ASO analysis results */

import type { AsoAuditResult } from '@/types/aso'
import type { BulkScanResult } from '@/types/gemini'
import type { MetadataOptimizerResult } from '@/types/metadata'

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function downloadJson(filename: string, data: unknown) {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ]
  downloadBlob(filename, new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
}

export function exportBulkScanJson(result: BulkScanResult) {
  downloadJson(`bulk-scan-${result.primaryApp}-${dateSlug(result.analyzedAt)}.json`, result)
}

export function exportBulkScanCsv(result: BulkScanResult) {
  downloadCsv(
    `bulk-scan-${result.primaryApp}-${dateSlug(result.analyzedAt)}.csv`,
    ['keyword', 'opportunityScore', 'difficulty', 'estimatedVolume', 'competitionLevel', 'relevanceToApp', 'reasoning'],
    result.keywords.map((k) => [
      k.keyword,
      k.opportunityScore,
      k.difficulty,
      k.estimatedVolume,
      k.competitionLevel,
      k.relevanceToApp,
      k.reasoning,
    ])
  )
}

export function exportMetadataJson(result: MetadataOptimizerResult) {
  downloadJson(`metadata-${result.packageName}-${dateSlug(result.generatedAt)}.json`, result)
}

export function exportMetadataCsv(result: MetadataOptimizerResult) {
  downloadCsv(
    `metadata-${result.packageName}-${dateSlug(result.generatedAt)}.csv`,
    ['version', 'title', 'shortDescription', 'fullDescription', 'expectedImpact', 'usedKeywords', 'reasoning'],
    result.suggestions.map((s) => [
      s.version,
      s.title,
      s.shortDescription,
      s.fullDescription,
      s.expectedImpact,
      s.usedKeywords.join('; '),
      s.reasoning,
    ])
  )
}

export function exportAuditJson(result: AsoAuditResult) {
  downloadJson(`aso-audit-${result.packageName}-${dateSlug(result.auditedAt)}.json`, result)
}

export function exportAuditCsv(result: AsoAuditResult) {
  const kwRows = result.keywordOpportunities.map((k) => [
    'keyword',
    k.keyword,
    k.opportunityScore,
    k.myRank ?? '',
    k.reasoning,
  ])
  const gapRows = result.competitorGaps.map((g) => [
    'gap',
    g.keyword,
    g.severity,
    g.gapType,
    g.myRank ?? '',
    g.recommendation,
  ])
  downloadCsv(
    `aso-audit-${result.packageName}-${dateSlug(result.auditedAt)}.csv`,
    ['section', 'field1', 'field2', 'field3', 'field4', 'detail'],
    [...kwRows, ...gapRows]
  )
}

function dateSlug(iso: string): string {
  return iso.slice(0, 10)
}

function reportStyles(): string {
  return `
    body { font-family: system-ui, sans-serif; color: #111; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 14px; color: #555; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    p, li { font-size: 13px; line-height: 1.6; }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    .score { font-size: 48px; font-weight: 700; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    @media print { body { padding: 16px; } }
  `
}

export function printBulkScanReport(result: BulkScanResult) {
  const html = `
    <h1>ASO Bulk Scan Raporu</h1>
    <div class="meta">${result.primaryApp} · ${result.language} · ${formatReportDate(result.analyzedAt)}</div>
    <p><strong>Strateji:</strong> ${escapeHtml(result.strategySummary)}</p>
    <h2>Keyword Analizi</h2>
    <table><thead><tr><th>Keyword</th><th>Fırsat</th><th>Zorluk</th><th>Relevance</th></tr></thead>
    <tbody>${result.keywords
      .map(
        (k) =>
          `<tr><td>${escapeHtml(k.keyword)}</td><td>${k.opportunityScore}</td><td>${k.difficulty}</td><td>${k.relevanceToApp}</td></tr>`
      )
      .join('')}</tbody></table>
    ${result.actionPlan7Days ? `<h2>7 Günlük Plan</h2><ol>${result.actionPlan7Days.days.map((d) => `<li><strong>${escapeHtml(d.title)}</strong>: ${escapeHtml(d.action)}</li>`).join('')}</ol>` : ''}
  `
  openPrintWindow('Bulk Scan Raporu', html)
}

export function printMetadataReport(result: MetadataOptimizerResult) {
  const rec = result.suggestions.find((s) => s.version === result.recommendedVersion)
  const html = `
    <h1>Metadata Optimizer Raporu</h1>
    <div class="meta">${result.packageName} · ${result.languageLabel} · ${formatReportDate(result.generatedAt)}</div>
    <p><strong>Önerilen versiyon:</strong> ${result.recommendedVersion} — ${escapeHtml(result.recommendationReason)}</p>
    ${rec ? `<h2>Önerilen Metadata</h2><p><strong>Başlık:</strong> ${escapeHtml(rec.title)}</p><p><strong>Kısa:</strong> ${escapeHtml(rec.shortDescription)}</p><p><strong>Full:</strong> ${escapeHtml(rec.fullDescription.slice(0, 500))}…</p>` : ''}
    <h2>Tüm Varyasyonlar</h2>
    ${result.suggestions.map((s) => `<p><strong>${s.version}</strong> (${s.expectedImpact}): ${escapeHtml(s.title)}</p>`).join('')}
  `
  openPrintWindow('Metadata Raporu', html)
}

export function printAuditReport(result: AsoAuditResult) {
  const html = `
    <h1>Full ASO Audit Raporu</h1>
    <div class="meta">${result.packageName} · ${result.languageLabel} · ${formatReportDate(result.auditedAt)}</div>
    <div class="score">${result.healthScore}/100</div>
    <p>ASO Health Score</p>
    <h2>Strateji Özeti</h2>
    <p>${escapeHtml(result.strategySummary)}</p>
    <h2>Metadata Önerileri</h2>
    <ul>${result.metadataHighlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
    <h2>Keyword Fırsatları</h2>
    <table><thead><tr><th>Keyword</th><th>Skor</th><th>Sıra</th></tr></thead>
    <tbody>${result.keywordOpportunities.map((k) => `<tr><td>${escapeHtml(k.keyword)}</td><td>${k.opportunityScore}</td><td>${k.myRank ?? '—'}</td></tr>`).join('')}</tbody></table>
    <h2>Rakip Gap</h2>
    <ul>${result.competitorGaps.map((g) => `<li><strong>${escapeHtml(g.keyword)}</strong> (${g.severity}): ${escapeHtml(g.recommendation)}</li>`).join('')}</ul>
    <h2>7 Günlük Aksiyon Planı</h2>
    <ol>${result.actionPlan7Days.days.map((d) => `<li><strong>Gün ${d.day} — ${escapeHtml(d.title)}</strong>: ${escapeHtml(d.action)}</li>`).join('')}</ol>
  `
  openPrintWindow('ASO Audit Raporu', html)
}

function openPrintWindow(title: string, bodyHtml: string) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Pop-up engellendi — rapor için pop-up izni verin.')
    return
  }
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${reportStyles()}</style></head><body>${bodyHtml}</body></html>`
  )
  w.document.close()
  w.focus()
  setTimeout(() => {
    w.print()
  }, 400)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatReportDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR')
}

export type ExportKind = 'bulk-scan' | 'metadata' | 'audit'

export function exportAnalysis(kind: ExportKind, format: 'json' | 'csv' | 'print', data: unknown) {
  if (kind === 'bulk-scan') {
    const r = data as BulkScanResult
    if (format === 'json') exportBulkScanJson(r)
    else if (format === 'csv') exportBulkScanCsv(r)
    else printBulkScanReport(r)
  } else if (kind === 'metadata') {
    const r = data as MetadataOptimizerResult
    if (format === 'json') exportMetadataJson(r)
    else if (format === 'csv') exportMetadataCsv(r)
    else printMetadataReport(r)
  } else {
    const r = data as AsoAuditResult
    if (format === 'json') exportAuditJson(r)
    else if (format === 'csv') exportAuditCsv(r)
    else printAuditReport(r)
  }
}
