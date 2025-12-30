import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  registerAgent,
  getAgent,
  getAllAgents,
  getAgentsByStage,
  unregisterAgent,
  clearAgents,
  AGENT_STAGES
} from '../agentRegistry'

describe('Agent Registry', () => {
  // Clear registry before and after each test
  beforeEach(() => {
    clearAgents()
  })

  afterEach(() => {
    clearAgents()
  })

  describe('registerAgent', () => {
    test('registers agent with all required fields', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        stage: AGENT_STAGES.EDIT,
        allowedOperations: ['propose_change'],
        config: {},
        execute: vi.fn()
      }

      registerAgent(agent)

      const retrieved = getAgent('test-agent')
      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe('test-agent')
      expect(retrieved.name).toBe('Test Agent')
      expect(retrieved.description).toBe('A test agent')
      expect(retrieved.stage).toBe(AGENT_STAGES.EDIT)
      expect(retrieved.registeredAt).toBeInstanceOf(Date)
    })

    test('throws error when agent missing id', () => {
      const invalidAgent = {
        name: 'Test Agent',
        execute: vi.fn()
      }

      expect(() => {
        registerAgent(invalidAgent)
      }).toThrow('Agent must have id, name, and execute function')
    })

    test('throws error when agent missing name', () => {
      const invalidAgent = {
        id: 'test-agent',
        execute: vi.fn()
      }

      expect(() => {
        registerAgent(invalidAgent)
      }).toThrow('Agent must have id, name, and execute function')
    })

    test('throws error when agent missing execute function', () => {
      const invalidAgent = {
        id: 'test-agent',
        name: 'Test Agent'
      }

      expect(() => {
        registerAgent(invalidAgent)
      }).toThrow('Agent must have id, name, and execute function')
    })

    test('overwrites existing agent with same id', () => {
      const agent1 = {
        id: 'test-agent',
        name: 'First Agent',
        execute: vi.fn()
      }

      const agent2 = {
        id: 'test-agent',
        name: 'Second Agent',
        execute: vi.fn()
      }

      registerAgent(agent1)
      registerAgent(agent2)

      const retrieved = getAgent('test-agent')
      expect(retrieved.name).toBe('Second Agent')

      const allAgents = getAllAgents()
      expect(allAgents).toHaveLength(1)
    })

    test('adds registeredAt timestamp', () => {
      const beforeRegistration = new Date()

      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn()
      }

      registerAgent(agent)

      const afterRegistration = new Date()
      const retrieved = getAgent('test-agent')

      expect(retrieved.registeredAt).toBeInstanceOf(Date)
      expect(retrieved.registeredAt.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime())
      expect(retrieved.registeredAt.getTime()).toBeLessThanOrEqual(afterRegistration.getTime())
    })
  })

  describe('getAgent', () => {
    test('retrieves agent by id', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn()
      }

      registerAgent(agent)

      const retrieved = getAgent('test-agent')
      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe('test-agent')
      expect(retrieved.name).toBe('Test Agent')
    })

    test('returns undefined for non-existent agent', () => {
      const retrieved = getAgent('non-existent')
      expect(retrieved).toBeUndefined()
    })

    test('returns undefined after agent is unregistered', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn()
      }

      registerAgent(agent)
      unregisterAgent('test-agent')

      const retrieved = getAgent('test-agent')
      expect(retrieved).toBeUndefined()
    })
  })

  describe('getAllAgents', () => {
    test('returns empty array when no agents registered', () => {
      const agents = getAllAgents()
      expect(agents).toEqual([])
    })

    test('returns all registered agents', () => {
      const agent1 = {
        id: 'agent-1',
        name: 'Agent 1',
        execute: vi.fn()
      }

      const agent2 = {
        id: 'agent-2',
        name: 'Agent 2',
        execute: vi.fn()
      }

      const agent3 = {
        id: 'agent-3',
        name: 'Agent 3',
        execute: vi.fn()
      }

      registerAgent(agent1)
      registerAgent(agent2)
      registerAgent(agent3)

      const agents = getAllAgents()
      expect(agents).toHaveLength(3)

      const agentIds = agents.map(a => a.id)
      expect(agentIds).toContain('agent-1')
      expect(agentIds).toContain('agent-2')
      expect(agentIds).toContain('agent-3')
    })

    test('returns array not affected by mutations', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn()
      }

      registerAgent(agent)

      const agents1 = getAllAgents()
      const agents2 = getAllAgents()

      expect(agents1).toEqual(agents2)
      expect(agents1).not.toBe(agents2) // Different array instances
    })
  })

  describe('getAgentsByStage', () => {
    beforeEach(() => {
      registerAgent({
        id: 'brainstorm-1',
        name: 'Brainstorm Agent 1',
        stage: AGENT_STAGES.BRAINSTORM,
        execute: vi.fn()
      })

      registerAgent({
        id: 'brainstorm-2',
        name: 'Brainstorm Agent 2',
        stage: AGENT_STAGES.BRAINSTORM,
        execute: vi.fn()
      })

      registerAgent({
        id: 'edit-1',
        name: 'Edit Agent 1',
        stage: AGENT_STAGES.EDIT,
        execute: vi.fn()
      })

      registerAgent({
        id: 'review-1',
        name: 'Review Agent 1',
        stage: AGENT_STAGES.REVIEW,
        execute: vi.fn()
      })
    })

    test('filters agents by stage', () => {
      const brainstormAgents = getAgentsByStage(AGENT_STAGES.BRAINSTORM)
      expect(brainstormAgents).toHaveLength(2)
      expect(brainstormAgents.every(a => a.stage === AGENT_STAGES.BRAINSTORM)).toBe(true)

      const editAgents = getAgentsByStage(AGENT_STAGES.EDIT)
      expect(editAgents).toHaveLength(1)
      expect(editAgents[0].id).toBe('edit-1')

      const reviewAgents = getAgentsByStage(AGENT_STAGES.REVIEW)
      expect(reviewAgents).toHaveLength(1)
      expect(reviewAgents[0].id).toBe('review-1')
    })

    test('returns empty array for stage with no agents', () => {
      const draftAgents = getAgentsByStage(AGENT_STAGES.DRAFT)
      expect(draftAgents).toEqual([])
    })

    test('returns empty array for non-existent stage', () => {
      const invalidAgents = getAgentsByStage('non-existent-stage')
      expect(invalidAgents).toEqual([])
    })
  })

  describe('unregisterAgent', () => {
    test('removes agent from registry', () => {
      const agent = {
        id: 'test-agent',
        name: 'Test Agent',
        execute: vi.fn()
      }

      registerAgent(agent)
      expect(getAgent('test-agent')).toBeDefined()

      unregisterAgent('test-agent')
      expect(getAgent('test-agent')).toBeUndefined()
    })

    test('does not throw when unregistering non-existent agent', () => {
      expect(() => {
        unregisterAgent('non-existent')
      }).not.toThrow()
    })

    test('does not affect other agents', () => {
      const agent1 = {
        id: 'agent-1',
        name: 'Agent 1',
        execute: vi.fn()
      }

      const agent2 = {
        id: 'agent-2',
        name: 'Agent 2',
        execute: vi.fn()
      }

      registerAgent(agent1)
      registerAgent(agent2)

      unregisterAgent('agent-1')

      expect(getAgent('agent-1')).toBeUndefined()
      expect(getAgent('agent-2')).toBeDefined()

      const allAgents = getAllAgents()
      expect(allAgents).toHaveLength(1)
      expect(allAgents[0].id).toBe('agent-2')
    })
  })

  describe('clearAgents', () => {
    test('removes all agents from registry', () => {
      registerAgent({
        id: 'agent-1',
        name: 'Agent 1',
        execute: vi.fn()
      })

      registerAgent({
        id: 'agent-2',
        name: 'Agent 2',
        execute: vi.fn()
      })

      registerAgent({
        id: 'agent-3',
        name: 'Agent 3',
        execute: vi.fn()
      })

      expect(getAllAgents()).toHaveLength(3)

      clearAgents()

      expect(getAllAgents()).toHaveLength(0)
      expect(getAgent('agent-1')).toBeUndefined()
      expect(getAgent('agent-2')).toBeUndefined()
      expect(getAgent('agent-3')).toBeUndefined()
    })

    test('can register agents after clearing', () => {
      registerAgent({
        id: 'agent-1',
        name: 'Agent 1',
        execute: vi.fn()
      })

      clearAgents()

      registerAgent({
        id: 'agent-2',
        name: 'Agent 2',
        execute: vi.fn()
      })

      const agents = getAllAgents()
      expect(agents).toHaveLength(1)
      expect(agents[0].id).toBe('agent-2')
    })

    test('does not throw when clearing empty registry', () => {
      expect(() => {
        clearAgents()
      }).not.toThrow()
    })
  })

  describe('Agent Stages Constants', () => {
    test('AGENT_STAGES contains all expected stages', () => {
      expect(AGENT_STAGES.BRAINSTORM).toBe('brainstorm')
      expect(AGENT_STAGES.DRAFT).toBe('draft')
      expect(AGENT_STAGES.REVISE).toBe('revise')
      expect(AGENT_STAGES.EDIT).toBe('edit')
      expect(AGENT_STAGES.REVIEW).toBe('review')
    })
  })
})
