/**
 * Argument Strengthener Agent
 *
 * Deep argument analysis using Claim-Evidence-Warrant framework.
 * Identifies logical gaps and suggests evidence needs.
 * Based on argument-strengthener from writing-infrastructure
 */

import { makeCompletion } from '../services/agents/aiService'
import {
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

export const ARGUMENT_STRENGTHENER_AGENT_ID = 'argument-strengthener-agent'

export const argumentStrengthenerAgentContract = {
  id: ARGUMENT_STRENGTHENER_AGENT_ID,
  name: 'Argument Strengthener',
  description: 'Analyzes argument logic using CEW framework, identifies gaps, suggests evidence',
  stage: AGENT_STAGES.REVISE,
  allowedOperations: [
    OPERATION_TYPES.READ,
    OPERATION_TYPES.ANALYZE,
    OPERATION_TYPES.PROPOSE_CHANGE
  ],
  config: {
    model: 'gpt-4o',
    temperature: 0.2, // Very low for logical analysis
    maxTokens: 4000
  },
  execute: executeArgumentStrengthenerAgent
}

/**
 * Execute argument strengthener agent
 */
async function executeArgumentStrengthenerAgent(documentState, options = {}) {
  const {
    section = ''
  } = options

  const content = documentState.getContent()
  const metadata = documentState.getMetadata()

  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'No content to analyze'
    }
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt()

  // Build user prompt
  const userPrompt = buildUserPrompt({
    content,
    metadata,
    section
  })

  try {
    // Call AI
    const response = await makeCompletion({
      systemPrompt,
      userPrompt,
      model: argumentStrengthenerAgentContract.config.model,
      temperature: argumentStrengthenerAgentContract.config.temperature,
      maxTokens: argumentStrengthenerAgentContract.config.maxTokens,
      responseFormat: 'json'
    })

    // Parse response and create change proposals
    const proposals = parseArgumentResponse(response, documentState)

    // Add proposals to document state
    for (const proposal of proposals) {
      documentState.addChangeProposal(proposal)
    }

    // Add annotation with argument analysis
    documentState.addAnnotation({
      agentId: ARGUMENT_STRENGTHENER_AGENT_ID,
      category: 'logic',
      title: 'Argument Analysis',
      content: response.summary || 'Completed argument analysis',
      data: {
        thesis: response.thesis,
        claims: response.claims,
        gaps: response.gaps,
        counterarguments: response.counterarguments
      }
    })

    return {
      success: true,
      proposalsCreated: proposals.length,
      message: `Identified ${proposals.length} argument improvements`,
      analysis: response
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Build system prompt
 */
function buildSystemPrompt() {
  return `You are an argument analysis agent using the Claim-Evidence-Warrant (CEW) framework.

CEW FRAMEWORK:
1. CLAIM: The assertion being made
2. EVIDENCE: Data, examples, or facts that support the claim
3. WARRANT: The logical connection explaining why evidence supports the claim

For each claim in the document, check:
- Is the claim clearly stated?
- Is evidence provided? (Empirical data > Expert testimony > Case studies > Analogies > Anecdotes)
- Is the warrant explicit? (Don't assume the reader sees the connection)
- Are there unstated assumptions?

LOGICAL GAPS TO IDENTIFY:
- Claims without evidence
- Evidence without warrants
- Weak or inappropriate evidence
- Logical fallacies (false cause, cherry-picking, strawman, slippery slope, hasty generalization)
- Leaps in reasoning
- Unstated assumptions

STEEL-MAN COUNTERARGUMENTS:
Generate the STRONGEST possible opposing argument to help the author:
- Expose vulnerabilities
- Anticipate objections
- Strengthen their position

Return your response as JSON:
{
  "summary": "Overall argument assessment",
  "thesis": "Main claim of the document",
  "claims": [
    {
      "claim": "The claim statement",
      "hasEvidence": true|false,
      "evidenceQuality": "strong|moderate|weak|missing",
      "hasWarrant": true|false,
      "gaps": ["gap 1", "gap 2"]
    }
  ],
  "gaps": [
    {
      "location": { "start": 0, "end": 50 },
      "type": "missing-evidence|weak-warrant|logical-fallacy|unstated-assumption",
      "description": "What's wrong",
      "impact": "How it weakens the argument",
      "fix": "How to address it",
      "priority": "critical|important|minor"
    }
  ],
  "counterarguments": {
    "claim": "Strongest opposing position",
    "evidence": ["What opponents would cite"],
    "vulnerabilities": ["Weakness 1", "Weakness 2"]
  },
  "evidenceNeeds": [
    {
      "claim": "Which claim needs support",
      "type": "empirical-data|expert-testimony|case-study|example",
      "description": "What kind of evidence to find"
    }
  ]
}`
}

/**
 * Build user prompt
 */
function buildUserPrompt({ content, metadata, section }) {
  let userPrompt = `Analyze the arguments in this document using the CEW framework.\n\n`

  if (metadata.title) {
    userPrompt += `Title: ${metadata.title}\n\n`
  }

  if (section) {
    userPrompt += `Focus on this section: ${section}\n\n`
  }

  userPrompt += `Content:\n\n${content}\n\n`
  userPrompt += `Identify the main thesis, analyze each claim's CEW completeness, identify logical gaps, and suggest improvements.`

  return userPrompt
}

/**
 * Parse argument response into change proposals
 */
function parseArgumentResponse(response, documentState) {
  const proposals = []

  if (!response.gaps || !Array.isArray(response.gaps)) {
    console.error('Invalid argument response format:', response)
    return proposals
  }

  for (const gap of response.gaps) {
    // Validate gap has required fields
    if (!gap.location || !gap.fix) {
      console.warn('Skipping invalid gap:', gap)
      continue
    }

    // Map priority
    let priority = CHANGE_PRIORITIES.IMPORTANT
    if (gap.priority === 'critical') {
      priority = CHANGE_PRIORITIES.CRITICAL
    } else if (gap.priority === 'minor') {
      priority = CHANGE_PRIORITIES.MINOR
    }

    // Create proposal as a comment (not a direct edit)
    // Argument gaps often require research, not just text changes
    proposals.push({
      type: CHANGE_TYPES.COMMENT,
      location: gap.location,
      originalText: '',
      proposedText: `[TK: ${gap.fix}]`,
      rationale: `${gap.description}\n\nImpact: ${gap.impact}\n\nType: ${gap.type}`,
      category: CHANGE_CATEGORIES.LOGIC,
      priority,
      agentId: ARGUMENT_STRENGTHENER_AGENT_ID,
      metadata: {
        gapType: gap.type,
        impact: gap.impact
      }
    })
  }

  // Add evidence needs as comments
  if (response.evidenceNeeds && Array.isArray(response.evidenceNeeds)) {
    for (const need of response.evidenceNeeds) {
      proposals.push({
        type: CHANGE_TYPES.COMMENT,
        location: { start: 0, end: 0 },
        originalText: '',
        proposedText: `[TK: ${need.description}]`,
        rationale: `Evidence needed for claim: "${need.claim}"\nType: ${need.type}`,
        category: CHANGE_CATEGORIES.LOGIC,
        priority: CHANGE_PRIORITIES.IMPORTANT,
        agentId: ARGUMENT_STRENGTHENER_AGENT_ID,
        metadata: {
          evidenceType: need.type,
          claim: need.claim
        }
      })
    }
  }

  return proposals
}
