import { DocumentState } from '@/services/agents/documentState'

/**
 * Create mock document for testing
 */
export function createMockDocument(overrides = {}) {
  return {
    id: 1,
    title: 'Test Document',
    content: 'This is test content.',
    preview: 'This is test...',
    title_manually_set: false,
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-02').toISOString(),
    order: 0,
    ...overrides
  }
}

/**
 * Create mock DocumentState instance
 */
export function createMockDocumentState(content = '', metadata = {}) {
  return new DocumentState(content, {
    title: 'Test Document',
    createdAt: new Date('2024-01-01'),
    ...metadata
  })
}
