/** Parse API error responses into user-friendly messages */

export async function parseApiError(response: Response, fallback = 'İstek başarısız oldu'): Promise<string> {
  try {
    const data = await response.json()
    const msg = data?.error || data?.message
    if (typeof msg === 'string' && msg.trim()) {
      return enrichErrorMessage(msg, response.status)
    }
  } catch {
    /* ignore */
  }
  return enrichErrorMessage(fallback, response.status)
}

export function enrichErrorMessage(message: string, status?: number): string {
  if (status === 429) {
    return `${message} — Çok fazla istek gönderildi. Bir dakika bekleyip tekrar deneyin.`
  }
  if (status === 503) {
    return `${message} — Redis veya harici servis geçici olarak kullanılamıyor.`
  }
  if (status === 504 || message.toLowerCase().includes('timeout')) {
    return `${message} — İşlem zaman aşımına uğradı. Daha az keyword ile tekrar deneyin.`
  }
  if (message.toLowerCase().includes('package')) {
    return `${message} — Package name formatını kontrol edin (ör. com.sirket.uygulama).`
  }
  return message
}

export function networkErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'İstek iptal edildi.'
    if (err.message.includes('fetch')) {
      return 'Sunucuya bağlanılamadı. İnternet bağlantınızı ve dev sunucusunun çalıştığını kontrol edin.'
    }
    return enrichErrorMessage(err.message)
  }
  return 'Beklenmeyen bir hata oluştu.'
}
