import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { makeCompletion, makeStreamingCompletion, estimateTokens, isApiKeyConfigured } from '../aiService'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset storage mocks
    window.secureStorage = undefined
    localStorage.getItem.mockReturnValue(null)
    // Reset import.meta.env — use delete so the value is truly absent
    delete import.meta.env.VITE_OPENAI_API_KEY
  })

  describe('API key retrieval', () => {
    test('throws when no API key is available', async () => {
      await expect(
        makeCompletion({ systemPrompt: 'test', userPrompt: 'test' })
      ).rejects.toThrow('OpenAI API key not configured')
    })

    test('uses secureStorage when available', async () => {
      window.secureStorage = {
        get: vi.fn().mockResolvedValue('sk-secure-key')
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' } }]
        })
      })

      await makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })

      expect(window.secureStorage.get).toHaveBeenCalledWith('openai_api_key')
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'sk-secure-key'
          })
        })
      )
    })

    test('falls back to localStorage when secureStorage has no key', async () => {
      window.secureStorage = {
        get: vi.fn().mockResolvedValue(null)
      }
      localStorage.getItem.mockReturnValue('sk-local-key')

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' } }]
        })
      })

      await makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'sk-local-key'
          })
        })
      )
    })

    test('falls back to localStorage when secureStorage throws', async () => {
      window.secureStorage = {
        get: vi.fn().mockRejectedValue(new Error('IPC error'))
      }
      localStorage.getItem.mockReturnValue('sk-local-key')

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' } }]
        })
      })

      await makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'sk-local-key'
          })
        })
      )
    })

    test('falls back to env variable when no storage key', async () => {
      import.meta.env.VITE_OPENAI_API_KEY = 'sk-env-key'

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'response' } }]
        })
      })

      await makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/completion',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'sk-env-key'
          })
        })
      )
    })
  })

  describe('makeCompletion', () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue('sk-test-key')
    })

    test('sends correct request body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'AI response' } }]
        })
      })

      await makeCompletion({
        systemPrompt: 'You are helpful',
        userPrompt: 'Hello',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2000
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.model).toBe('gpt-4o')
      expect(body.temperature).toBe(0.5)
      expect(body.max_tokens).toBe(2000)
      expect(body.messages).toEqual([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ])
    })

    test('returns text content by default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Plain text response' } }]
        })
      })

      const result = await makeCompletion({
        systemPrompt: 'sys',
        userPrompt: 'user'
      })

      expect(result).toBe('Plain text response')
    })

    test('parses JSON when responseFormat is json', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"ideas": ["one", "two"]}' } }]
        })
      })

      const result = await makeCompletion({
        systemPrompt: 'sys',
        userPrompt: 'user',
        responseFormat: 'json'
      })

      expect(result).toEqual({ ideas: ['one', 'two'] })

      // Verify json mode was requested
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.response_format).toEqual({ type: 'json_object' })
    })

    test('throws on invalid JSON response when json format requested', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'not valid json' } }]
        })
      })

      await expect(
        makeCompletion({ systemPrompt: 'sys', userPrompt: 'user', responseFormat: 'json' })
      ).rejects.toThrow('AI returned invalid JSON')
    })

    test('throws descriptive error for 401 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })

      await expect(
        makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })
      ).rejects.toThrow('Invalid API key')
    })

    test('throws descriptive error for 429 status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Too many requests' })
      })

      await expect(
        makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })
      ).rejects.toThrow('Rate limit exceeded')
    })

    test('throws generic error for other status codes', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      await expect(
        makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })
      ).rejects.toThrow('Internal server error')
    })

    test('handles non-JSON error response body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('Not JSON'))
      })

      await expect(
        makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })
      ).rejects.toThrow('API error: 503')
    })

    test('uses default model and parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'ok' } }]
        })
      })

      await makeCompletion({ systemPrompt: 'sys', userPrompt: 'user' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.model).toBe('gpt-4o')
      expect(body.temperature).toBe(0.7)
      expect(body.max_tokens).toBe(4000)
    })
  })

  describe('makeStreamingCompletion', () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue('sk-test-key')
    })

    function createMockStream(chunks) {
      const encoder = new TextEncoder()
      let index = 0
      return {
        getReader: () => ({
          read: vi.fn().mockImplementation(async () => {
            if (index >= chunks.length) {
              return { done: true, value: undefined }
            }
            const chunk = chunks[index++]
            return { done: false, value: encoder.encode(chunk) }
          }),
          cancel: vi.fn().mockResolvedValue(undefined)
        })
      }
    }

    test('streams chunks to onChunk callback', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n'
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(chunks)
      })

      const onChunk = vi.fn()
      await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        onChunk
      )

      expect(onChunk).toHaveBeenCalledWith('Hello')
      expect(onChunk).toHaveBeenCalledWith(' world')
      expect(onChunk).toHaveBeenCalledTimes(2)
    })

    test('returns abort function', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n'])
      })

      const result = await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        vi.fn()
      )

      expect(typeof result).toBe('function')
    })

    test('sends request to streaming endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n'])
      })

      await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        vi.fn()
      )

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/completion/stream',
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal)
        })
      )
    })

    test('throws on 401 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })

      await expect(
        makeStreamingCompletion(
          { systemPrompt: 'sys', userPrompt: 'user' },
          vi.fn()
        )
      ).rejects.toThrow('Invalid API key')
    })

    test('throws on 429 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({})
      })

      await expect(
        makeStreamingCompletion(
          { systemPrompt: 'sys', userPrompt: 'user' },
          vi.fn()
        )
      ).rejects.toThrow('Rate limit exceeded')
    })

    test('continues streaming when onChunk callback throws', async () => {
      const chunks = [
        'data: {"choices":[{"delta":{"content":"chunk1"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"chunk2"}}]}\n\n',
        'data: [DONE]\n\n'
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(chunks)
      })

      const onChunk = vi.fn()
        .mockImplementationOnce(() => { throw new Error('Callback error') })
        .mockImplementation(() => {})

      // Should not throw despite callback error
      await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        onChunk
      )

      expect(onChunk).toHaveBeenCalledTimes(2)
    })

    test('handles abort gracefully', async () => {
      mockFetch.mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))

      const result = await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        vi.fn()
      )

      // Should return abort function, not throw
      expect(typeof result).toBe('function')
    })

    test('throws on no API key', async () => {
      localStorage.getItem.mockReturnValue(null)

      await expect(
        makeStreamingCompletion(
          { systemPrompt: 'sys', userPrompt: 'user' },
          vi.fn()
        )
      ).rejects.toThrow('OpenAI API key not configured')
    })

    test('skips malformed SSE data lines', async () => {
      const chunks = [
        'data: not-json\n\n',
        'data: {"choices":[{"delta":{"content":"valid"}}]}\n\n',
        'data: [DONE]\n\n'
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        body: createMockStream(chunks)
      })

      const onChunk = vi.fn()
      await makeStreamingCompletion(
        { systemPrompt: 'sys', userPrompt: 'user' },
        onChunk
      )

      expect(onChunk).toHaveBeenCalledWith('valid')
      expect(onChunk).toHaveBeenCalledTimes(1)
    })
  })

  describe('estimateTokens', () => {
    test('estimates roughly 1 token per 4 characters', () => {
      expect(estimateTokens('hello world')).toBe(3) // 11 chars / 4 = 2.75 → 3
    })

    test('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('isApiKeyConfigured', () => {
    test('returns true when key is available', async () => {
      localStorage.getItem.mockReturnValue('sk-test')

      const result = await isApiKeyConfigured()

      expect(result).toBe(true)
    })

    test('returns false when no key is available', async () => {
      const result = await isApiKeyConfigured()

      expect(result).toBe(false)
    })
  })
})
