import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { documentApi } from '../documentApi'

describe('documentApi', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getAll', () => {
    test('fetches all documents from API', async () => {
      const mockDocuments = [
        { id: 1, title: 'Doc 1', content: 'Content 1' },
        { id: 2, title: 'Doc 2', content: 'Content 2' }
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDocuments
      })

      const result = await documentApi.getAll()

      expect(mockFetch).toHaveBeenCalledWith('/api/documents')
      expect(result).toEqual(mockDocuments)
    })

    test('throws error on failed request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' })
      })

      await expect(documentApi.getAll()).rejects.toThrow('Server error')
    })

    test('returns empty array when no documents', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => []
      })

      const result = await documentApi.getAll()
      expect(result).toEqual([])
    })
  })

  describe('getById', () => {
    test('fetches single document by id', async () => {
      const mockDocument = { id: 1, title: 'Test Doc', content: 'Test content' }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockDocument
      })

      const result = await documentApi.getById(1)

      expect(mockFetch).toHaveBeenCalledWith('/api/documents/1')
      expect(result).toEqual(mockDocument)
    })

    test('throws 404 error when document not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Document not found' })
      })

      await expect(documentApi.getById(999)).rejects.toThrow('Document not found')
    })
  })

  describe('create', () => {
    test('creates new document with all fields', async () => {
      const newDocument = {
        id: 1,
        title: 'New Document',
        content: 'New content',
        preview: 'New...'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => newDocument
      })

      const result = await documentApi.create(
        'New Document',
        'New content',
        'New...',
        false
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'New Document',
          content: 'New content',
          preview: 'New...',
          titleManuallySet: false
        })
      })
      expect(result).toEqual(newDocument)
    })

    test('creates document with titleManuallySet true', async () => {
      const newDocument = { id: 1, title: 'Manual Title', title_manually_set: true }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => newDocument
      })

      await documentApi.create('Manual Title', 'Content', 'Preview', true)

      expect(mockFetch).toHaveBeenCalledWith('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('"titleManuallySet":true')
      })
    })

    test('defaults titleManuallySet to false', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 })
      })

      await documentApi.create('Title', 'Content', 'Preview')

      expect(mockFetch).toHaveBeenCalledWith('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('"titleManuallySet":false')
      })
    })

    test('throws error on validation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Title is required' })
      })

      await expect(documentApi.create('', 'Content', 'Preview')).rejects.toThrow(
        'Title is required'
      )
    })
  })

  describe('update', () => {
    test('updates existing document with all fields', async () => {
      const updatedDocument = {
        id: 1,
        title: 'Updated Title',
        content: 'Updated content',
        preview: 'Updated...'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => updatedDocument
      })

      const result = await documentApi.update(
        1,
        'Updated Title',
        'Updated content',
        'Updated...',
        true
      )

      expect(mockFetch).toHaveBeenCalledWith('/api/documents/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Updated Title',
          content: 'Updated content',
          preview: 'Updated...',
          titleManuallySet: true
        })
      })
      expect(result).toEqual(updatedDocument)
    })

    test('throws 404 error when updating non-existent document', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Document not found' })
      })

      await expect(
        documentApi.update(999, 'Title', 'Content', 'Preview')
      ).rejects.toThrow('Document not found')
    })

    test('defaults titleManuallySet to false on update', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 1 })
      })

      await documentApi.update(1, 'Title', 'Content', 'Preview')

      expect(mockFetch).toHaveBeenCalledWith('/api/documents/1', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: expect.stringContaining('"titleManuallySet":false')
      })
    })
  })

  describe('delete', () => {
    test('deletes document by id', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      const result = await documentApi.delete(1)

      expect(mockFetch).toHaveBeenCalledWith('/api/documents/1', {
        method: 'DELETE'
      })
      expect(result).toBeNull()
    })

    test('returns null on 204 No Content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      const result = await documentApi.delete(1)
      expect(result).toBeNull()
    })

    test('throws 404 error when deleting non-existent document', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Document not found' })
      })

      await expect(documentApi.delete(999)).rejects.toThrow('Document not found')
    })

    test('throws 403 error when lacking permission', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' })
      })

      await expect(documentApi.delete(1)).rejects.toThrow('Forbidden')
    })
  })

  describe('updateOrder', () => {
    test('updates document order with array of ids', async () => {
      const documentOrders = [
        { id: 3, order: 0 },
        { id: 1, order: 1 },
        { id: 2, order: 2 }
      ]

      mockFetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      const result = await documentApi.updateOrder(documentOrders)

      expect(mockFetch).toHaveBeenCalledWith('/api/documents/order', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ documentOrders })
      })
      expect(result).toBeNull()
    })

    test('throws error on invalid order data', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid order data' })
      })

      await expect(documentApi.updateOrder([])).rejects.toThrow('Invalid order data')
    })
  })

  describe('Error handling', () => {
    test('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(documentApi.getAll()).rejects.toThrow('Network error')
    })

    test('handles malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(documentApi.getAll()).rejects.toThrow('Unknown error')
    })

    test('throws DocumentApiError with correct status code', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      })

      try {
        await documentApi.getAll()
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error.name).toBe('DocumentApiError')
        expect(error.message).toBe('Unauthorized')
        expect(error.status).toBe(401)
      }
    })

    test('handles missing error message in response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({})
      })

      await expect(documentApi.getAll()).rejects.toThrow('Request failed')
    })
  })

  describe('Response status codes', () => {
    test('handles 200 OK', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: 'test' })
      })

      const result = await documentApi.getAll()
      expect(result).toEqual({ data: 'test' })
    })

    test('handles 201 Created', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 1 })
      })

      const result = await documentApi.create('Title', 'Content', 'Preview')
      expect(result).toEqual({ id: 1 })
    })

    test('handles 204 No Content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204
      })

      const result = await documentApi.delete(1)
      expect(result).toBeNull()
    })

    test('handles 400 Bad Request', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad Request' })
      })

      await expect(documentApi.getAll()).rejects.toThrow('Bad Request')
    })

    test('handles 401 Unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      })

      await expect(documentApi.getAll()).rejects.toThrow('Unauthorized')
    })

    test('handles 404 Not Found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' })
      })

      await expect(documentApi.getById(999)).rejects.toThrow('Not Found')
    })

    test('handles 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server Error' })
      })

      await expect(documentApi.getAll()).rejects.toThrow('Server Error')
    })
  })
})
