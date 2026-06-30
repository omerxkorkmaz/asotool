import { redirect } from 'next/navigation'

export default function AuditRedirectPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === 'string') qs.set(k, v)
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
  }
  const q = qs.toString()
  redirect(q ? `/aso-audit?${q}` : '/aso-audit')
}
