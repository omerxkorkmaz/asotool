import { useState } from 'react'
import { useRouter } from 'next/router'

const NAV = [
  { id: '/',          label: 'Dashboard',       icon: '▦' },
  { id: '/keywords',  label: 'Keyword Tracker', icon: '⌕' },
  { id: '/multi-country', label: 'Çoklu Ülke Tarama', icon: '⊕' },
  { id: '/rivals',    label: 'Rakip Analizi',   icon: '⊙' },
  { id: '/reviews',   label: 'Yorum Madencisi', icon: '✦' },
  { id: '/category',  label: 'Kategori Radar',  icon: '◈' },
]

export default function Layout({ children, title, badge }) {
  const router = useRouter()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>▸ ASO Tool</span>
          <span className="version">v0.1 · google-play-scraper</span>
        </div>
        {NAV.map(n => (
          <div
            key={n.id}
            className={`nav-item ${router.pathname === n.id ? 'active' : ''}`}
            onClick={() => router.push(n.id)}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 14 }}>{n.icon}</span>
            {n.label}
          </div>
        ))}
      </aside>

      <main className="main">
        <div className="topbar">
          <h1>{title}</h1>
          {badge && <span className="badge">{badge}</span>}
        </div>
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  )
}
