/**
 * UUID v4 generado en cliente — sin dependencias de crypto nativo.
 *
 * Lo usamos para IDs offline-first: generamos el UUID localmente, lo guardamos
 * en SQLite y, cuando hay red, lo enviamos al INSERT de Postgres.
 * Postgres acepta el ID porque su `DEFAULT gen_random_uuid()` solo se aplica
 * cuando la columna se omite. Así el ID local y el remoto son el mismo y
 * no hace falta remapear nada al sincronizar.
 */
export function genUuid(): string {
  // RFC4122 v4 — suficiente para identificar registros únicos en una app de un solo controlador.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
