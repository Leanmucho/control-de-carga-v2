// @ts-ignore — xlsx loaded via npm specifier on Deno
import * as XLSX from 'npm:xlsx@0.18.5'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM    = Deno.env.get('RESEND_FROM') ?? Deno.env.get('FROM_EMAIL') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, resumen } = await req.json()

    if (!email || !email.includes('@'))
      return Response.json({ error: 'Email inválido' }, { status: 400, headers: cors })
    if (!resumen)
      return Response.json({ error: 'Resumen requerido' }, { status: 400, headers: cors })
    if (!RESEND_API_KEY)
      return Response.json({ error: 'Secret RESEND_API_KEY no configurado' }, { status: 500, headers: cors })
    if (!RESEND_FROM)
      return Response.json({ error: 'Secret RESEND_FROM no configurado' }, { status: 500, headers: cors })

    const html  = generarHTML(resumen)
    const fecha = new Date(resumen.fecha_inicio)
      .toLocaleDateString('es-AR').replace(/\//g, '-')
    const nombre = String(resumen.controlador ?? 'turno').replace(/\s+/g, '_')

    // ── Generar Excel ────────────────────────────────────────────────────────
    const xlsxBase64 = generarExcelBase64(resumen)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: `Resumen turno ${fecha} — ${resumen.controlador}`,
        html,
        attachments: [
          {
            filename: `turno-${nombre}-${fecha}.xlsx`,
            content: xlsxBase64,
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return Response.json(
        { error: err.message ?? `Resend error ${res.status}`, detail: err },
        { status: 500, headers: cors }
      )
    }

    return Response.json({ ok: true }, { headers: cors })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function estadoLabel(e: string): string {
  const m: Record<string, string> = {
    en_piso: 'En Piso', controlado: 'Controlado',
    en_carga: 'En Carga', finalizado: 'Finalizado', cargado: 'Cargado',
  }
  return m[e] ?? e
}

function estadoColor(e: string)  { return e === 'finalizado' || e === 'cargado' ? '#166534' : e === 'en_carga' ? '#1d4ed8' : e === 'controlado' ? '#92400e' : '#475569' }
function estadoBg(e: string)     { return e === 'finalizado' || e === 'cargado' ? '#dcfce7' : e === 'en_carga' ? '#dbeafe' : e === 'controlado' ? '#fef3c7' : '#f1f5f9' }

// ── Excel – 5 hojas ───────────────────────────────────────────────────────────

function generarExcelBase64(r: any): string {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetResumen(r),     'Resumen')
  XLSX.utils.book_append_sheet(wb, sheetCargas(r),      'Cargas')
  XLSX.utils.book_append_sheet(wb, sheetClientes(r),    'Clientes')
  XLSX.utils.book_append_sheet(wb, sheetPallets(r),     'Pallets')
  XLSX.utils.book_append_sheet(wb, sheetIncidencias(r), 'Incidencias')
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

/** Hoja 1: Resumen general del turno */
function sheetResumen(r: any): any {
  const pct = r.totales.pallets > 0
    ? Math.round((r.totales.pallets_cargados / r.totales.pallets) * 100) : 0

  const rows = [
    ['RESUMEN DEL TURNO - CONTROL DE CARGA'],
    [],
    ['Controlador',        r.controlador],
    ['Inicio del turno',   fmtFecha(r.fecha_inicio)],
    ['Fin del turno',      fmtFecha(r.fecha_fin)],
    [],
    ['ESTADÍSTICAS GENERALES'],
    ['Cargas registradas', r.totales.cargas],
    ['Total pallets',      r.totales.pallets],
    ['Pallets cargados',   r.totales.pallets_cargados],
    ['Pallets pendientes', r.totales.pallets - r.totales.pallets_cargados],
    ['Total cajas',        r.totales.cajas],
    ['Incidencias',        r.totales.incidencias],
    ['% Completado',       `${pct}%`],
    [],
    ['CARGAS DEL TURNO'],
    ['#', 'Chofer', 'Transporte', 'Remito', 'Clarkista', 'Estado',
     'Llegada', 'Inicio Carga', 'Fin Carga',
     'Total Pallets', 'Pallets Cargados', 'Total Cajas', 'Incid.', 'Notas'],
    ...r.cargas.map((c: any) => [
      c.numero, c.chofer, c.transporte,
      c.numero_remito ?? '', c.clarkista ?? '',
      estadoLabel(c.estado),
      fmtHora(c.hora_llegada),
      fmtHora(c.hora_inicio_carga),
      fmtHora(c.hora_fin_carga),
      c.total_pallets, c.pallets_cargados, c.total_cajas,
      c.incidencias.length, c.notas ?? '',
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 22 }, { wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 13 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 7 }, { wch: 7 }, { wch: 24 },
  ]
  return ws
}

/** Hoja 2: Cargas con todos los campos */
function sheetCargas(r: any): any {
  const headers = [
    '#', 'Chofer', 'Transporte', 'Remito', 'Clarkista', 'Estado',
    'Llegada Camión', 'Inicio Carga', 'Fin Carga',
    'Total Pallets', 'Pallets Cargados', 'Pallets Pendientes',
    'Total Cajas', 'Incidencias', 'Notas',
  ]

  const rows = r.cargas.map((c: any) => [
    c.numero, c.chofer, c.transporte,
    c.numero_remito ?? '', c.clarkista ?? '',
    estadoLabel(c.estado),
    fmtHora(c.hora_llegada),
    fmtHora(c.hora_inicio_carga),
    fmtHora(c.hora_fin_carga),
    c.total_pallets, c.pallets_cargados,
    c.total_pallets - c.pallets_cargados,
    c.total_cajas, c.incidencias.length, c.notas ?? '',
  ])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 5 }, { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 13 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 7 }, { wch: 7 }, { wch: 24 },
  ]
  return ws
}

/** Hoja 3: Clientes por carga con totales */
function sheetClientes(r: any): any {
  const headers = [
    'Carga #', 'Chofer', 'Transporte', 'Remito',
    'Cliente', 'Orden',
    'Pallets Hoja Ruta', 'Pallets Cargados', 'Pallets Pendientes',
    'Cajas Hoja Ruta', 'Cajas Cargadas', '% Completado',
  ]

  const rows: unknown[][] = []
  for (const c of r.cargas) {
    for (const cl of c.clientes) {
      const pct = cl.total_pallets > 0
        ? Math.round((cl.pallets_cargados / cl.total_pallets) * 100) : 0
      rows.push([
        c.numero, c.chofer, c.transporte, c.numero_remito ?? '',
        cl.nombre, cl.orden ?? '',
        cl.total_pallets, cl.pallets_cargados,
        cl.total_pallets - cl.pallets_cargados,
        cl.cajas_hoja_ruta ?? cl.total_cajas, cl.total_cajas,
        `${pct}%`,
      ])
    }
    // Subtotal por carga
    rows.push([
      `TOTAL CARGA ${c.numero}`, c.chofer, '', '',
      `${c.clientes.length} clientes`, '',
      c.total_pallets, c.pallets_cargados,
      c.total_pallets - c.pallets_cargados,
      '', c.total_cajas, '',
    ])
    rows.push([]) // separador
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
    { wch: 22 }, { wch: 7 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
  ]
  return ws
}

/** Hoja 4: Pallets individuales con subtotales */
function sheetPallets(r: any): any {
  const headers = [
    'Carga #', 'Chofer', 'Transporte', 'Remito',
    'Cliente', 'Pallet #', 'Cantidad Cajas', 'Estado', 'Hora Carga',
  ]

  const rows: unknown[][] = []
  for (const c of r.cargas) {
    for (const cl of c.clientes) {
      for (const p of cl.pallets) {
        rows.push([
          c.numero, c.chofer, c.transporte, c.numero_remito ?? '',
          cl.nombre, `P${p.numero}`, p.cantidad_cajas,
          estadoLabel(p.estado), fmtHora(p.hora_carga),
        ])
      }
      // Subtotal cliente
      rows.push([
        '', `  ▸ Total ${cl.nombre}`, '', '',
        '', `${cl.pallets_cargados}/${cl.total_pallets} cargados`,
        cl.total_cajas, '', '',
      ])
    }
    // Subtotal carga
    rows.push([
      '', `━━ TOTAL CARGA ${c.numero}`, c.chofer, '',
      `${c.clientes.length} clientes`,
      `${c.pallets_cargados}/${c.total_pallets}`,
      c.total_cajas, '', '',
    ])
    rows.push([]) // separador
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 8 }, { wch: 24 }, { wch: 14 }, { wch: 12 },
    { wch: 22 }, { wch: 9 }, { wch: 9 }, { wch: 13 }, { wch: 14 },
  ]
  return ws
}

/** Hoja 5: Incidencias */
function sheetIncidencias(r: any): any {
  const headers = ['Carga #', 'Chofer', 'Transporte', 'Remito', 'Tipo', 'Descripción', 'Hora']
  const rows: unknown[][] = []

  for (const c of r.cargas) {
    for (const inc of c.incidencias) {
      rows.push([
        c.numero, c.chofer, c.transporte, c.numero_remito ?? '',
        inc.tipo, inc.descripcion, fmtHora(inc.hora),
      ])
    }
  }

  if (rows.length === 0) rows.push(['—', '—', '—', '—', '—', 'Sin incidencias registradas', '—'])

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 8 }, { wch: 20 }, { wch: 14 }, { wch: 12 },
    { wch: 18 }, { wch: 40 }, { wch: 14 },
  ]
  return ws
}

// ── HTML del email ────────────────────────────────────────────────────────────

function generarHTML(r: any): string {
  const completados = r.totales.pallets > 0
    ? Math.round((r.totales.pallets_cargados / r.totales.pallets) * 100) : 0

  const filaCargas = r.cargas.map((c: any) => {
    const clientes = c.clientes.map((cl: any) =>
      `<li style="margin:2px 0">${cl.nombre}: <b>${cl.pallets_cargados}/${cl.total_pallets}</b> pallets · <b>${cl.total_cajas}</b> cajas</li>`
    ).join('')

    const incBadge = c.incidencias.length > 0
      ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;">⚠ ${c.incidencias.length} incid.</span>`
      : '<span style="color:#9ca3af;font-size:11px;">—</span>'

    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <b style="font-size:14px">${c.chofer}</b><br>
          <span style="font-size:12px;color:#6b7280">${c.transporte}${c.numero_remito ? ` · Rem. ${c.numero_remito}` : ''}</span>
          ${c.clarkista ? `<br><span style="font-size:11px;color:#9ca3af">Clarkista: ${c.clarkista}</span>` : ''}
          ${c.hora_llegada ? `<br><span style="font-size:11px;color:#9ca3af">Llegada: ${fmtHora(c.hora_llegada)}</span>` : ''}
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top">
          <ul style="margin:0;padding-left:16px;font-size:12px;color:#374151">${clientes}</ul>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top">
          <b style="font-size:16px;color:#16a34a">${c.pallets_cargados}/${c.total_pallets}</b><br>
          <span style="font-size:11px;color:#6b7280">${c.total_cajas} cajas</span>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top">
          <span style="background:${estadoBg(c.estado)};color:${estadoColor(c.estado)};padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700">${estadoLabel(c.estado)}</span>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:center;vertical-align:top">${incBadge}</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

  <tr><td style="background:#0f172a;padding:28px 32px">
    <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Control de Carga</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:22px">Resumen del Turno</h1>
    <p style="margin:8px 0 0;color:#fff;font-size:17px;font-weight:700">👤 ${r.controlador}</p>
    <p style="margin:4px 0 0;color:#64748b;font-size:13px">${fmtFecha(r.fecha_inicio)} → ${fmtFecha(r.fecha_fin)}</p>
  </td></tr>

  <tr><td style="padding:24px 32px 8px">
    <p style="margin:0 0 12px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Turno de ${r.controlador}</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="background:#f1f5f9;border-radius:10px;padding:16px 8px;width:25%">
          <b style="font-size:28px;color:#0f172a">${r.totales.cargas}</b>
          <p style="margin:4px 0 0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Cargas</p>
        </td>
        <td width="8"></td>
        <td align="center" style="background:#f1f5f9;border-radius:10px;padding:16px 8px;width:25%">
          <b style="font-size:28px;color:#16a34a">${r.totales.pallets_cargados}/${r.totales.pallets}</b>
          <p style="margin:4px 0 0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Pallets</p>
        </td>
        <td width="8"></td>
        <td align="center" style="background:#f1f5f9;border-radius:10px;padding:16px 8px;width:25%">
          <b style="font-size:28px;color:#0f172a">${r.totales.cajas}</b>
          <p style="margin:4px 0 0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Cajas</p>
        </td>
        <td width="8"></td>
        <td align="center" style="background:${r.totales.incidencias > 0 ? '#fef3c7' : '#f1f5f9'};border-radius:10px;padding:16px 8px;width:25%">
          <b style="font-size:28px;color:${r.totales.incidencias > 0 ? '#92400e' : '#0f172a'}">${r.totales.incidencias}</b>
          <p style="margin:4px 0 0;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Incid.</p>
        </td>
      </tr>
    </table>
    <div style="background:#dbeafe;border-radius:8px;padding:10px 16px;margin-top:12px;text-align:center">
      <b style="color:#1d4ed8;font-size:15px">${completados}% completado</b>
    </div>
  </td></tr>

  <tr><td style="padding:24px 32px">
    <p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.6px">Detalle por carga</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <tr style="background:#f8fafc">
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Chofer / Transporte</th>
        <th style="padding:10px 14px;text-align:left;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Clientes</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Pallets</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Estado</th>
        <th style="padding:10px 14px;text-align:center;font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Incid.</th>
      </tr>
      ${filaCargas}
    </table>
  </td></tr>

  <tr><td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
    <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">
      📎 Excel adjunto con detalle completo (Cargas · Clientes · Pallets · Incidencias)<br>
      Generado por Control de Carga App
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}
