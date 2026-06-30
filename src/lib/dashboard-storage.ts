import type { AppListItem, AppProfile } from '@/types/app'

export const LOCAL_STORAGE_APPS_KEY = 'aso:dashboard:apps'
export const LOCAL_STORAGE_PROFILE_PREFIX = 'aso:dashboard:profile:'

export function profileToListItem(profile: AppProfile): AppListItem {
  return {
    packageName: profile.packageName,
    title: profile.title,
    icon: profile.icon,
    healthScore: profile.healthScore,
    lastScannedAt: profile.lastScannedAt,
  }
}

export function loadLocalApps(): AppListItem[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_APPS_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveLocalApps(apps: AppListItem[]) {
  localStorage.setItem(LOCAL_STORAGE_APPS_KEY, JSON.stringify(apps))
  localStorage.setItem('myAppId', apps[0]?.packageName || '')
}

export function saveLocalProfile(profile: AppProfile) {
  localStorage.setItem(`${LOCAL_STORAGE_PROFILE_PREFIX}${profile.packageName}`, JSON.stringify(profile))
}

export function loadLocalProfile(pkg: string): AppProfile | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PROFILE_PREFIX}${pkg}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
