/**
 * AI Service for Agent System
 *
 * Provides unified interface for making AI calls from agents.
 * Handles API key management, rate limiting, and error handling.
 */

const DEFAULT_MODEL = 'gpt-4o'
const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

/**
 * Get API key from environment or localStorage
 */
function getApiKey() {
  // Try environment variable (works in development with Vite)
  const envKey = import.meta.env?.VITE_OPENAI_API_KEY

  // Try localStorage (works in both dev and production)
  const storedKey = localStorage.getItem('openai_api_key')

  // Return whichever is available
  const apiKey = envKey || storedKey

  if (!apiKey) {
    console.warn('OpenAI API key not found. Please set it in the app or in environment.')
  }

  return apiKey
}

/**
 * Make a completion request to OpenAI
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

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
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
    console.log('[AI Service] Making completion request...', { model, temperature, maxTokens })

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('[AI Service] Response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = `OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`
      console.error('[AI Service] API Error:', errorMessage, errorData)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    console.log('[AI Service] Completion successful, content length:', content?.length || 0)

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
 * Make a streaming completion request
 */
export async function makeStreamingCompletion(options, onChunk) {
  const {
    systemPrompt,
    userPrompt,
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 4000
  } = options

  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  try {
    console.log('[AI Service] Making streaming completion request...', { model, temperature, maxTokens })

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      })
    })

    console.log('[AI Service] Streaming response status:', response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = `OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`
      console.error('[AI Service] Streaming API Error:', errorMessage, errorData)
      throw new Error(errorMessage)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
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
              onChunk(content)
            }
          } catch (error) {
            console.error('Failed to parse stream chunk:', data)
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming AI Service Error:', error)
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
export function isApiKeyConfigured() {
  return !!getApiKey()
}
