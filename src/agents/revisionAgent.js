/**
 * Revision Agent
 *
 * Systematic prose revision using 3-column method.
 * Works top-down: Structure → Style → Mechanics
 * Based on the revision-agent from writing-infrastructure
 */

import { makeCompletion } from '../services/agents/aiService'
import {
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

export const REVISION_AGENT_ID = 'revision-agent'

export const revisionAgentContract = {
  id: REVISION_AGENT_ID,
  name: 'Revision Agent',
  description: 'Systematic prose revision: structure, style, and mechanics improvements',
  stage: AGENT_STAGES.REVISE,
  allowedOperations: [
    OPERATION_TYPES.READ,
    OPERATION_TYPES.ANALYZE,
    OPERATION_TYPES.PROPOSE_CHANGE
  ],
  config: {
    model: 'gpt-4o',
    temperature: 0.3, // Lower temperature for analytical work
    maxTokens: 8000
  },
  execute: executeRevisionAgent
}

/**
 * Execute revision agent
 */
async function executeRevisionAgent(documentState, options = {}) {
  const {
    depth = 'full', // 'light', 'medium', 'full'
    focus = 'all', // 'structure', 'style', 'mechanics', 'all'
    section = '', // Specific section to focus on
    promptions = null
  } = options

  const content = documentState.getContent()
  const metadata = documentState.getMetadata()

  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'No content to revise'
    }
  }

  // Build system prompt
  let systemPrompt = buildSystemPrompt(depth, focus)

  // Append promptions if available - CRITICAL: These override default behavior
  if (promptions && !promptions.isEmpty()) {
    const formatted = promptions.prettyPrintAsConversation()
    systemPrompt += `\n\n## CRITICAL: User-Configured Preferences
The user has explicitly configured the following preferences for this agent run.
You MUST strictly adhere to these settings. They override any default instructions above.

${formatted.question}

## User's Selected Configuration:
${formatted.answer}

IMPORTANT: Only perform the specific actions and corrections specified in the user's configuration above. Do not expand beyond these explicit instructions.`
  }

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
      model: revisionAgentContract.config.model,
      temperature: revisionAgentContract.config.temperature,
      maxTokens: revisionAgentContract.config.maxTokens,
      responseFormat: 'json'
    })

    // Parse response and create change proposals
    const proposals = parseRevisionResponse(response, documentState, content)

    // Add proposals to document state
    for (const proposal of proposals) {
      documentState.addChangeProposal(proposal)
    }

    // Add annotation with revision analysis
    documentState.addAnnotation({
      agentId: REVISION_AGENT_ID,
      category: 'revision',
      title: 'Revision Analysis',
      content: response.summary || 'Completed revision analysis',
      data: {
        assessments: response.assessments,
        priorities: response.priorities
      }
    })

    return {
      success: true,
      proposalsCreated: proposals.length,
      message: `Generated ${proposals.length} revision suggestions`,
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
function buildSystemPrompt(depth, focus) {
  const basePrompt = `You are a systematic revision agent for writers. You apply the 3-column method to improve prose quality.

REVISION LEVELS (work top-down):
1. STRUCTURE (Macro): Organization, flow, focus, completeness
2. STYLE (Meso): Voice, verbs, clarity, rhythm, sentence variety
3. MECHANICS (Micro): Word choice, grammar, punctuation

3-COLUMN METHOD:
For each issue, provide:
- Problem: Quote the original text
- Diagnosis: Why it fails (weak verb, passive voice, vague language, etc.)
- Fix: Corrected version + principle

COMMON PROSE PROBLEMS:
- Weak verbs (is, have, make, get, do)
- Passive voice (unless intentional)
- Vague language (use specifics and numbers)
- Filler phrases ("it is important to note that...")
- Redundancy ("end result", "past history")
- Unclear pronouns ("this", "that", "it" without clear referent)
- Monotonous sentence length

Return your response as JSON:
{
  "summary": "Brief overall assessment",
  "assessments": {
    "structure": {
      "score": "strong|good|needs-work",
      "issues": ["issue 1", "issue 2"]
    },
    "style": {
      "score": "strong|good|needs-work",
      "issues": ["issue 1", "issue 2"]
    },
    "mechanics": {
      "score": "strong|good|needs-work",
      "issues": ["issue 1", "issue 2"]
    }
  },
  "priorities": ["Top priority fix", "Second priority", "Third priority"],
  "revisions": [
    {
      "location": { "start": 0, "end": 50 },
      "problem": "original text",
      "diagnosis": "why it fails",
      "fix": "corrected text",
      "principle": "rule to remember",
      "category": "structure|style|mechanics",
      "priority": "critical|important|minor"
    }
  ]
}`

  // Adjust based on depth
  if (depth === 'light') {
    return `${basePrompt}\n\nDEPTH: Light pass - focus only on critical issues.`
  } else if (depth === 'medium') {
    return `${basePrompt}\n\nDEPTH: Medium pass - focus on important improvements.`
  } else {
    return `${basePrompt}\n\nDEPTH: Full systematic revision - thorough analysis at all levels.`
  }
}

/**
 * Build user prompt
 */
function buildUserPrompt({ content, metadata, section }) {
  let userPrompt = `Revise this document using the 3-column method.\n\n`

  if (metadata.title) {
    userPrompt += `Title: ${metadata.title}\n\n`
  }

  if (section) {
    userPrompt += `Focus specifically on this section: ${section}\n\n`
  }

  userPrompt += `Content:\n\n${content}\n\n`
  userPrompt += `Provide systematic revision analysis with specific, actionable improvements.`

  return userPrompt
}

/**
 * Parse revision response into change proposals
 */
function parseRevisionResponse(response, documentState, content) {
  const proposals = []

  if (!response.revisions || !Array.isArray(response.revisions)) {
    console.error('Invalid revision response format:', response)
    return proposals
  }

  for (const revision of response.revisions) {
    // Validate revision has required fields
    if (!revision.location || !revision.fix) {
      console.warn('Skipping invalid revision:', revision)
      continue
    }

    // Map category
    let category = CHANGE_CATEGORIES.STYLE
    if (revision.category === 'structure') {
      category = CHANGE_CATEGORIES.STRUCTURE
    } else if (revision.category === 'mechanics') {
      category = CHANGE_CATEGORIES.MECHANICS
    }

    // Map priority
    let priority = CHANGE_PRIORITIES.IMPORTANT
    if (revision.priority === 'critical') {
      priority = CHANGE_PRIORITIES.CRITICAL
    } else if (revision.priority === 'minor') {
      priority = CHANGE_PRIORITIES.MINOR
    }

    // Create proposal
    proposals.push({
      type: CHANGE_TYPES.REPLACE,
      location: revision.location,
      originalText: revision.problem || '',
      proposedText: revision.fix,
      rationale: `${revision.diagnosis}\n\nPrinciple: ${revision.principle || 'Apply revision principles'}`,
      category,
      priority,
      agentId: REVISION_AGENT_ID,
      metadata: {
        diagnosis: revision.diagnosis,
        principle: revision.principle
      }
    })
  }

  return proposals
}
