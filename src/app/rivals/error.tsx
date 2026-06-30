'use client'
import ErrorFallback from '@/components/ui/ErrorFallback'
import Layout from '@/components/layout/Layout'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Layout title="Rakip Analizi" badge="Detaylı Karşılaştırma"><ErrorFallback error={error} reset={reset} /></Layout>
}
