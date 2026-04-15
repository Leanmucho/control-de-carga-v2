/**
 * turnoResumen.ts
 * Genera y guarda localmente el resumen del turno.
 * Al finalizar el turno se guarda un snapshot completo en AsyncStorage
 * para poder enviarlo por email incluso sin internet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as MailComposer from 'expo-mail-composer'
import { supabase } from './supabase'

const STORAGE_KEY = 'ultimo_turno_resumen'

export interface ResumenPallet {
  numero: number
  cantidad_cajas: number
  estado: string
}

export interface ResumenCliente {
  nombre: string
  pallets: ResumenPallet[]
  total_pallets: number
  pallets_cargados: number
  total_cajas: number
}

export interface ResumenCarga {
  chofer: string
  transporte: string
  numero_remito: string | null
  clarkista: string | null
  estado: string
  hora_llegada: string | null
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

/** Carga el resumen completo del turno desde Supabase */
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
      hora_llegada_camion, notas,
      clientes_carga (
        nombre,
        pallets ( cantidad_cajas, estado )
      ),
      incidencias ( tipo, descripcion, hora )
    `)
    .eq('turno_id', turnoId)
    .order('created_at', { ascending: true })

  const resumenCargas: ResumenCarga[] = (cargas ?? []).map(c => {
    const clientes: ResumenCliente[] = (c.clientes_carga ?? []).map((cl: any) => {
      const pallets: ResumenPallet[] = (cl.pallets ?? []).map((p: any, i: number) => ({
        numero: i + 1,
        cantidad_cajas: p.cantidad_cajas ?? 0,
        estado: p.estado,
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
      chofer: c.chofer,
      transporte: c.transporte,
      numero_remito: c.numero_remito ?? null,
      clarkista: c.clarkista_nombre ?? null,
      estado: c.estado,
      hora_llegada: c.hora_llegada_camion ?? null,
      clientes,
      incidencias: (c.incidencias ?? []).map((i: any) => ({
        tipo: i.tipo,
        descripcion: i.descripcion,
        hora: i.hora,
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

/** Guarda el resumen localmente (persiste sin internet) */
export async function guardarResumenLocal(resumen: ResumenTurno): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(resumen))
}

/** Carga el último resumen guardado localmente */
export async function cargarResumenLocal(): Promise<ResumenTurno | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

/** Formatea el resumen como texto plano para el email */
function formatearResumenTexto(r: ResumenTurno): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  const fmtHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

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

  r.cargas.forEach((c, i) => {
    lineas.push(`[${i + 1}] ${c.chofer} — ${c.transporte}`)
    if (c.numero_remito) lineas.push(`    Remito: ${c.numero_remito}`)
    if (c.clarkista)     lineas.push(`    Clarkista: ${c.clarkista}`)
    if (c.hora_llegada)  lineas.push(`    Llegada camión: ${fmtHora(c.hora_llegada)}`)
    lineas.push(`    Estado: ${c.estado.replace('_', ' ').toUpperCase()}`)
    lineas.push(`    Pallets: ${c.pallets_cargados}/${c.total_pallets}  |  Cajas: ${c.total_cajas}`)

    c.clientes.forEach(cl => {
      lineas.push(`    • ${cl.nombre}: ${cl.pallets_cargados}/${cl.total_pallets} pallets — ${cl.total_cajas} cajas`)
    })

    if (c.incidencias.length > 0) {
      lineas.push('    ⚠ Incidencias:')
      c.incidencias.forEach(inc => {
        lineas.push(`      - [${inc.tipo}] ${inc.descripcion} (${fmtHora(inc.hora)})`)
      })
    }

    if (c.notas) lineas.push(`    📝 ${c.notas}`)
    lineas.push('')
  })

  lineas.push('====================================')
  lineas.push('Generado por Control de Carga App')

  return lineas.join('\n')
}

/** Abre el cliente de mail nativo con el resumen del turno */
export async function enviarResumenPorEmail(
  resumen: ResumenTurno,
  destinatario?: string
): Promise<'sent' | 'saved' | 'cancelled' | 'unavailable'> {
  const disponible = await MailComposer.isAvailableAsync()
  if (!disponible) return 'unavailable'

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

  const asunto = `Resumen turno ${fmt(resumen.fecha_inicio)} — ${resumen.controlador}`
  const cuerpo = formatearResumenTexto(resumen)

  const result = await MailComposer.composeAsync({
    recipients: destinatario ? [destinatario] : [],
    subject: asunto,
    body: cuerpo,
  })

  return result.status as 'sent' | 'saved' | 'cancelled'
}
