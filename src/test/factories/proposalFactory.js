import { vi } from 'vitest'

/**
 * Create mock change proposal
 */
export function createMockProposal(overrides = {}) {
  return {
    id: `proposal-${Date.now()}`,
    type: 'replace',
    location: { start: 0, end: 10 },
    originalText: 'original text',
    proposedText: 'improved text',
    rationale: 'This improves clarity',
    category: 'style',
    priority: 'minor',
    agentId: 'test-agent',
    status: 'pending',
    createdAt: new Date(),
    ...overrides
  }
}

/**
 * Create mock agent contract
 */
export function createMockAgent(overrides = {}) {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    stage: 'edit',
    allowedOperations: ['propose_change'],
    config: {},
    execute: vi.fn().mockResolvedValue({
      success: true,
      proposalsCount: 0,
      message: 'Test execution complete'
    }),
    ...overrides
  }
}
