import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return <Layout title="Kategori Radar" badge="Top Listeler"><CardSkeleton rows={3} /><TableSkeleton rows={8} /></Layout>
}
