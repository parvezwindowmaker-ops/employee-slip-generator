const DEFAULT_SERVER_ERROR =
  'Server error. Please try again later or contact support.'

export async function readResponse(response) {
  const text = await response.text()
  if (!text) return null

  const contentType = response.headers.get('content-type')?.toLowerCase() || ''
  const trimmed = text.trim()
  const looksLikeJson =
    contentType.includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[')

  if (!looksLikeJson) return trimmed

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

export function requireJsonPayload(payload) {
  if (payload && typeof payload === 'object') return payload
  throw new Error('The server returned an invalid response. Please try again.')
}

export function isNetworkError(error) {
  return (
    error instanceof TypeError &&
    /fetch|network|load failed|connection/i.test(error.message)
  )
}

function payloadMessage(payload) {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    if (!trimmed || trimmed.startsWith('<') || trimmed.length > 300) return ''
    return trimmed
  }

  if (payload && typeof payload === 'object') {
    return payload.error || payload.message || ''
  }

  return ''
}

export function createHttpError(response, payload, options = {}) {
  const {
    defaultMessage = 'Request failed. Please try again.',
    unauthorizedMessage,
  } = options

  const serverMessage = payloadMessage(payload)
  let message = serverMessage || defaultMessage

  if (response.status === 401 && unauthorizedMessage) {
    message = unauthorizedMessage
  } else if (response.status === 403) {
    message = serverMessage || 'You do not have permission to perform this action.'
  } else if (response.status === 404) {
    message = serverMessage || 'The requested resource was not found.'
  } else if (response.status >= 500) {
    message = DEFAULT_SERVER_ERROR
  }

  const error = new Error(message)
  error.status = response.status
  return error
}
