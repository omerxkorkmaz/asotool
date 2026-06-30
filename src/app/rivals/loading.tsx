import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return <Layout title="Rakip Analizi" badge="Detaylı Karşılaştırma"><CardSkeleton rows={2} /><TableSkeleton rows={5} /></Layout>
}
