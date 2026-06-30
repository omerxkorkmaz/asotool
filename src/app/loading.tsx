import { DashboardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'

export default function Loading() {
  return (
    <Layout title="Komuta Merkezi" badge="ASO Dashboard">
      <DashboardSkeleton />
    </Layout>
  )
}
