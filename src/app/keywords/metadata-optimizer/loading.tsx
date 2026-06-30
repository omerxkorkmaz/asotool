import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'

export default function Loading() {
  return (
    <Layout title="AI Metadata Optimizer" badge="Gemini ASO">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={6} />
    </Layout>
  )
}
