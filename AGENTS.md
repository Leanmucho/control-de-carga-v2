# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Warehouse truck-load tracking app: Expo (React Native) + Supabase. Operators (`controlador`) start a `turno` (shift), register `cargas` (truck loads), break each load down by `cliente` and individual `pallet`, log `incidencias`, and on shift close trigger an email summary with an Excel attachment. Ships as an Android APK (offline-capable) and a web SPA on Vercel. UI strings, DB columns, and most identifiers are in **Spanish**.

## Commands

```bash
# Dev
npm start                 # Expo dev server (QR for Expo Go / dev client)
npm run android           # Open on connected Android device/emulator
npm run web               # Web (used for Vercel-style preview)

# After changing native deps or bumping Expo SDK
npx expo install --fix    # Aligns expo-* package versions to the SDK

# Web build (what Vercel runs — see vercel.json)
npx expo export --platform web --output-dir dist

# APK build (EAS, cloud)
eas login
eas build --platform android --profile preview      # Internal APK
eas build --platform android --profile production   # Prod APK with env vars baked in

# Edge Function deploy (email + Excel)
supabase functions deploy enviar-resumen
supabase secrets set RESEND_API_KEY=... RESEND_FROM=...
```

There is **no test runner, no linter, and no formatter** wired up. Don't invent npm scripts that aren't in `package.json`.

## Environment

`.env` (gitignored) and `eas.json` `production.env` must define:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The Edge Function reads `RESEND_API_KEY` and `RESEND_FROM` from Supabase secrets (not from `.env`).

## Architecture

### Routing (expo-router, file-based)

```
app/
  _layout.tsx         # Auth gate + DB init + AppState→sync wiring
  (auth)/login.tsx    # Public route group
  (main)/             # Authenticated tab group (Turno / Cargas / Historial)
    _layout.tsx       # Tabs config + useKeepAwake
    turno/            # Active shift; "Cerrar turno" triggers email
    carga/index.tsx, nueva.tsx, [id]/index.tsx, [id]/pallets.tsx
    historial/index.tsx
```

`app/_layout.tsx` redirects between `(auth)` and `(main)` based on `useAuth().session`. It also initializes SQLite (`initDb()`) and registers an `AppState` listener that calls `syncOfflineQueue()` when the app returns to foreground (skipped on web).

### Data layer — three coordinated stores

1. **Supabase Postgres** (source of truth) — schema in `supabase_schema.sql`. Tables: `perfiles`, `turnos`, `cargas`, `clientes_carga`, `pallets`, `incidencias`. Data isolation per controller via `.eq('controlador_id', user.id)` filters in queries. State machine on `cargas.estado`: `en_piso → controlado → en_carga → finalizado` (see `src/constants/estados.ts` `TRANSICIONES`).

2. **`src/lib/queries/*.ts`** — thin wrappers around `supabase.from(...)` for each table. All mutations go through these. They are also called from the offline sync executor.

3. **Offline cache + write queue** (`src/lib/offline/`)
   - `db.native.ts` / `db.web.ts` — platform-split SQLite wrapper. Native uses `expo-sqlite`; web uses a no-op or in-memory shim. **Never import `./db` directly in code that runs on web** — Metro picks the right file by extension.
   - `queue.ts` — `enqueueOp(op)` persists a typed `OfflineOp` (CHECK_PALLET, CREATE_CARGA, AVANZAR_ESTADO, ADD_CLIENTE, etc.) into SQLite when a mutation can't reach the network.
   - `sync.ts` — `syncOfflineQueue()` drains the queue by dispatching each op to the matching `queries/*` function. Called on app resume and after manual reconnect. Failed ops stay queued.

   The hooks (`useCarga`, `useTurnoActivo`, `usePallets`) read from cache first, then revalidate against Supabase, so the UI works without internet.

### Auth storage (important gotcha)

`src/lib/supabase.ts` provides custom auth storage:
- **Web**: `localStorage` directly (NOT `expo-secure-store` — its Promises don't reliably resolve on web and hang `signInWithPassword`).
- **Native**: `expo-secure-store` with **chunking at 1800 chars** because JWTs exceed SecureStore's per-key limit. If you change auth flows, preserve the chunked read/write path.

### Shift summary + email (`src/lib/turnoResumen.ts` → `supabase/functions/enviar-resumen/`)

Closing a turno builds a `ResumenTurno` (controller name, all cargas, totals, incidencias) and POSTs it to the `enviar-resumen` Edge Function. The function:
- Generates a 5-sheet Excel via `npm:xlsx@0.18.5` (Resumen, Cargas, Clientes, Pallets, Incidencias).
- Sends it as a base64 attachment via Resend with an HTML body that prominently shows the controller's name (multiple controllers can share the deployment).

There is also `expo-mail-composer` available client-side as a fallback for opening a native mail app, but the production path is the Edge Function.

## Conventions specific to this codebase

- **Modals** use bottom-sheet pattern: `<Modal transparent animationType="slide">` → `<KeyboardAvoidingView behavior={ios?'padding':'height'}>` → outer `<TouchableWithoutFeedback>` (close on backdrop) → `<View styles.modalOverlay>` → inner `<TouchableWithoutFeedback onPress={()=>{}}>` (block bubbling) → `<View styles.modalBox>`. Any new modal with text inputs must include the `KeyboardAvoidingView` wrapper or the keyboard will hide the buttons on Android.
- **`<Input secureTextEntry>`** (in `src/components/ui/Input.tsx`) auto-renders a "Mostrar/Ocultar" toggle — don't reimplement it per screen.
- **State transitions** for `cargas` must go through the `TRANSICIONES` map; the UI advances exactly one step at a time. The `avanzarEstado` query mirrors this.
- **Only one active turno at a time** — enforced by a partial unique index `idx_turnos_activo ON turnos(activo) WHERE activo = TRUE`. Code that creates turnos must close the active one first.
- **No design system library** — `src/components/ui/{Button,Card,Input}.tsx` + `src/constants/theme.ts` (colors/spacing/radius) are the entire primitives set. Stay consistent with these rather than importing a UI kit.
- **Web vs native split** — guard native-only APIs (`AppState`, `expo-sqlite`, haptics) with `Platform.OS === 'web'` returns or use the `.native.ts`/`.web.ts` filename split.

## Deployment targets

- **Web** → Vercel. `vercel.json` runs `expo export --platform web` and rewrites all paths to `index.html` (SPA).
- **Android APK** → EAS Build. `eas.json` `production` profile bakes Supabase env vars at build time and outputs an APK (not AAB) for sideloading. See `COMO_GENERAR_APK.md` for the manual install flow.
- **Edge Function** → `supabase/functions/enviar-resumen/index.ts` (Deno runtime, deployed via `supabase functions deploy`).
