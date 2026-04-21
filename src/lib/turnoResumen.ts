/**
 * turnoResumen.ts
 * Genera el resumen del turno, lo guarda localmente y lo exporta como XLSX.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as MailComposer from 'expo-mail-composer'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import * as XLSX from 'xlsx'
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

// ── Helpers de estilo Excel ───────────────────────────────────────────────────

function fmtFechaR(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

// Paleta de colores
const C = {
  navyBg:    '1E3A5F',
  navyText:  'FFFFFF',
  tealBg:    '0F766E',
  greenBg:   '166534',
  greenCell: 'DCFCE7',
  greenText: '166534',
  redCell:   'FEE2E2',
  redText:   '991B1B',
  orangeCell:'FEF3C7',
  orangeText:'92400E',
  blueLightBg:'DBEAFE',
  grayBg:    'F1F5F9',
  grayText:  '475569',
  border:    'CBD5E1',
  white:     'FFFFFF',
  titleBg:   '0F172A',
}

type XLSXStyle = {
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number; name?: string; italic?: boolean }
  fill?: { patternType: string; fgColor: { rgb: string } }
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean }
  border?: Record<string, { style: string; color: { rgb: string } }>
}

function solid(rgb: string): XLSXStyle['fill'] {
  return { patternType: 'solid', fgColor: { rgb } }
}

function allBorders(rgb = C.border): XLSXStyle['border'] {
  const s = { style: 'thin', color: { rgb } }
  return { top: s, bottom: s, left: s, right: s }
}

function sc(ws: XLSX.WorkSheet, r: number, c: number, style: XLSXStyle) {
  const addr = XLSX.utils.encode_cell({ r, c })
  if (!ws[addr]) ws[addr] = { t: 'z', v: '' }
  ws[addr].s = style
}

function styleRow(ws: XLSX.WorkSheet, row: number, numCols: number, style: XLSXStyle) {
  for (let c = 0; c < numCols; c++) sc(ws, row, c, style)
}

function styleRange(
  ws: XLSX.WorkSheet, r1: number, c1: number, r2: number, c2: number,
  style: XLSXStyle
) {
  for (let r = r1; r <= r2; r++)
    for (let c = c1; c <= c2; c++) sc(ws, r, c, style)
}

const headerStyle: XLSXStyle = {
  font: { bold: true, color: { rgb: C.navyText }, sz: 11, name: 'Calibri' },
  fill: solid(C.navyBg),
  alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
  border: allBorders('0F2040'),
}

const labelStyle: XLSXStyle = {
  font: { bold: true, color: { rgb: C.grayText }, sz: 10, name: 'Calibri' },
  fill: solid(C.grayBg),
  alignment: { horizontal: 'left', vertical: 'center' },
  border: allBorders(),
}

const valueStyle: XLSXStyle = {
  font: { sz: 10, name: 'Calibri' },
  fill: solid(C.white),
  alignment: { horizontal: 'left', vertical: 'center' },
  border: allBorders(),
}

const rowEvenStyle: XLSXStyle = {
  font: { sz: 10, name: 'Calibri' },
  fill: solid(C.white),
  alignment: { horizontal: 'left', vertical: 'center' },
  border: allBorders(),
}

const rowOddStyle: XLSXStyle = {
  font: { sz: 10, name: 'Calibri' },
  fill: solid(C.grayBg),
  alignment: { horizontal: 'left', vertical: 'center' },
  border: allBorders(),
}

function estadoStyle(estado: string): XLSXStyle {
  const base: XLSXStyle = {
    font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: C.grayText } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: allBorders(),
  }
  if (estado === 'finalizado') return { ...base, fill: solid(C.greenCell), font: { ...base.font, color: { rgb: C.greenText } } }
  if (estado === 'en_carga')   return { ...base, fill: solid(C.blueLightBg), font: { ...base.font, color: { rgb: C.navyBg } } }
  if (estado === 'controlado') return { ...base, fill: solid(C.orangeCell), font: { ...base.font, color: { rgb: C.orangeText } } }
  if (estado === 'cargado')    return { ...base, fill: solid(C.greenCell), font: { ...base.font, color: { rgb: C.greenText } } }
  return { ...base, fill: solid(C.white) }
}

function numStyle(rgb = C.navyBg): XLSXStyle {
  return {
    font: { bold: true, sz: 11, name: 'Calibri', color: { rgb } },
    fill: solid(C.white),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: allBorders(),
  }
}

// ── Hoja Resumen ──────────────────────────────────────────────────────────────

function buildResumenSheet(r: ResumenTurno): XLSX.WorkSheet {
  const completados = r.totales.pallets > 0
    ? Math.round((r.totales.pallets_cargados / r.totales.pallets) * 100)
    : 0

  // ─ Bloque superior: info + stats (6 cols para alinear con la tabla de cargas)
  const rows: unknown[][] = [
    ['RESUMEN DEL TURNO', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['Controlador', r.controlador, '', '', '', ''],
    ['Inicio del turno', fmtFechaR(r.fecha_inicio), '', '', '', ''],
    ['Fin del turno', fmtFechaR(r.fecha_fin), '', '', '', ''],
    ['', '', '', '', '', ''],
    ['ESTADÍSTICAS', '', '', '', '', ''],
    ['Cargas registradas', r.totales.cargas, '', '', '', ''],
    ['Total pallets', r.totales.pallets, '', '', '', ''],
    ['Pallets cargados', r.totales.pallets_cargados, '', '', '', ''],
    ['Pallets pendientes', r.totales.pallets - r.totales.pallets_cargados, '', '', '', ''],
    ['Total cajas', r.totales.cajas, '', '', '', ''],
    ['Incidencias', r.totales.incidencias, '', '', '', ''],
    ['% Completado', `${completados}%`, '', '', '', ''],
    ['', '', '', '', '', ''],
  ]

  // ─ Tabla de cargas
  const cargaHeaders = ['#', 'Chofer', 'Transporte', 'Pallets', 'Cajas', 'Estado']
  rows.push(cargaHeaders)
  const cargaDataStart = rows.length

  for (const c of r.cargas) {
    rows.push([
      c.numero, c.chofer, c.transporte,
      `${c.pallets_cargados}/${c.total_pallets}`,
      c.total_cajas,
      c.estado,
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
  ws['!rows'] = [{ hpt: 30 }, { hpt: 6 }]
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 5 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 5 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 5 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 5 } },
    { s: { r: 7, c: 1 }, e: { r: 7, c: 5 } },
    { s: { r: 8, c: 1 }, e: { r: 8, c: 5 } },
    { s: { r: 9, c: 1 }, e: { r: 9, c: 5 } },
    { s: { r: 10, c: 1 }, e: { r: 10, c: 5 } },
    { s: { r: 11, c: 1 }, e: { r: 11, c: 5 } },
    { s: { r: 12, c: 1 }, e: { r: 12, c: 5 } },
    { s: { r: 13, c: 1 }, e: { r: 13, c: 5 } },
  ]

  // Título principal
  sc(ws, 0, 0, {
    font: { bold: true, sz: 14, color: { rgb: C.navyText }, name: 'Calibri' },
    fill: solid(C.titleBg),
    alignment: { horizontal: 'center', vertical: 'center' },
  })

  // Subtítulo ESTADÍSTICAS
  sc(ws, 6, 0, {
    font: { bold: true, sz: 11, color: { rgb: C.navyText }, name: 'Calibri' },
    fill: solid(C.navyBg),
    alignment: { horizontal: 'center', vertical: 'center' },
  })

  // Filas de info (2-4)
  for (let row = 2; row <= 4; row++) {
    sc(ws, row, 0, labelStyle)
    sc(ws, row, 1, valueStyle)
  }

  // Filas de stats (7-13)
  for (let row = 7; row <= 13; row++) {
    sc(ws, row, 0, labelStyle)
    const isGood = row === 9
    const isBad  = row === 10 && (r.totales.pallets - r.totales.pallets_cargados) > 0
    const isWarn = row === 12 && r.totales.incidencias > 0
    if (isGood)      sc(ws, row, 1, { ...valueStyle, fill: solid(C.greenCell),  font: { bold: true, color: { rgb: C.greenText },  sz: 10 } })
    else if (isBad)  sc(ws, row, 1, { ...valueStyle, fill: solid(C.redCell),    font: { bold: true, color: { rgb: C.redText },    sz: 10 } })
    else if (isWarn) sc(ws, row, 1, { ...valueStyle, fill: solid(C.orangeCell), font: { bold: true, color: { rgb: C.orangeText }, sz: 10 } })
    else             sc(ws, row, 1, valueStyle)
  }

  // Subtítulo CARGAS (fila 15)
  const cargaHeaderRow = cargaDataStart - 1
  styleRow(ws, cargaHeaderRow, cargaHeaders.length, headerStyle)

  // Filas de cargas
  for (let i = 0; i < r.cargas.length; i++) {
    const ri = cargaDataStart + i
    const base = i % 2 === 0 ? rowEvenStyle : rowOddStyle
    styleRow(ws, ri, cargaHeaders.length, base)
    sc(ws, ri, 0, { ...base, alignment: { horizontal: 'center' } })
    sc(ws, ri, 3, { ...base, alignment: { horizontal: 'center' } })
    sc(ws, ri, 4, { ...base, alignment: { horizontal: 'center' } })
    sc(ws, ri, 5, estadoStyle(r.cargas[i].estado))
  }

  return ws
}

// ── Hoja Cargas ───────────────────────────────────────────────────────────────

function buildCargasSheet(r: ResumenTurno): XLSX.WorkSheet {
  const headers = ['#', 'Chofer', 'Transporte', 'Remito', 'Clarkista', 'Estado',
    'Llegada', 'Inicio carga', 'Fin carga', 'Pallets', 'Cargados', 'Cajas', 'Incid.', 'Notas']

  const dataRows = r.cargas.map(c => [
    c.numero, c.chofer, c.transporte, c.numero_remito ?? '', c.clarkista ?? '',
    c.estado,
    fmtFechaR(c.hora_llegada), fmtFechaR(c.hora_inicio_carga), fmtFechaR(c.hora_fin_carga),
    c.total_pallets, c.pallets_cargados, c.total_cajas, c.incidencias.length, c.notas ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 13 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 9 }, { wch: 7 }, { wch: 7 }, { wch: 24 },
  ]
  ws['!rows'] = [{ hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.ColInfo

  // Header
  styleRow(ws, 0, headers.length, headerStyle)

  // Datos
  dataRows.forEach((row, i) => {
    const ri = i + 1
    const base = ri % 2 === 0 ? rowEvenStyle : rowOddStyle
    styleRow(ws, ri, headers.length, base)
    // # centrado
    sc(ws, ri, 0, { ...base, alignment: { horizontal: 'center' } })
    // Estado con color
    sc(ws, ri, 5, estadoStyle(String(row[5])))
    // Nums centrados
    for (const col of [9, 10, 11, 12]) {
      sc(ws, ri, col, { ...base, alignment: { horizontal: 'center' } })
    }
    // Incidencias en naranja si > 0
    if (Number(row[12]) > 0) {
      sc(ws, ri, 12, { ...base, fill: solid(C.orangeCell), font: { bold: true, color: { rgb: C.orangeText }, sz: 10 }, alignment: { horizontal: 'center' } })
    }
  })

  return ws
}

// ── Hoja Detalle pallets ──────────────────────────────────────────────────────

function buildPalletsSheet(r: ResumenTurno): XLSX.WorkSheet {
  const headers = ['Carga #', 'Chofer', 'Cliente', 'Pallet #', 'Cajas', 'Estado', 'Hora carga']
  const dataRows: unknown[][] = []

  for (const c of r.cargas) {
    for (const cl of c.clientes) {
      for (const p of cl.pallets) {
        dataRows.push([c.numero, c.chofer, cl.nombre, p.numero, p.cantidad_cajas, p.estado, fmtFechaR(p.hora_carga)])
      }
      // Subtotal por cliente
      dataRows.push(['', '', `▸ Total ${cl.nombre}`, '', cl.total_cajas,
        `${cl.pallets_cargados}/${cl.total_pallets} cargados`, ''])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 22 }, { wch: 9 }, { wch: 7 }, { wch: 13 }, { wch: 14 }]
  ws['!rows'] = [{ hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.ColInfo

  styleRow(ws, 0, headers.length, headerStyle)

  let ri = 1
  for (const c of r.cargas) {
    for (const cl of c.clientes) {
      for (const p of cl.pallets) {
        const base = ri % 2 === 0 ? rowEvenStyle : rowOddStyle
        styleRow(ws, ri, headers.length, base)
        sc(ws, ri, 0, { ...base, alignment: { horizontal: 'center' } })
        sc(ws, ri, 3, { ...base, alignment: { horizontal: 'center' } })
        sc(ws, ri, 4, { ...base, alignment: { horizontal: 'center' } })
        sc(ws, ri, 5, estadoStyle(p.estado))
        ri++
      }
      // Fila subtotal
      styleRow(ws, ri, headers.length, {
        font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: C.navyBg } },
        fill: solid(C.blueLightBg),
        alignment: { horizontal: 'left', vertical: 'center' },
        border: allBorders(),
      })
      sc(ws, ri, 4, {
        font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: C.navyBg } },
        fill: solid(C.blueLightBg),
        alignment: { horizontal: 'center' },
        border: allBorders(),
      })
      ri++
    }
  }

  return ws
}

// ── Hoja Incidencias ──────────────────────────────────────────────────────────

function buildIncidenciasSheet(r: ResumenTurno): XLSX.WorkSheet {
  const headers = ['Carga #', 'Chofer', 'Tipo', 'Descripción', 'Hora']
  const dataRows: unknown[][] = []
  for (const c of r.cargas) {
    for (const inc of c.incidencias) {
      dataRows.push([c.numero, c.chofer, inc.tipo, inc.descripcion, fmtFechaR(inc.hora)])
    }
  }
  if (dataRows.length === 0) dataRows.push(['—', '—', '—', 'Sin incidencias registradas', '—'])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  ws['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 40 }, { wch: 14 }]
  ws['!rows'] = [{ hpt: 22 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.ColInfo

  // Header naranja/rojo para incidencias
  styleRow(ws, 0, headers.length, {
    font: { bold: true, color: { rgb: C.navyText }, sz: 11, name: 'Calibri' },
    fill: solid('7F1D1D'),
    alignment: { horizontal: 'center', vertical: 'center' },
    border: allBorders('5F0F0F'),
  })

  dataRows.forEach((_, i) => {
    const ri = i + 1
    const base: XLSXStyle = {
      font: { sz: 10, name: 'Calibri' },
      fill: solid(ri % 2 === 0 ? C.white : 'FFF7F7'),
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: allBorders('FECACA'),
    }
    styleRow(ws, ri, headers.length, base)
    sc(ws, ri, 0, { ...base, alignment: { horizontal: 'center' } })
    sc(ws, ri, 2, { ...base, fill: solid(C.orangeCell), font: { bold: true, color: { rgb: C.orangeText }, sz: 10 } })
  })

  return ws
}

// ── Función principal ─────────────────────────────────────────────────────────

export async function compartirComoExcel(resumen: ResumenTurno): Promise<void> {
  const fecha = new Date(resumen.fecha_inicio)
    .toLocaleDateString('es-AR')
    .replace(/\//g, '-')
  const safeNombre = resumen.controlador.replace(/\s+/g, '_')

  if (Platform.OS === 'web') {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, buildResumenSheet(resumen),     '📊 Resumen')
    XLSX.utils.book_append_sheet(wb, buildCargasSheet(resumen),      '🚛 Cargas')
    XLSX.utils.book_append_sheet(wb, buildPalletsSheet(resumen),     '📦 Pallets')
    XLSX.utils.book_append_sheet(wb, buildIncidenciasSheet(resumen), '⚠ Incidencias')
    const binary = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true })
    const blob = new Blob([binary], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `turno-${safeNombre}-${fecha}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildResumenSheet(resumen),       '📊 Resumen')
  XLSX.utils.book_append_sheet(wb, buildCargasSheet(resumen),        '🚛 Cargas')
  XLSX.utils.book_append_sheet(wb, buildPalletsSheet(resumen),       '📦 Pallets')
  XLSX.utils.book_append_sheet(wb, buildIncidenciasSheet(resumen),   '⚠ Incidencias')

  const binary = XLSX.write(wb, { type: 'base64', bookType: 'xlsx', cellStyles: true })
  const fileUri = `${FileSystem.documentDirectory}turno-${safeNombre}-${fecha}.xlsx`
  await FileSystem.writeAsStringAsync(fileUri, binary, {
    encoding: FileSystem.EncodingType.Base64,
  })

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Turno ${fecha} — ${resumen.controlador}`,
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

/**
 * Envía el resumen directamente por email vía el backend Flask.
 * No abre ninguna app de correo.
 */
export async function enviarResumenConAdjunto(
  resumen: ResumenTurno,
  destinatario: string,
): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase no configurado')

  const res = await fetch(`${supabaseUrl}/functions/v1/enviar-resumen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ email: destinatario, resumen }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error al enviar (${res.status})`)
  }
}
