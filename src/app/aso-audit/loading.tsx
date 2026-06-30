import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'

export default function Loading() {
  return (
    <Layout title="Full ASO Audit" badge="Profesyonel">
      <CardSkeleton rows={3} />
      <CardSkeleton rows={6} />
    </Layout>
  )
}
