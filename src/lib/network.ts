import { Platform } from 'react-native'

export async function isNetworkReachable(timeoutMs = 5000): Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  }

  const controller = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  try {
    const res = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-cache',
      signal: controller?.signal,
    })
    return res.status === 204 || res.ok
  } catch {
    return false
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
