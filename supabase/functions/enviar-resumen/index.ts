import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL') ?? 'noreply@resend.dev'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { email, resumen } = await req.json()

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Email inválido' }, { status: 400, headers: cors })
    }
    if (!resumen) {
      return Response.json({ error: 'Resumen requerido' }, { status: 400, headers: cors })
    }

    const html = generarHTML(resumen)
    const fecha = new Date(resumen.fecha_inicio)
      .toLocaleDateString('es-AR')
      .replace(/\//g, '-')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Resumen turno ${fecha} — ${resumen.controlador}`,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return Response.json({ error: err.message ?? `Resend error ${res.status}` }, { status: 500, headers: cors })
    }

    return Response.json({ ok: true }, { headers: cors })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: cors })
  }
})

// ── Generador HTML ────────────────────────────────────────────────────────────

function fmtH(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}
function estadoLabel(e: string): string {
  const m: Record<string, string> = {
    en_piso: 'En Piso', controlado: 'Controlado',
    en_carga: 'En Carga', finalizado: 'Finalizado', cargado: 'Cargado',
  }
  return m[e] ?? e
}
function estadoColor(e: string): string {
  if (e === 'finalizado' || e === 'cargado') return '#166534'
  if (e === 'en_carga')   return '#1d4ed8'
  if (e === 'controlado') return '#92400e'
  return '#475569'
}
function estadoBg(e: string): string {
  if (e === 'finalizado' || e === 'cargado') return '#dcfce7'
  if (e === 'en_carga')   return '#dbeafe'
  if (e === 'controlado') return '#fef3c7'
  return '#f1f5f9'
}

function generarHTML(r: any): string {
  const completados = r.totales.pallets > 0
    ? Math.round((r.totales.pallets_cargados / r.totales.pallets) * 100)
    : 0

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
          ${c.hora_llegada ? `<br><span style="font-size:11px;color:#9ca3af">Llegada: ${fmtH(c.hora_llegada)}</span>` : ''}
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

  <!-- Header -->
  <tr><td style="background:#0f172a;padding:28px 32px">
    <p style="margin:0;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px">Control de Carga</p>
    <h1 style="margin:6px 0 0;color:#fff;font-size:22px">Resumen del Turno</h1>
    <p style="margin:4px 0 0;color:#64748b;font-size:13px">${fmtFecha(r.fecha_inicio)} → ${fmtFecha(r.fecha_fin)}</p>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding:24px 32px 8px">
    <p style="margin:0 0 12px;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Controlador: ${r.controlador}</p>
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

  <!-- Tabla cargas -->
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

  <!-- Footer -->
  <tr><td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
    <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center">Generado por Control de Carga App</p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}
