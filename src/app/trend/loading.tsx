import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return (
    <Layout title="Sıralama Trendi" badge="Günlük Otomatik Takip">
      <CardSkeleton rows={6} /><CardSkeleton rows={4} />
    </Layout>
  )
}
