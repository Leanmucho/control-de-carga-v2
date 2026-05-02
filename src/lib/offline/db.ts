// TypeScript fallback. Metro picks db.native.ts (iOS/Android) or db.web.ts (web)
// at bundle time via platform extensions; this file only exists so `tsc` can
// resolve `./db` imports. Keep the API identical across all three.
export * from './db.native'
