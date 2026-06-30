interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, className = '', style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card skeleton-card">
      <Skeleton width="40%" height={12} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={14} style={{ marginBottom: 10, width: `${90 - i * 8}%` }} />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card skeleton-card">
      <Skeleton width="30%" height={12} style={{ marginBottom: 20 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <Skeleton width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton height={13} style={{ marginBottom: 6, width: '70%' }} />
            <Skeleton height={10} width="40%" />
          </div>
          <Skeleton width={48} height={13} />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <>
      <CardSkeleton rows={2} />
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card skeleton-card">
            <Skeleton height={32} width="50%" style={{ marginBottom: 8 }} />
            <Skeleton height={10} width="70%" />
          </div>
        ))}
      </div>
      <div className="grid-2">
        <CardSkeleton rows={5} />
        <CardSkeleton rows={4} />
      </div>
    </>
  )
}

export function PageLoading({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="loading-row" role="status" aria-live="polite">
      <span className="spinner" />
      {label}
    </div>
  )
}
