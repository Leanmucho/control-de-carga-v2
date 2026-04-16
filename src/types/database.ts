export interface Perfil {
  id: string
  nombre: string
  rol: 'controlador' | 'clarkista' | 'admin'
  email: string | null
  created_at: string
}

export interface Turno {
  id: string
  controlador_id: string
  fecha_inicio: string
  fecha_fin: string | null
  activo: boolean
  created_at: string
  // joins
  controlador?: Perfil
}

export interface Carga {
  id: string
  turno_id: string
  chofer: string
  transporte: string
  numero_remito: string
  clarkista_id: string | null
  clarkista_nombre: string
  estado: 'en_piso' | 'controlado' | 'en_carga' | 'finalizado'
  hora_llegada_camion: string | null
  hora_inicio_carga: string | null
  hora_fin_carga: string | null
  notas: string
  created_at: string
  // computed joins
  clientes_carga?: ClienteCarga[]
  incidencias?: Incidencia[]
}

export interface ClienteCarga {
  id: string
  carga_id: string
  nombre: string
  orden: number
  pallets_hoja_ruta: number | null
  cajas_hoja_ruta: number | null
  // joins
  pallets?: Pallet[]
}

export interface Pallet {
  id: string
  cliente_carga_id: string
  cantidad_cajas: number
  estado: 'en_piso' | 'cargado'
  hora_carga: string | null
  created_at: string
}

export interface Incidencia {
  id: string
  carga_id: string
  tipo: string
  descripcion: string
  hora: string
}

// Vista resumen
export interface ResumenCarga {
  id: string
  turno_id: string
  chofer: string
  transporte: string
  estado: string
  created_at: string
  total_clientes: number
  total_pallets: number
  pallets_cargados: number
  total_cajas: number
  total_incidencias: number
}
