import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return <Layout title="Başlık & Açıklama Önerisi" badge="ASO Metin Optimizasyonu"><CardSkeleton rows={3} /></Layout>
}
