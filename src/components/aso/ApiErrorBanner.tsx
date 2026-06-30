'use client'

interface ApiErrorBannerProps {
  message: string
  onDismiss?: () => void
}

export default function ApiErrorBanner({ message, onDismiss }: ApiErrorBannerProps) {
  return (
    <div
      className="card"
      style={{
        borderColor: 'var(--red)',
        background: 'var(--red-dim)',
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>Analiz başarısız</div>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{message}</p>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
          İpucu: Package name ve dil seçimini kontrol edin. Bulk scan geçmişi yoksa önce Toplu Tarama yapın.
        </p>
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, flexShrink: 0 }} onClick={onDismiss}>
          Kapat
        </button>
      )}
    </div>
  )
}
