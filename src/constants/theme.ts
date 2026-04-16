// ── Color Palette ─────────────────────────────────────────────────────────────
// Dark SaaS theme — GitHub-inspired slate, professional

export const colors = {
  // Backgrounds
  bg:          '#0d1117',
  surface:     '#161b22',
  surfaceHigh: '#21262d',
  elevated:    '#30363d',

  // Borders
  border:    '#21262d',
  borderMid: '#30363d',
  borderHigh:'#484f58',

  // Text
  text:      '#e6edf3',
  textMuted: '#8b949e',
  textFaint: '#6e7681',

  // Brand
  primary:     '#4493f8',
  primaryDark: '#1f6feb',
  primaryMid:  '#0c2d6b',
  primaryFaint:'#051d4d',

  // Semantic
  success:    '#3fb950',
  successDim: '#238636',
  warning:    '#d29922',
  warningDim: '#3d2b00',
  danger:     '#f85149',
  dangerDim:  '#3d0000',

  // Legacy aliases (keep for backward compat)
  orange: '#d29922',
  overlay: 'rgba(1,4,9,0.80)',
}

// ── Spacing (8pt system) ──────────────────────────────────────────────────────

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
}

// ── Border Radius ─────────────────────────────────────────────────────────────

export const radius = {
  xs: 4, sm: 6, md: 10, lg: 14, xl: 20, full: 999,
}

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
}

// ── Estado Colors ─────────────────────────────────────────────────────────────

export const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  en_piso:    { bg: '#051d4d', text: '#4493f8' },
  controlado: { bg: '#1a0a4d', text: '#a78bfa' },
  en_carga:   { bg: '#3d2b00', text: '#d29922' },
  finalizado: { bg: '#0d2c0d', text: '#3fb950' },
  cargado:    { bg: '#0d2c0d', text: '#3fb950' },
}
