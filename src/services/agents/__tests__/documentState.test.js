import { describe, test, expect, beforeEach } from 'vitest'
import { DocumentState } from '../documentState'

describe('DocumentState - Core Functionality', () => {
  describe('Constructor', () => {
    test('initializes with content and metadata', () => {
      const content = 'Hello world'
      const metadata = {
        title: 'My Document',
        createdAt: new Date('2024-01-01')
      }

      const docState = new DocumentState(content, metadata)

      expect(docState.getContent()).toBe('Hello world')
      expect(docState.getMetadata().title).toBe('My Document')
      expect(docState.getMetadata().createdAt).toEqual(new Date('2024-01-01'))
      expect(docState.getMetadata().wordCount).toBe(2)
    })

    test('initializes with empty content', () => {
      const docState = new DocumentState()

      expect(docState.getContent()).toBe('')
      expect(docState.getMetadata().title).toBe('Untitled Document')
      expect(docState.getMetadata().wordCount).toBe(0)
    })

    test('creates initial version in history', () => {
      const docState = new DocumentState('Initial content')

      const versions = docState.getVersionHistory()
      expect(versions).toHaveLength(1)
      expect(versions[0].content).toBe('Initial content')
      expect(versions[0].source).toBe('initial')
      expect(versions[0].timestamp).toBeInstanceOf(Date)
    })
  })

  describe('getContent and getMetadata', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('Test content', {
        title: 'Test Doc',
        author: 'Test Author'
      })
    })

    test('getContent returns current content', () => {
      expect(docState.getContent()).toBe('Test content')
    })

    test('getMetadata returns copy of metadata', () => {
      const metadata = docState.getMetadata()

      expect(metadata.title).toBe('Test Doc')
      expect(metadata.author).toBe('Test Author')
      expect(metadata.wordCount).toBe(2)

      // Ensure it's a copy, not reference
      metadata.title = 'Modified'
      expect(docState.getMetadata().title).toBe('Test Doc')
    })
  })

  describe('updateContent', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('Original content')
    })

    test('updates content and creates version history entry', () => {
      const versionId = docState.updateContent('New content')

      expect(docState.getContent()).toBe('New content')
      expect(versionId).toBe(1) // Second version (0-indexed)

      const versions = docState.getVersionHistory()
      expect(versions).toHaveLength(2)
      expect(versions[1].content).toBe('New content')
      expect(versions[1].source).toBe('user')
    })

    test('updates word count in metadata', () => {
      docState.updateContent('This has five words here')

      expect(docState.getMetadata().wordCount).toBe(5)
    })

    test('updates updatedAt timestamp', () => {
      const beforeUpdate = new Date()
      docState.updateContent('Updated content')
      const afterUpdate = new Date()

      const updatedAt = docState.getMetadata().updatedAt
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime())
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime())
    })

    test('allows custom source for version history', () => {
      docState.updateContent('Agent content', 'agent:brainstorm')

      const versions = docState.getVersionHistory()
      expect(versions[1].source).toBe('agent:brainstorm')
    })

    test('handles rapid updates', () => {
      docState.updateContent('Update 1')
      docState.updateContent('Update 2')
      docState.updateContent('Update 3')

      expect(docState.getContent()).toBe('Update 3')
      const versions = docState.getVersionHistory()
      expect(versions).toHaveLength(4) // Initial + 3 updates
    })

    test('includes diff in version history', () => {
      docState.updateContent('This is much longer content')

      const versions = docState.getVersionHistory()
      expect(versions[1].diff).toBeDefined()
      expect(versions[1].diff.type).toBe('addition')
    })
  })

  describe('countWords', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('')
    })

    test('counts words accurately', () => {
      expect(docState.countWords('Hello world')).toBe(2)
      expect(docState.countWords('One two three four five')).toBe(5)
    })

    test('handles empty string', () => {
      expect(docState.countWords('')).toBe(0)
    })

    test('handles whitespace', () => {
      expect(docState.countWords('   ')).toBe(0)
      expect(docState.countWords('  word  ')).toBe(1)
      expect(docState.countWords('word1   word2')).toBe(2)
    })

    test('handles special characters', () => {
      expect(docState.countWords('hello, world!')).toBe(2)
      expect(docState.countWords('one-two three')).toBe(2)
    })

    test('handles newlines and tabs', () => {
      expect(docState.countWords('line1\nline2')).toBe(2)
      expect(docState.countWords('tab\there')).toBe(2)
    })
  })

  describe('export and import', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('Export test content', {
        title: 'Export Test',
        author: 'Tester'
      })
      docState.updateContent('Updated content')
      docState.addChangeProposal({
        type: 'replace',
        location: { start: 0, end: 7 },
        originalText: 'Updated',
        proposedText: 'Modified',
        rationale: 'Test',
        category: 'style',
        priority: 'minor',
        agentId: 'test-agent'
      })
      docState.addAnnotation({
        agentId: 'test-agent',
        category: 'analysis',
        text: 'Test annotation'
      })
    })

    test('export serializes state correctly', () => {
      const exported = docState.export()

      expect(exported.content).toBe('Updated content')
      expect(exported.metadata.title).toBe('Export Test')
      expect(exported.metadata.author).toBe('Tester')
      expect(exported.versions).toHaveLength(2)
      expect(exported.changeProposals).toHaveLength(1)
      expect(exported.annotations).toHaveLength(1)
      expect(exported.appliedChanges).toEqual([])
    })

    test('import deserializes state correctly', () => {
      const exported = docState.export()
      const imported = DocumentState.import(exported)

      expect(imported.getContent()).toBe('Updated content')
      expect(imported.getMetadata().title).toBe('Export Test')
      expect(imported.getVersionHistory()).toHaveLength(2)
      expect(imported.getChangeProposals()).toHaveLength(1)
      expect(imported.getAnnotations()).toHaveLength(1)
    })

    test('import handles missing optional fields', () => {
      const minimalData = {
        content: 'Minimal content',
        metadata: { title: 'Minimal' }
      }

      const imported = DocumentState.import(minimalData)

      expect(imported.getContent()).toBe('Minimal content')
      expect(imported.getVersionHistory()).toEqual([])
      expect(imported.getChangeProposals()).toEqual([])
      expect(imported.getAnnotations()).toEqual([])
    })

    test('export-import roundtrip preserves all data', () => {
      const exported = docState.export()
      const imported = DocumentState.import(exported)
      const reExported = imported.export()

      expect(reExported).toEqual(exported)
    })
  })

  describe('Version History', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('Version 1')
    })

    test('getVersionHistory returns all versions', () => {
      docState.updateContent('Version 2')
      docState.updateContent('Version 3')

      const versions = docState.getVersionHistory()
      expect(versions).toHaveLength(3)
      expect(versions[0].content).toBe('Version 1')
      expect(versions[1].content).toBe('Version 2')
      expect(versions[2].content).toBe('Version 3')
    })

    test('getVersionHistory returns copy of versions array', () => {
      const versions1 = docState.getVersionHistory()
      const versions2 = docState.getVersionHistory()

      expect(versions1).toEqual(versions2)
      expect(versions1).not.toBe(versions2) // Different array instances
    })

    test('revertToVersion restores previous content', () => {
      docState.updateContent('Version 2')
      docState.updateContent('Version 3')

      docState.revertToVersion(0)

      expect(docState.getContent()).toBe('Version 1')
      const versions = docState.getVersionHistory()
      expect(versions).toHaveLength(4) // Original 3 + revert creates new version
      expect(versions[3].source).toBe('revert')
    })

    test('revertToVersion throws on invalid index', () => {
      expect(() => {
        docState.revertToVersion(-1)
      }).toThrow('Invalid version index')

      expect(() => {
        docState.revertToVersion(10)
      }).toThrow('Invalid version index')
    })
  })

  describe('Annotations', () => {
    let docState

    beforeEach(() => {
      docState = new DocumentState('Test content')
    })

    test('addAnnotation creates annotation with ID', () => {
      const annotationId = docState.addAnnotation({
        agentId: 'test-agent',
        category: 'analysis',
        text: 'This is a test annotation',
        location: { start: 0, end: 4 }
      })

      expect(annotationId).toBeTruthy()
      expect(annotationId).toMatch(/^annotation-/)

      const annotations = docState.getAnnotations()
      expect(annotations).toHaveLength(1)
      expect(annotations[0].id).toBe(annotationId)
      expect(annotations[0].text).toBe('This is a test annotation')
      expect(annotations[0].createdAt).toBeInstanceOf(Date)
    })

    test('getAnnotations filters by agentId', () => {
      docState.addAnnotation({ agentId: 'agent-1', category: 'analysis', text: 'A1' })
      docState.addAnnotation({ agentId: 'agent-2', category: 'analysis', text: 'A2' })
      docState.addAnnotation({ agentId: 'agent-1', category: 'comment', text: 'A3' })

      const agent1Annotations = docState.getAnnotations({ agentId: 'agent-1' })
      expect(agent1Annotations).toHaveLength(2)
      expect(agent1Annotations.every(a => a.agentId === 'agent-1')).toBe(true)
    })

    test('getAnnotations filters by category', () => {
      docState.addAnnotation({ agentId: 'agent-1', category: 'analysis', text: 'A1' })
      docState.addAnnotation({ agentId: 'agent-2', category: 'comment', text: 'A2' })
      docState.addAnnotation({ agentId: 'agent-1', category: 'analysis', text: 'A3' })

      const analysisAnnotations = docState.getAnnotations({ category: 'analysis' })
      expect(analysisAnnotations).toHaveLength(2)
      expect(analysisAnnotations.every(a => a.category === 'analysis')).toBe(true)
    })

    test('getAnnotations returns all without filter', () => {
      docState.addAnnotation({ agentId: 'agent-1', category: 'analysis', text: 'A1' })
      docState.addAnnotation({ agentId: 'agent-2', category: 'comment', text: 'A2' })

      const allAnnotations = docState.getAnnotations()
      expect(allAnnotations).toHaveLength(2)
    })
  })
})
