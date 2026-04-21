import * as XLSX from 'xlsx'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import type { Carga, Turno } from '../../types/database'

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function minutosEntre(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return ''
  const diff = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
  return `${diff} min`
}

export async function exportarTurnoExcel(turno: Turno, cargas: Carga[]): Promise<void> {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Resumen del turno ──────────────────────────────────────────────
  const totalPallets = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce((s2, cl) => s2 + (cl.pallets?.length ?? 0), 0) ?? 0), 0
  )
  const cargados = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce(
      (s2, cl) => s2 + (cl.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
    ) ?? 0), 0
  )
  const totalCajas = cargas.reduce(
    (s, c) => s + (c.clientes_carga?.reduce(
      (s2, cl) => s2 + (cl.pallets?.reduce((s3, p) => s3 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
    ) ?? 0), 0
  )
  const totalIncidencias = cargas.reduce((s, c) => s + (c.incidencias?.length ?? 0), 0)

  const wsResumen = XLSX.utils.aoa_to_sheet([
    ['RESUMEN DEL TURNO'],
    [],
    ['Inicio turno', fmtFecha(turno.fecha_inicio)],
    ['Fin turno',    fmtFecha(turno.fecha_fin)],
    ['Total cargas', cargas.length],
    ['Total pallets', totalPallets],
    ['Pallets cargados', cargados],
    ['Pallets pendientes', totalPallets - cargados],
    ['Total cajas', totalCajas],
    ['Total incidencias', totalIncidencias],
  ])
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // ── Hoja 2: Cargas ─────────────────────────────────────────────────────────
  const cargasRows = [
    ['Chofer', 'Transporte', 'Remito', 'Clarkista', 'Estado',
     'Llegada camión', 'Inicio carga', 'Fin carga', 'Duración',
     'Pallets', 'Cargados', 'Cajas', 'Incidencias', 'Notas'],
    ...cargas.map(c => {
      const tp = c.clientes_carga?.reduce((s, cl) => s + (cl.pallets?.length ?? 0), 0) ?? 0
      const ca = c.clientes_carga?.reduce(
        (s, cl) => s + (cl.pallets?.filter(p => p.estado === 'cargado').length ?? 0), 0
      ) ?? 0
      const tj = c.clientes_carga?.reduce(
        (s, cl) => s + (cl.pallets?.reduce((s2, p) => s2 + (p.cantidad_cajas ?? 0), 0) ?? 0), 0
      ) ?? 0
      return [
        c.chofer, c.transporte, c.numero_remito ?? '',
        c.clarkista_nombre ?? '', c.estado,
        fmtFecha(c.hora_llegada_camion),
        fmtFecha(c.hora_inicio_carga),
        fmtFecha(c.hora_fin_carga),
        minutosEntre(c.hora_inicio_carga, c.hora_fin_carga),
        tp, ca, tj,
        c.incidencias?.length ?? 0,
        c.notas ?? '',
      ]
    }),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cargasRows), 'Cargas')

  // ── Hoja 3: Detalle pallets ────────────────────────────────────────────────
  const palletRows: unknown[][] = [
    ['Chofer', 'Transporte', 'Cliente', 'Orden',
     'Pallets HR', 'Cajas HR', 'Nro Pallet', 'Cajas', 'Estado', 'Hora carga'],
  ]
  for (const c of cargas) {
    for (const cl of c.clientes_carga ?? []) {
      const ps = cl.pallets ?? []
      if (ps.length === 0) {
        palletRows.push([c.chofer, c.transporte, cl.nombre, cl.orden,
          cl.pallets_hoja_ruta ?? '', cl.cajas_hoja_ruta ?? '',
          '-', '-', 'sin pallets', ''])
      } else {
        ps.forEach((p, i) => {
          palletRows.push([
            i === 0 ? c.chofer : '',
            i === 0 ? c.transporte : '',
            i === 0 ? cl.nombre : '',
            i === 0 ? cl.orden : '',
            i === 0 ? (cl.pallets_hoja_ruta ?? '') : '',
            i === 0 ? (cl.cajas_hoja_ruta ?? '') : '',
            i + 1,
            p.cantidad_cajas,
            p.estado,
            fmtFecha(p.hora_carga),
          ])
        })
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(palletRows), 'Detalle pallets')

  // ── Hoja 4: Incidencias ────────────────────────────────────────────────────
  const incRows: unknown[][] = [
    ['Chofer', 'Transporte', 'Tipo', 'Descripción', 'Hora'],
  ]
  for (const c of cargas) {
    for (const inc of c.incidencias ?? []) {
      incRows.push([c.chofer, c.transporte, inc.tipo, inc.descripcion, fmtFecha(inc.hora)])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'Incidencias')

  // ── Hoja 5: Hoja de ruta vs real ──────────────────────────────────────────
  const hrRows: unknown[][] = [
    ['Chofer', 'Transporte', 'Cliente', 'Pallets HR', 'Pallets Real',
     'Diferencia pallets', 'Cajas HR', 'Cajas Real', 'Diferencia cajas'],
  ]
  for (const c of cargas) {
    for (const cl of c.clientes_carga ?? []) {
      const realPallets = cl.pallets?.length ?? 0
      const realCajas = cl.pallets?.reduce((s, p) => s + (p.cantidad_cajas ?? 0), 0) ?? 0
      const hrPallets = cl.pallets_hoja_ruta ?? 0
      const hrCajas = cl.cajas_hoja_ruta ?? 0
      hrRows.push([
        c.chofer, c.transporte, cl.nombre,
        hrPallets || '', realPallets,
        hrPallets ? realPallets - hrPallets : '',
        hrCajas || '', realCajas,
        hrCajas ? realCajas - hrCajas : '',
      ])
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hrRows), 'Hoja de ruta')

  // ── Escribir archivo y compartir ──────────────────────────────────────────
  const binary = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
  const fecha = new Date(turno.fecha_inicio).toISOString().slice(0, 10)
  const fileName = `turno_${fecha}.xlsx`
  const path = `${FileSystem.documentDirectory}${fileName}`

  await FileSystem.writeAsStringAsync(path, binary, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Turno ${fecha}`,
    })
  } else {
    throw new Error('Compartir archivos no está disponible en este dispositivo')
  }
}
