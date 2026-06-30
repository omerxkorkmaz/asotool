import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return (
    <Layout title="Çoklu Ülke Tarama" badge="Global Keyword Radar">
      <CardSkeleton rows={3} /><TableSkeleton rows={6} />
    </Layout>
  )
}
