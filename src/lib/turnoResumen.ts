/**
 * turnoResumen.ts
 * Genera el resumen del turno, lo guarda localmente y lo exporta como CSV para Excel.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as MailComposer from 'expo-mail-composer'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const STORAGE_KEY = 'ultimo_turno_resumen'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ResumenPallet {
  numero: number
  cantidad_cajas: number
  estado: string
  hora_carga: string | null
}

export interface ResumenCliente {
  nombre: string
  pallets: ResumenPallet[]
  total_pallets: number
  pallets_cargados: number
  total_cajas: number
}

export interface ResumenCarga {
  numero: number
  chofer: string
  transporte: string
  numero_remito: string | null
  clarkista: string | null
  estado: string
  hora_llegada: string | null
  hora_inicio_carga: string | null
  hora_fin_carga: string | null
  clientes: ResumenCliente[]
  incidencias: { tipo: string; descripcion: string; hora: string }[]
  notas: string | null
  total_pallets: number
  pallets_cargados: number
  total_cajas: number
}

export interface ResumenTurno {
  fecha_inicio: string
  fecha_fin: string
  controlador: string
  cargas: ResumenCarga[]
  totales: {
    cargas: number
    pallets: number
    pallets_cargados: number
    cajas: number
    incidencias: number
  }
}

// ── Construcción desde Supabase ───────────────────────────────────────────────

export async function construirResumen(turnoId: string, controladorNombre: string): Promise<ResumenTurno> {
  const { data: turno } = await supabase
    .from('turnos')
    .select('fecha_inicio, fecha_fin')
    .eq('id', turnoId)
    .single()

  const { data: cargas } = await supabase
    .from('cargas')
    .select(`
      chofer, transporte, numero_remito, clarkista_nombre, estado,
      hora_llegada_camion, hora_inicio_carga, hora_fin_carga, notas,
      clientes_carga ( nombre, pallets ( cantidad_cajas, estado, hora_carga ) ),
      incidencias ( tipo, descripcion, hora )
    `)
    .eq('turno_id', turnoId)
    .order('created_at', { ascending: true })

  const resumenCargas: ResumenCarga[] = (cargas ?? []).map((c, cargaIdx) => {
    const clientes: ResumenCliente[] = (c.clientes_carga ?? []).map((cl: any) => {
      const pallets: ResumenPallet[] = (cl.pallets ?? []).map((p: any, i: number) => ({
        numero: i + 1,
        cantidad_cajas: p.cantidad_cajas ?? 0,
        estado: p.estado,
        hora_carga: p.hora_carga ?? null,
      }))
      const cargados = pallets.filter(p => p.estado === 'cargado').length
      return {
        nombre: cl.nombre,
        pallets,
        total_pallets: pallets.length,
        pallets_cargados: cargados,
        total_cajas: pallets.reduce((s, p) => s + p.cantidad_cajas, 0),
      }
    })
    const totalP = clientes.reduce((s, cl) => s + cl.total_pallets, 0)
    const cargadosP = clientes.reduce((s, cl) => s + cl.pallets_cargados, 0)
    return {
      numero: cargaIdx + 1,
      chofer: c.chofer,
      transporte: c.transporte,
      numero_remito: c.numero_remito ?? null,
      clarkista: c.clarkista_nombre ?? null,
      estado: c.estado,
      hora_llegada: c.hora_llegada_camion ?? null,
      hora_inicio_carga: c.hora_inicio_carga ?? null,
      hora_fin_carga: c.hora_fin_carga ?? null,
      clientes,
      incidencias: (c.incidencias ?? []).map((i: any) => ({
        tipo: i.tipo, descripcion: i.descripcion, hora: i.hora,
      })),
      notas: c.notas ?? null,
      total_pallets: totalP,
      pallets_cargados: cargadosP,
      total_cajas: clientes.reduce((s, cl) => s + cl.total_cajas, 0),
    }
  })

  const totales = {
    cargas: resumenCargas.length,
    pallets: resumenCargas.reduce((s, c) => s + c.total_pallets, 0),
    pallets_cargados: resumenCargas.reduce((s, c) => s + c.pallets_cargados, 0),
    cajas: resumenCargas.reduce((s, c) => s + c.total_cajas, 0),
    incidencias: resumenCargas.reduce((s, c) => s + c.incidencias.length, 0),
  }

  return {
    fecha_inicio: turno?.fecha_inicio ?? new Date().toISOString(),
    fecha_fin: turno?.fecha_fin ?? new Date().toISOString(),
    controlador: controladorNombre,
    cargas: resumenCargas,
    totales,
  }
}

// ── Persistencia local ────────────────────────────────────────────────────────

export async function guardarResumenLocal(resumen: ResumenTurno): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resumen))
}

export async function cargarResumenLocal(): Promise<ResumenTurno | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

// ── Generación CSV (compatible Excel) ────────────────────────────────────────

function esc(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtHora(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function estadoLabel(e: string): string {
  const map: Record<string, string> = {
    en_piso: 'En Piso', controlado: 'Controlado',
    en_carga: 'En Carga', finalizado: 'Finalizado',
    cargado: 'Cargado',
  }
  return map[e] ?? e
}

export function generarCSV(r: ResumenTurno): string {
  const rows: string[] = []

  // ── Encabezado del turno
  rows.push('RESUMEN DE TURNO - CONTROL DE CARGA')
  rows.push('')
  rows.push(`Controlador,${esc(r.controlador)}`)
  rows.push(`Inicio,${esc(fmtFecha(r.fecha_inicio))}`)
  rows.push(`Fin,${esc(fmtFecha(r.fecha_fin))}`)
  rows.push('')

  // ── Totales
  rows.push('TOTALES DEL TURNO')
  rows.push(`Cargas registradas,${r.totales.cargas}`)
  rows.push(`Total pallets,${r.totales.pallets}`)
  rows.push(`Pallets cargados,${r.totales.pallets_cargados}`)
  rows.push(`Pallets pendientes,${r.totales.pallets - r.totales.pallets_cargados}`)
  rows.push(`Total cajas,${r.totales.cajas}`)
  rows.push(`Incidencias,${r.totales.incidencias}`)
  rows.push('')

  // ── Resumen de cargas
  rows.push('RESUMEN POR CARGA')
  rows.push([
    '#', 'Chofer', 'Transporte', 'Remito', 'Clarkista', 'Estado',
    'Llegada camión', 'Inicio carga', 'Fin carga',
    'Total pallets', 'Pallets cargados', 'Total cajas', 'Incidencias', 'Notas',
  ].map(esc).join(','))

  r.cargas.forEach(c => {
    rows.push([
      c.numero, c.chofer, c.transporte,
      c.numero_remito ?? '', c.clarkista ?? '',
      estadoLabel(c.estado),
      fmtHora(c.hora_llegada),
      fmtHora(c.hora_inicio_carga),
      fmtHora(c.hora_fin_carga),
      c.total_pallets, c.pallets_cargados, c.total_cajas,
      c.incidencias.length,
      c.notas ?? '',
    ].map(esc).join(','))
  })
  rows.push('')

  // ── Detalle de pallets
  rows.push('DETALLE DE PALLETS POR CLIENTE')
  rows.push([
    'Carga N°', 'Chofer', 'Cliente', 'Pallet N°', 'Cantidad cajas', 'Estado', 'Hora carga',
  ].map(esc).join(','))

  r.cargas.forEach(c => {
    c.clientes.forEach(cl => {
      cl.pallets.forEach(p => {
        rows.push([
          c.numero, c.chofer, cl.nombre,
          `P${p.numero}`, p.cantidad_cajas,
          estadoLabel(p.estado),
          fmtHora(p.hora_carga),
        ].map(esc).join(','))
      })
      // Subtotal por cliente
      rows.push([
        '', '', `TOTAL ${cl.nombre}`, '',
        cl.total_cajas,
        `${cl.pallets_cargados}/${cl.total_pallets} cargados`,
        '',
      ].map(esc).join(','))
    })
    // Subtotal por carga
    rows.push([
      '', `TOTAL CARGA ${c.numero}`, c.chofer, '',
      c.total_cajas,
      `${c.pallets_cargados}/${c.total_pallets} cargados`,
      '',
    ].map(esc).join(','))
    rows.push('')
  })

  // ── Incidencias
  if (r.totales.incidencias > 0) {
    rows.push('INCIDENCIAS')
    rows.push(['Carga N°', 'Chofer', 'Tipo', 'Descripción', 'Hora'].map(esc).join(','))
    r.cargas.forEach(c => {
      c.incidencias.forEach(inc => {
        rows.push([c.numero, c.chofer, inc.tipo, inc.descripcion, fmtHora(inc.hora)].map(esc).join(','))
      })
    })
    rows.push('')
  }

  rows.push('Generado por Control de Carga App')

  // BOM UTF-8 para que Excel abra con caracteres correctos
  return '\ufeff' + rows.join('\n')
}

// ── Compartir como archivo Excel (CSV) ───────────────────────────────────────

export async function compartirComoExcel(resumen: ResumenTurno): Promise<void> {
  const csv = generarCSV(resumen)
  const fecha = new Date(resumen.fecha_inicio)
    .toLocaleDateString('es-AR')
    .replace(/\//g, '-')
  const fileName = `turno-${resumen.controlador.replace(/\s+/g, '_')}-${fecha}.csv`

  if (Platform.OS === 'web') {
    // En web: descarga directa
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  // En móvil: guardar y compartir
  const fileUri = FileSystem.cacheDirectory + fileName
  await FileSystem.writeAsStringAsync(fileUri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  })

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar resumen de turno',
      UTI: 'public.comma-separated-values-text',
    })
  }
}

// ── Email con resumen de texto ────────────────────────────────────────────────

function formatearResumenTexto(r: ResumenTurno): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  const fmtH = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : '-'

  const lineas: string[] = [
    '====================================',
    '   RESUMEN DE TURNO - CONTROL CARGA',
    '====================================',
    '',
    `Controlador : ${r.controlador}`,
    `Inicio      : ${fmt(r.fecha_inicio)}`,
    `Fin         : ${fmt(r.fecha_fin)}`,
    '',
    '── TOTALES ──────────────────────────',
    `  Cargas     : ${r.totales.cargas}`,
    `  Pallets    : ${r.totales.pallets_cargados}/${r.totales.pallets}`,
    `  Cajas      : ${r.totales.cajas}`,
    `  Incidencias: ${r.totales.incidencias}`,
    '',
    '── DETALLE POR CARGA ─────────────────',
    '',
  ]

  r.cargas.forEach((c) => {
    lineas.push(`[${c.numero}] ${c.chofer} — ${c.transporte}`)
    if (c.numero_remito) lineas.push(`    Remito     : ${c.numero_remito}`)
    if (c.clarkista)     lineas.push(`    Clarkista  : ${c.clarkista}`)
    if (c.hora_llegada)  lineas.push(`    Llegada    : ${fmtH(c.hora_llegada)}`)
    lineas.push(`    Estado     : ${estadoLabel(c.estado)}`)
    lineas.push(`    Pallets    : ${c.pallets_cargados}/${c.total_pallets}  |  Cajas: ${c.total_cajas}`)
    c.clientes.forEach(cl => {
      lineas.push(`    • ${cl.nombre}: ${cl.pallets_cargados}/${cl.total_pallets} pallets · ${cl.total_cajas} cajas`)
      cl.pallets.forEach(p => {
        const check = p.estado === 'cargado' ? '✓' : '○'
        lineas.push(`        ${check} P${p.numero}: ${p.cantidad_cajas} cajas${p.hora_carga ? ' — ' + fmtH(p.hora_carga) : ''}`)
      })
    })
    if (c.incidencias.length > 0) {
      lineas.push('    ⚠ Incidencias:')
      c.incidencias.forEach(inc => {
        lineas.push(`      - [${inc.tipo}] ${inc.descripcion} (${fmtH(inc.hora)})`)
      })
    }
    if (c.notas) lineas.push(`    📝 ${c.notas}`)
    lineas.push('')
  })

  lineas.push('====================================')
  lineas.push('Generado por Control de Carga App')
  return lineas.join('\n')
}

export async function enviarResumenPorEmail(
  resumen: ResumenTurno,
  destinatario?: string
): Promise<'sent' | 'saved' | 'cancelled' | 'unavailable'> {
  const disponible = await MailComposer.isAvailableAsync()
  if (!disponible) return 'unavailable'

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

  const result = await MailComposer.composeAsync({
    recipients: destinatario ? [destinatario] : [],
    subject: `Resumen turno ${fmt(resumen.fecha_inicio)} — ${resumen.controlador}`,
    body: formatearResumenTexto(resumen),
  })

  return result.status as 'sent' | 'saved' | 'cancelled'
}
