import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Vercel + Supabase entegrasyonunda otomatik gelen env isimleri:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY veya SUPABASE_SECRET_KEY (service role)
 *
 * POSTGRES_* değişkenleri doğrudan DB bağlantısı içindir; bu proje @supabase/supabase-js kullanır.
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY istemci tarafı içindir (şu an kullanılmıyor).
 */
export function getSupabaseConfig(): { url: string; serviceKey: string } | null {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  )?.trim()

  if (!url || !serviceKey) return null
  return { url, serviceKey }
}

function initClient(): SupabaseClient {
  const config = getSupabaseConfig()
  if (!config) {
    throw new Error(
      'Supabase yapılandırılmamış. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (veya SUPABASE_SECRET_KEY) gerekli.'
    )
  }
  return createClient(config.url, config.serviceKey)
}

/** Lazy singleton — env yoksa null */
export function getSupabase(): SupabaseClient | null {
  if (!getSupabaseConfig()) return null
  if (!client) client = initClient()
  return client
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase()
  if (!sb) {
    throw new Error(
      'Supabase yapılandırılmamış. Vercel: Supabase Storage entegrasyonu veya SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ayarlayın.'
    )
  }
  return sb
}

/** Spec uyumlu export — env tanımlıyken kullanılabilir */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(requireSupabase(), prop, receiver)
  },
})
