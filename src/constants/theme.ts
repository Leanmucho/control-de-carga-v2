export const colors = {
  bg:        '#0f172a',
  surface:   '#1e293b',
  border:    '#334155',
  text:      '#e2e8f0',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  primary:   '#3b82f6',
  success:   '#22c55e',
  warning:   '#f59e0b',
  danger:    '#ef4444',
  orange:    '#ff9500',
}

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
}

export const radius = {
  sm: 6, md: 10, lg: 16, full: 999,
}

export const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  en_piso:    { bg: '#1e3a5f', text: '#60a5fa' },
  controlado: { bg: '#1a3a2a', text: '#4ade80' },
  en_carga:   { bg: '#451a03', text: '#fb923c' },
  finalizado: { bg: '#1e1b4b', text: '#a78bfa' },
  en_piso_p:  { bg: '#1e293b', text: '#94a3b8' },
  cargado:    { bg: '#1a3a2a', text: '#4ade80' },
}
