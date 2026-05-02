import type { Carga, ClienteCarga } from '../types/database'

export interface CargaMetrics {
  clientes: number
  pallets: number
  palletsCargados: number
  palletsPendientes: number
  cajas: number
  cajasCargadas: number
  hojaPallets: number
  hojaCajas: number
  diffPallets: number
  diffCajas: number
  tieneHojaRuta: boolean
  tieneDiferencias: boolean
  incidencias: number
}

export function getCargaMetrics(carga: Carga): CargaMetrics {
  const clientes = carga.clientes_carga ?? []
  const pallets = clientes.reduce((sum, cl) => sum + (cl.pallets?.length ?? 0), 0)
  const palletsCargados = clientes.reduce(
    (sum, cl) => sum + (cl.pallets?.filter(p => p.estado === 'cargado').length ?? 0),
    0,
  )
  const cajas = clientes.reduce(
    (sum, cl) => sum + (cl.pallets?.reduce((s, p) => s + (p.cantidad_cajas ?? 0), 0) ?? 0),
    0,
  )
  const cajasCargadas = clientes.reduce(
    (sum, cl) => sum + (
      cl.pallets
        ?.filter(p => p.estado === 'cargado')
        .reduce((s, p) => s + (p.cantidad_cajas ?? 0), 0) ?? 0
    ),
    0,
  )
  const hojaPallets = clientes.reduce((sum, cl) => sum + (cl.pallets_hoja_ruta ?? 0), 0)
  const hojaCajas = clientes.reduce((sum, cl) => sum + (cl.cajas_hoja_ruta ?? 0), 0)
  const tieneHojaRuta = clientes.some(cl => cl.pallets_hoja_ruta != null || cl.cajas_hoja_ruta != null)
  const diffPallets = tieneHojaRuta ? pallets - hojaPallets : 0
  const diffCajas = tieneHojaRuta ? cajas - hojaCajas : 0

  return {
    clientes: clientes.length,
    pallets,
    palletsCargados,
    palletsPendientes: pallets - palletsCargados,
    cajas,
    cajasCargadas,
    hojaPallets,
    hojaCajas,
    diffPallets,
    diffCajas,
    tieneHojaRuta,
    tieneDiferencias: diffPallets !== 0 || diffCajas !== 0,
    incidencias: carga.incidencias?.length ?? 0,
  }
}

export function getClienteDiff(cliente: ClienteCarga) {
  const pallets = cliente.pallets?.length ?? 0
  const cajas = cliente.pallets?.reduce((sum, p) => sum + (p.cantidad_cajas ?? 0), 0) ?? 0
  const diffPallets = cliente.pallets_hoja_ruta == null ? 0 : pallets - cliente.pallets_hoja_ruta
  const diffCajas = cliente.cajas_hoja_ruta == null ? 0 : cajas - cliente.cajas_hoja_ruta
  return {
    pallets,
    cajas,
    diffPallets,
    diffCajas,
    tieneDiferencias: diffPallets !== 0 || diffCajas !== 0,
  }
}

export function getCargaWarnings(carga: Carga): string[] {
  const m = getCargaMetrics(carga)
  const warnings: string[] = []

  if (m.clientes === 0) warnings.push('No hay clientes registrados.')
  if (m.pallets === 0) warnings.push('No hay pallets registrados.')
  if (m.palletsPendientes > 0) warnings.push(`Quedan ${m.palletsPendientes} pallet(s) en piso.`)
  if (m.tieneDiferencias) {
    if (m.diffPallets !== 0) warnings.push(`Diferencia de pallets contra hoja de ruta: ${formatDiff(m.diffPallets)}.`)
    if (m.diffCajas !== 0) warnings.push(`Diferencia de cajas contra hoja de ruta: ${formatDiff(m.diffCajas)}.`)
  }
  if (m.incidencias > 0) warnings.push(`Hay ${m.incidencias} incidencia(s) registradas.`)

  return warnings
}

export function formatDiff(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}
