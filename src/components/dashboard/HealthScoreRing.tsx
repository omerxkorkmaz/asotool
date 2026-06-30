'use client'

import { healthScoreColor, HEALTH_COLOR_MAP } from '@/lib/health-score'

interface HealthScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
}

export default function HealthScoreRing({
  score,
  size = 160,
  strokeWidth = 10,
  label = 'ASO Health',
}: HealthScoreRingProps) {
  const colorKey = healthScoreColor(score)
  const colors = HEALTH_COLOR_MAP[colorKey]
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div
      className="health-ring"
      style={{ width: size, height: size, position: 'relative' }}
      role="img"
      aria-label={`${label}: ${score} / 100`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontFamily: 'var(--mono)', fontSize: size * 0.28, fontWeight: 600, color: colors.text, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</span>
      </div>
    </div>
  )
}
