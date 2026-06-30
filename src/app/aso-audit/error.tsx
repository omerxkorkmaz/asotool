'use client'

import ErrorFallback from '@/components/ui/ErrorFallback'
import Layout from '@/components/layout/Layout'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <Layout title="Full ASO Audit" badge="Profesyonel">
      <ErrorFallback error={error} reset={reset} title="ASO Audit yüklenemedi" />
    </Layout>
  )
}
