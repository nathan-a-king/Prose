import { vi } from 'vitest'

/**
 * Mock documentApi
 */
export const mockDocumentApi = {
  getAll: vi.fn().mockResolvedValue([]),
  getById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue({ id: 1, title: 'New Doc', content: '' }),
  update: vi.fn().mockResolvedValue({ id: 1, title: 'Updated Doc', content: '' }),
  delete: vi.fn().mockResolvedValue(null),
  updateOrder: vi.fn().mockResolvedValue(null)
}

/**
 * Mock fileSystemApi
 */
export const mockFileSystemApi = {
  isAvailable: vi.fn().mockReturnValue(false),
  openFile: vi.fn().mockResolvedValue(null),
  saveFile: vi.fn().mockResolvedValue(true),
  saveFileAs: vi.fn().mockResolvedValue(null),
  getFileInfo: vi.fn().mockResolvedValue(null),
  fileExists: vi.fn().mockResolvedValue(false),
  getFileName: vi.fn((path) => path?.split('/').pop() || null),
  getDirectory: vi.fn((path) => {
    if (!path) return null
    const parts = path.split('/')
    parts.pop()
    return parts.join('/')
  })
}

/**
 * Mock aiService
 */
export const mockAiService = {
  makeCompletion: vi.fn().mockResolvedValue('AI response'),
  makeStreamingCompletion: vi.fn().mockResolvedValue(() => {}), // Returns abort function
  estimateTokens: vi.fn((text) => Math.ceil(text.length / 4)),
  isApiKeyConfigured: vi.fn().mockResolvedValue(true)
}
