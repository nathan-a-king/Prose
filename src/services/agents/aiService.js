/**
 * AI Service for Agent System
 *
 * Provides unified interface for making AI calls from agents.
 * Routes all requests through backend proxy for security.
 * API keys are encrypted via Electron safeStorage.
 */

const DEFAULT_MODEL = 'gpt-4o'

/**
 * Get API key from secure storage
 */
async function getApiKey() {
  // Try secure storage first (Electron safeStorage)
  if (window.secureStorage) {
    try {
      const key = await window.secureStorage.get('openai_api_key')
      if (key) {
        return key
      }
    } catch (error) {
      console.error('[AI Service] Error retrieving key from secure storage:', error)
    }
  }

  // Migration fallback: check localStorage
  const storedKey = localStorage.getItem('openai_api_key')
  if (storedKey) {
    console.warn('[AI Service] Found key in localStorage. Please save it in Settings to encrypt it.')
    return storedKey
  }

  // Dev fallback: environment variable
  const envKey = import.meta.env?.VITE_OPENAI_API_KEY
  if (envKey) {
    console.warn('[AI Service] Using environment variable API key')
    return envKey
  }

  return null
}

/**
 * Make a completion request to OpenAI via backend proxy
 */
export async function makeCompletion(options) {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 4000,
    responseFormat = 'text' // 'text' or 'json'
  } = options

  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set it in Settings.')
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  const requestBody = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  }

  // Add response format for JSON mode if requested
  if (responseFormat === 'json') {
    requestBody.response_format = { type: 'json_object' }
  }

  try {
    const response = await fetch('/api/ai/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      let errorMessage = errorData.error || `API error: ${response.status}`

      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key in Settings.'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      }

      console.error('[AI Service] API Error:', errorMessage, errorData)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON if requested
    if (responseFormat === 'json') {
      try {
        return JSON.parse(content)
      } catch (error) {
        console.error('[AI Service] Failed to parse JSON response:', content)
        throw new Error('AI returned invalid JSON')
      }
    }

    return content
  } catch (error) {
    console.error('[AI Service] Error:', error.message || error)
    throw error
  }
}

/**
 * Make a streaming completion request via backend proxy
 * @returns {Promise<Function>} abort - Call to cancel the stream and cleanup resources
 */
export async function makeStreamingCompletion(options, onChunk) {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 4000
  } = options

  const apiKey = await getApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set it in Settings.')
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  // Create AbortController for cancellation
  const abortController = new AbortController()
  let reader = null
  let isAborted = false

  // Abort function to return to caller
  const abort = () => {
    isAborted = true

    // Cancel reader if it exists
    if (reader) {
      reader.cancel().catch(err => {
        console.warn('[AI Service] Error canceling reader:', err)
      })
    }

    // Abort fetch
    abortController.abort()
  }

  try {
    const response = await fetch('/api/ai/completion/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      }),
      signal: abortController.signal
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      let errorMessage = errorData.error || `API error: ${response.status}`

      if (response.status === 401) {
        errorMessage = 'Invalid API key. Please check your OpenAI API key in Settings.'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.'
      }

      console.error('[AI Service] Streaming API Error:', errorMessage, errorData)
      throw new Error(errorMessage)
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        // Check if aborted before reading
        if (isAborted) break

        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices[0]?.delta?.content
              if (content) {
                // Wrap onChunk in try-catch to prevent callback errors from leaking reader
                try {
                  onChunk(content)
                } catch (callbackError) {
                  console.error('[AI Service] Error in onChunk callback:', callbackError)
                  // Continue processing - don't let callback errors break the stream
                }
              }
            } catch (error) {
              console.error('[AI Service] Failed to parse stream chunk:', data)
            }
          }
        }
      }
    } finally {
      // CRITICAL: Always cancel reader in finally block to prevent resource leaks
      if (reader) {
        try {
          await reader.cancel()
        } catch (err) {
          console.warn('[AI Service] Error closing reader:', err)
        }
      }
    }

    return abort
  } catch (error) {
    // Handle abort gracefully - don't throw on user-initiated abort
    if (error.name === 'AbortError') {
      return abort
    }

    console.error('[AI Service] Streaming Error:', error)
    throw error
  }
}

/**
 * Count tokens in text (approximate)
 */
export function estimateTokens(text) {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

/**
 * Check if API key is configured
 */
export async function isApiKeyConfigured() {
  const key = await getApiKey()
  return !!key
}
