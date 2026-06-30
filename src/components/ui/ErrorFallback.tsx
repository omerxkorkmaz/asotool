'use client'

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
}

export default function ErrorFallback({ error, reset, title = 'Bir hata oluştu' }: ErrorFallbackProps) {
  return (
    <div className="card" style={{ borderColor: 'var(--red)', maxWidth: 600 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
        {error.message || 'Beklenmeyen bir hata oluştu.'}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Tekrar Dene
      </button>
    </div>
  )
}
