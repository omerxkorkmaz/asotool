import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'

export default function Loading() {
  return (
    <Layout title="Toplu ASO Analizi" badge="AI Bulk Scan">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={6} />
    </Layout>
  )
}
