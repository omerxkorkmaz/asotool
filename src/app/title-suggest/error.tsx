'use client'
import ErrorFallback from '@/components/ui/ErrorFallback'
import Layout from '@/components/layout/Layout'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <Layout title="Başlık & Açıklama Önerisi" badge="ASO Metin Optimizasyonu"><ErrorFallback error={error} reset={reset} /></Layout>
}
