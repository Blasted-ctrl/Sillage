const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail
              .map((error: { msg: string }) =>
                error.msg.replace(/^Value error, /, ''),
              )
              .join('. ')
          : 'The scent library is unavailable. Please try again in a moment.',
    )
  }
  return response.json() as Promise<T>
}
