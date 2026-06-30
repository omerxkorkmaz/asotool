import { CardSkeleton } from '@/components/ui/Skeleton'
import Layout from '@/components/layout/Layout'
export default function Loading() {
  return <Layout title="Yorum Madencisi" badge="Review Intelligence"><CardSkeleton rows={3} /></Layout>
}
