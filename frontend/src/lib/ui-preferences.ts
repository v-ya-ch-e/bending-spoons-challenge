export type ThemeMode = "auto" | "light" | "dark"

export const sidebarCollapsedCookieName = "talent-os-sidebar-collapsed"
export const themeModeCookieName = "talent-os-theme"
export const spoonerIdCookieName = "talent-os-spooner-id"
export const preferenceCookieMaxAge = 60 * 60 * 24 * 365

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark"
}

export function parseThemeMode(value: string | null | undefined): ThemeMode {
  return isThemeMode(value) ? value : "auto"
}

export function parseSidebarCollapsed(value: string | null | undefined) {
  return value === "true"
}

export function parseSpoonerId(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
