export const ESTADOS_CARGA = ['en_piso', 'controlado', 'en_carga', 'finalizado'] as const
export type EstadoCarga = typeof ESTADOS_CARGA[number]

export const ESTADOS_PALLET = ['en_piso', 'cargado'] as const
export type EstadoPallet = typeof ESTADOS_PALLET[number]

export const TIPOS_INCIDENCIA = [
  'Pallet dañado',
  'Faltante',
  'Demora',
  'Sobrante',
  'Otro',
] as const
export type TipoIncidencia = typeof TIPOS_INCIDENCIA[number]

export const ESTADO_LABELS: Record<EstadoCarga, string> = {
  en_piso:    'En Piso',
  controlado: 'Controlado',
  en_carga:   'En Carga',
  finalizado: 'Finalizado',
}

export const TRANSICIONES: Record<EstadoCarga, EstadoCarga | null> = {
  en_piso:    'controlado',
  controlado: 'en_carga',
  en_carga:   'finalizado',
  finalizado: null,
}

export const TRANSICION_LABELS: Record<EstadoCarga, string> = {
  en_piso:    '✅ Marcar Controlado en Piso',
  controlado: '🚛 Iniciar Carga al Camión',
  en_carga:   '🏁 Finalizar Carga',
  finalizado: '',
}
