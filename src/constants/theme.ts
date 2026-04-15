export const colors = {
  bg:          '#0b1120',
  surface:     '#111827',
  surfaceHigh: '#1a2535',
  border:      '#1f2f44',
  borderHigh:  '#2d4059',
  text:        '#f1f5f9',
  textMuted:   '#94a3b8',
  textFaint:   '#4b6280',
  primary:     '#3b82f6',
  primaryMid:  '#1d4ed8',
  success:     '#22c55e',
  successDim:  '#15803d',
  warning:     '#f59e0b',
  danger:      '#ef4444',
  orange:      '#ff9500',
}

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
}

export const radius = {
  sm: 6, md: 10, lg: 16, xl: 20, full: 999,
}

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
}

export const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  en_piso:    { bg: '#0c1f36', text: '#60a5fa' },
  controlado: { bg: '#0a1f14', text: '#4ade80' },
  en_carga:   { bg: '#2d0f00', text: '#fb923c' },
  finalizado: { bg: '#130f2e', text: '#a78bfa' },
  en_piso_p:  { bg: '#111827', text: '#64748b' },
  cargado:    { bg: '#0a1f14', text: '#4ade80' },
}
