import { getSupabase } from '@/lib/db/supabase'

const MIGRATION_HINT = `
[migrations] Tablolar bulunamadı.
Supabase Dashboard → SQL Editor → New query
Dosya: supabase/migrations/001_initial.sql
İçeriği yapıştırıp Run ile çalıştırın.
`

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  )
}

async function tableExists(tableName: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) {
    console.warn(
      '[migrations] Supabase env eksik. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY veya SUPABASE_SECRET_KEY gerekli.'
    )
    return false
  }

  const { error } = await sb.from(tableName).select('id').limit(1)
  if (!error) return true
  if (isMissingTableError(error)) return false
  throw new Error(`Tablo kontrolü başarısız (${tableName}): ${error.message}`)
}

/**
 * apps_daily_metrics ve keyword_rankings_history tablolarının varlığını doğrular.
 * Supabase JS client raw SQL çalıştıramadığı için migration SQL dosyası manuel çalıştırılmalıdır.
 */
export async function ensureTablesExist(): Promise<void> {
  const sb = getSupabase()
  if (!sb) {
    console.warn(MIGRATION_HINT)
    throw new Error('Supabase yapılandırılmamış — migration çalıştırılamıyor.')
  }

  const required = ['apps_daily_metrics', 'keyword_rankings_history'] as const
  const missing: string[] = []

  for (const table of required) {
    const exists = await tableExists(table)
    if (!exists) missing.push(table)
  }

  if (missing.length > 0) {
    console.error(MIGRATION_HINT)
    console.error(`[migrations] Eksik tablolar: ${missing.join(', ')}`)
    throw new Error(
      `Eksik tablolar: ${missing.join(', ')}. supabase/migrations/001_initial.sql dosyasını Supabase SQL Editor'de çalıştırın.`
    )
  }
}
