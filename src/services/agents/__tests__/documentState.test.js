import { describe, test, expect, beforeEach } from 'vitest'
import {
  createDocumentState,
  updateContent,
  addChangeProposal,
  addAnnotation,
  getChangeProposals,
  getAnnotations,
  revertToVersion,
  exportState,
  importState,
  countWords,
  computeDiff
} from '../documentState'

describe('DocumentState - Core Functionality (Pure Functions)', () => {
  describe('createDocumentState', () => {
    test('initializes with content and metadata', () => {
      const state = createDocumentState('Hello world', {
        title: 'My Document',
        createdAt: new Date('2024-01-01')
      })

      expect(state.content).toBe('Hello world')
      expect(state.metadata.title).toBe('My Document')
      expect(state.metadata.createdAt).toEqual(new Date('2024-01-01'))
      expect(state.metadata.wordCount).toBe(2)
    })

    test('initializes with empty content', () => {
      const state = createDocumentState()

      expect(state.content).toBe('')
      expect(state.metadata.title).toBe('Untitled Document')
      expect(state.metadata.wordCount).toBe(0)
    })

    test('creates initial version in history', () => {
      const state = createDocumentState('Initial content')

      expect(state.versions).toHaveLength(1)
      expect(state.versions[0].content).toBe('Initial content')
      expect(state.versions[0].source).toBe('initial')
      expect(state.versions[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('state access', () => {
    let state

    beforeEach(() => {
      state = createDocumentState('Test content', {
        title: 'Test Doc',
        author: 'Test Author'
      })
    })

    test('content is accessible directly', () => {
      expect(state.content).toBe('Test content')
    })

    test('metadata is accessible directly', () => {
      expect(state.metadata.title).toBe('Test Doc')
      expect(state.metadata.author).toBe('Test Author')
      expect(state.metadata.wordCount).toBe(2)
    })
  })

  describe('updateContent', () => {
    let state

    beforeEach(() => {
      state = createDocumentState('Original content')
    })

    test('returns new state with updated content and version', () => {
      const newState = updateContent(state, 'New content')

      expect(newState.content).toBe('New content')
      expect(newState.versions).toHaveLength(2)
      expect(newState.versions[1].content).toBe('New content')
      expect(newState.versions[1].source).toBe('user')
    })

    test('does not mutate original state', () => {
      updateContent(state, 'New content')

      expect(state.content).toBe('Original content')
      expect(state.versions).toHaveLength(1)
    })

    test('updates word count in metadata', () => {
      const newState = updateContent(state, 'This has five words here')

      expect(newState.metadata.wordCount).toBe(5)
    })

    test('updates updatedAt timestamp', () => {
      const beforeUpdate = new Date()
      const newState = updateContent(state, 'Updated content')
      const afterUpdate = new Date()

      const updatedAt = newState.metadata.updatedAt
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())
    })

    test('allows custom source for version history', () => {
      const newState = updateContent(state, 'Agent content', 'agent:brainstorm')

      expect(newState.versions[1].source).toBe('agent:brainstorm')
    })

    test('handles rapid updates', () => {
      let current = state
      current = updateContent(current, 'Update 1')
      current = updateContent(current, 'Update 2')
      current = updateContent(current, 'Update 3')

      expect(current.content).toBe('Update 3')
      expect(current.versions).toHaveLength(4) // Initial + 3 updates
    })

    test('includes diff in version history', () => {
      const newState = updateContent(state, 'This is much longer content')

      expect(newState.versions[1].diff).toBeDefined()
      expect(newState.versions[1].diff.type).toBe('addition')
    })

    test('caps version history at 50 entries', () => {
      let current = state
      for (let i = 0; i < 55; i++) {
        current = updateContent(current, `Version ${i}`)
      }

      expect(current.versions.length).toBeLessThanOrEqual(50)
      // Initial version is preserved
      expect(current.versions[0].source).toBe('initial')
      // Latest version is present
      expect(current.content).toBe('Version 54')
    })
  })

  describe('countWords', () => {
    test('counts words accurately', () => {
      expect(countWords('Hello world')).toBe(2)
      expect(countWords('One two three four five')).toBe(5)
    })

    test('handles empty string', () => {
      expect(countWords('')).toBe(0)
    })

    test('handles whitespace', () => {
      expect(countWords('   ')).toBe(0)
      expect(countWords('  word  ')).toBe(1)
      expect(countWords('word1   word2')).toBe(2)
    })

    test('handles special characters', () => {
      expect(countWords('hello, world!')).toBe(2)
      expect(countWords('one-two three')).toBe(2)
    })

    test('handles newlines and tabs', () => {
      expect(countWords('line1\nline2')).toBe(2)
      expect(countWords('tab\there')).toBe(2)
    })
  })

  describe('exportState and importState', () => {
    let state

    beforeEach(() => {
      state = createDocumentState('Export test content', {
        title: 'Export Test',
        author: 'Tester'
      })
      state = updateContent(state, 'Updated content')
      const result = addChangeProposal(state, {
        type: 'replace',
        location: { start: 0, end: 7 },
        originalText: 'Updated',
        proposedText: 'Modified',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'test-agent'
      })
      state = result.newState
      const annotationResult = addAnnotation(state, {
        agentId: 'test-agent',
        category: 'analysis',
        text: 'Test annotation'
      })
      state = annotationResult.newState
    })

    test('export serializes state correctly', () => {
      const exported = exportState(state)

      expect(exported.content).toBe('Updated content')
      expect(exported.metadata.title).toBe('Export Test')
      expect(exported.metadata.author).toBe('Tester')
      expect(exported.versions).toHaveLength(2)
      expect(exported.changeProposals).toHaveLength(1)
      expect(exported.annotations).toHaveLength(1)
      expect(exported.appliedChanges).toEqual([])
    })

    test('import deserializes state correctly', () => {
      const exported = exportState(state)
      const imported = importState(exported)

      expect(imported.content).toBe('Updated content')
      expect(imported.metadata.title).toBe('Export Test')
      expect(imported.versions).toHaveLength(2)
      expect(imported.changeProposals).toHaveLength(1)
      expect(imported.annotations).toHaveLength(1)
    })

    test('import handles missing optional fields', () => {
      const minimalData = {
        content: 'Minimal content',
        metadata: { title: 'Minimal' }
      }

      const imported = importState(minimalData)

      expect(imported.content).toBe('Minimal content')
      expect(imported.versions).toEqual([])
      expect(imported.changeProposals).toEqual([])
      expect(imported.annotations).toEqual([])
    })

    test('export-import roundtrip preserves all data', () => {
      const exported = exportState(state)
      const imported = importState(exported)
      const reExported = exportState(imported)

      expect(reExported).toEqual(exported)
    })
  })

  describe('Version History', () => {
    let state

    beforeEach(() => {
      state = createDocumentState('Version 1')
    })

    test('versions track all updates', () => {
      let current = state
      current = updateContent(current, 'Version 2')
      current = updateContent(current, 'Version 3')

      expect(current.versions).toHaveLength(3)
      expect(current.versions[0].content).toBe('Version 1')
      expect(current.versions[1].content).toBe('Version 2')
      expect(current.versions[2].content).toBe('Version 3')
    })

    test('revertToVersion restores previous content', () => {
      let current = state
      current = updateContent(current, 'Version 2')
      current = updateContent(current, 'Version 3')

      current = revertToVersion(current, 0)

      expect(current.content).toBe('Version 1')
      expect(current.versions).toHaveLength(4) // Original 3 + revert creates new version
      expect(current.versions[3].source).toBe('revert')
    })

    test('revertToVersion throws on invalid index', () => {
      expect(() => {
        revertToVersion(state, -1)
      }).toThrow('Invalid version index')

      expect(() => {
        revertToVersion(state, 10)
      }).toThrow('Invalid version index')
    })
  })

  describe('Annotations', () => {
    let state

    beforeEach(() => {
      state = createDocumentState('Test content')
    })

    test('addAnnotation creates annotation with ID', () => {
      const { newState, annotationId } = addAnnotation(state, {
        agentId: 'test-agent',
        category: 'analysis',
        text: 'This is a test annotation',
        location: { start: 0, end: 4 }
      })

      expect(annotationId).toBeTruthy()
      expect(annotationId).toMatch(/^annotation-/)

      const annotations = getAnnotations(newState)
      expect(annotations).toHaveLength(1)
      expect(annotations[0].id).toBe(annotationId)
      expect(annotations[0].text).toBe('This is a test annotation')
      expect(annotations[0].createdAt).toBeInstanceOf(Date)
    })

    test('does not mutate original state', () => {
      addAnnotation(state, {
        agentId: 'test-agent',
        category: 'analysis',
        text: 'Annotation'
      })

      expect(getAnnotations(state)).toHaveLength(0)
    })

    test('getAnnotations filters by agentId', () => {
      let current = state
      current = addAnnotation(current, { agentId: 'agent-1', category: 'analysis', text: 'A1' }).newState
      current = addAnnotation(current, { agentId: 'agent-2', category: 'analysis', text: 'A2' }).newState
      current = addAnnotation(current, { agentId: 'agent-1', category: 'comment', text: 'A3' }).newState

      const agent1Annotations = getAnnotations(current, { agentId: 'agent-1' })
      expect(agent1Annotations).toHaveLength(2)
      expect(agent1Annotations.every(a => a.agentId === 'agent-1')).toBe(true)
    })

    test('getAnnotations filters by category', () => {
      let current = state
      current = addAnnotation(current, { agentId: 'agent-1', category: 'analysis', text: 'A1' }).newState
      current = addAnnotation(current, { agentId: 'agent-2', category: 'comment', text: 'A2' }).newState
      current = addAnnotation(current, { agentId: 'agent-1', category: 'analysis', text: 'A3' }).newState

      const analysisAnnotations = getAnnotations(current, { category: 'analysis' })
      expect(analysisAnnotations).toHaveLength(2)
      expect(analysisAnnotations.every(a => a.category === 'analysis')).toBe(true)
    })

    test('getAnnotations returns all without filter', () => {
      let current = state
      current = addAnnotation(current, { agentId: 'agent-1', category: 'analysis', text: 'A1' }).newState
      current = addAnnotation(current, { agentId: 'agent-2', category: 'comment', text: 'A2' }).newState

      const allAnnotations = getAnnotations(current)
      expect(allAnnotations).toHaveLength(2)
    })
  })
})
