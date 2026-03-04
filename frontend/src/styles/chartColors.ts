/** Palette centralisée pour tous les graphiques Recharts.
 *  Importer CHART_COLORS au lieu de hardcoder des couleurs dans les composants. */
export const CHART_COLORS = {
  primary:   '#2563EB',
  secondary: '#7C3AED',
  success:   '#16A34A',
  warning:   '#D97706',
  error:     '#DC2626',
  info:      '#0284C7',
  neutral:   '#64748B',
  // Percentiles
  p50:  '#2563EB',
  p75:  '#7C3AED',
  p95:  '#D97706',
  p99:  '#DC2626',
  // Métriques Gatling
  rps:    '#16A34A',
  eps:    '#DC2626',
  users:  '#0284C7',
  mean:   '#2563EB',
  // Métriques Selenium
  iterPerSec:    '#16A34A',
  stepDuration:  '#2563EB',
  browsers:      '#0284C7',
} as const

export const SERVER_TYPE_COLORS: Record<string, string> = {
  API:  '#2563EB',
  SQL:  '#7C3AED',
  WEB:  '#16A34A',
  FILE: '#D97706',
}

export const LABEL_COLORS = [
  '#2563EB', '#7C3AED', '#D97706', '#16A34A',
  '#0284C7', '#DC2626', '#059669', '#9333EA',
]

export function getLabelColor(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash)
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length]
}
