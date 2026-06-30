import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'

export default function Loading() {
  return (
    <Layout title="Keyword Tracker" badge="Sıralama Takibi">
      <CardSkeleton rows={2} />
      <TableSkeleton rows={8} />
    </Layout>
  )
}
