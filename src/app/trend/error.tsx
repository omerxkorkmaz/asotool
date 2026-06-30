'use client'
import ErrorFallback from '@/components/ui/ErrorFallback'
import Layout from '@/components/layout/Layout'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Layout title="Sıralama Trendi" badge="Günlük Otomatik Takip"><ErrorFallback error={error} reset={reset} /></Layout>
}
