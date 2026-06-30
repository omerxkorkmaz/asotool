'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { id: '/', label: 'Komuta Merkezi', icon: '▦' },
  { id: '/keywords', label: 'Keyword Tracker', icon: '⌕' },
  { id: '/multi-country', label: 'Çoklu Ülke', icon: '⊕' },
  { id: '/keywords/bulk-scan', label: 'Bulk Scan', icon: '✓', group: 'Analiz' },
  { id: '/keywords/metadata-optimizer', label: 'Metadata Optimizer', icon: '✦', group: 'Analiz' },
  { id: '/aso-audit', label: 'Full ASO Audit', icon: '◈', group: 'Analiz' },
  { id: '/trend', label: 'Sıralama Trendi', icon: '📈' },
  { id: '/title-suggest', label: 'Başlık Önerisi', icon: '✎' },
  { id: '/rivals', label: 'Rakip Analizi', icon: '⊙' },
  { id: '/reviews', label: 'Yorum Madencisi', icon: '✦' },
  { id: '/category', label: 'Kategori Radar', icon: '◈' },
]

const BREADCRUMB_MAP: Record<string, { parent?: string; label: string }> = {
  '/': { label: 'Komuta Merkezi' },
  '/keywords': { parent: 'Araçlar', label: 'Keyword Tracker' },
  '/multi-country': { parent: 'Araçlar', label: 'Çoklu Ülke Tarama' },
  '/keywords/bulk-scan': { parent: 'Analiz', label: 'Bulk Scan' },
  '/keywords/metadata-optimizer': { parent: 'Analiz', label: 'Metadata Optimizer' },
  '/aso-audit': { parent: 'Analiz', label: 'Full ASO Audit' },
  '/audit': { parent: 'Analiz', label: 'Full ASO Audit' },
  '/trend': { parent: 'Araçlar', label: 'Sıralama Trendi' },
  '/title-suggest': { parent: 'Araçlar', label: 'Başlık Önerisi' },
  '/rivals': { parent: 'Araçlar', label: 'Rakip Analizi' },
  '/reviews': { parent: 'Araçlar', label: 'Yorum Madencisi' },
  '/category': { parent: 'Araçlar', label: 'Kategori Radar' },
}

function isActive(pathname: string | null, id: string): boolean {
  if (!pathname) return false
  if (pathname === id) return true
  if (id.startsWith('/keywords/') && pathname.startsWith(id)) return true
  if (id === '/aso-audit' && (pathname === '/aso-audit' || pathname === '/audit')) return true
  return false
}

interface LayoutProps {
  children: React.ReactNode
  title: string
  badge?: string
}

export default function Layout({ children, title, badge }: LayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const crumb = BREADCRUMB_MAP[pathname ?? ''] ?? { label: title }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>▸ ASO Tool</span>
          <span className="version">v0.3 · Kişisel ASO</span>
        </div>
        {NAV.map((n) => (
          <div
            key={n.id}
            className={`nav-item ${isActive(pathname, n.id) ? 'active' : ''}`}
            onClick={() => router.push(n.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && router.push(n.id)}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </aside>

      <main className="main">
        <div className="topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <nav className="breadcrumb" aria-label="Breadcrumb">
              <button type="button" className="breadcrumb-link" onClick={() => router.push('/')}>
                Ana
              </button>
              {crumb.parent && (
                <>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-muted">{crumb.parent}</span>
                </>
              )}
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{crumb.label}</span>
            </nav>
            <h1>{title}</h1>
          </div>
          {badge && <span className="badge">{badge}</span>}
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  )
}
