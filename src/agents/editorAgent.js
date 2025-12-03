/**
 * Editor Agent
 *
 * Line-level editing for clarity, concision, and style.
 * Final polish after structure is solid.
 * Based on editor-agent from writing-infrastructure
 */

import { makeCompletion } from '../services/agents/aiService'
import {
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

export const EDITOR_AGENT_ID = 'editor-agent'

export const editorAgentContract = {
  id: EDITOR_AGENT_ID,
  name: 'Editor Agent',
  description: 'Line-level editing for clarity, concision, and style polish',
  stage: AGENT_STAGES.EDIT,
  allowedOperations: [
    OPERATION_TYPES.READ,
    OPERATION_TYPES.ANALYZE,
    OPERATION_TYPES.PROPOSE_CHANGE
  ],
  config: {
    model: 'gpt-4o',
    temperature: 0.3,
    maxTokens: 3000
  },
  execute: executeEditorAgent
}

/**
 * Execute editor agent
 */
async function executeEditorAgent(documentState, options = {}) {
  const {
    focus = 'all', // 'clarity', 'concision', 'style', 'all'
    section = ''
  } = options

  const content = documentState.getContent()
  const metadata = documentState.getMetadata()

  if (!content || content.trim() === '') {
    return {
      success: false,
      error: 'No content to edit'
    }
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(focus)

  // Build user prompt
  const userPrompt = buildUserPrompt({
    content,
    metadata,
    section,
    focus
  })

  try {
    // Call AI
    const response = await makeCompletion({
      systemPrompt,
      userPrompt,
      model: editorAgentContract.config.model,
      temperature: editorAgentContract.config.temperature,
      maxTokens: editorAgentContract.config.maxTokens,
      responseFormat: 'json'
    })

    // Parse response and create change proposals
    const proposals = parseEditorResponse(response, documentState)

    // Add proposals to document state
    for (const proposal of proposals) {
      documentState.addChangeProposal(proposal)
    }

    // Add annotation
    documentState.addAnnotation({
      agentId: EDITOR_AGENT_ID,
      category: 'edit',
      title: 'Line Editing Analysis',
      content: response.summary || 'Completed line editing',
      data: {
        improvements: response.improvements,
        patterns: response.patterns
      }
    })

    return {
      success: true,
      proposalsCreated: proposals.length,
      message: `Generated ${proposals.length} editing suggestions`,
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
function buildSystemPrompt(focus) {
  const basePrompt = `You are a line-level editing agent focused on clarity, concision, and style.

EDITING PRINCIPLES:

1. CLARITY: Make every sentence crystal clear
   - One idea per sentence
   - Clear pronoun references
   - Concrete subjects (avoid "it", "there")
   - Untangle complex constructions

2. CONCISION: Every word must earn its place
   - Cut filler phrases ("it is important to note that...")
   - Eliminate redundancy ("end result" → "result")
   - Prefer strong verbs ("decided" not "made a decision")
   - Delete unnecessary qualifiers

3. STYLE: Make it engaging and readable
   - Vary sentence length (short, medium, long)
   - Active voice (unless passive is intentional)
   - Specific words over vague ones
   - Strong action verbs

COMMON LINE-LEVEL FIXES:
- Passive → Active: "was fixed by" → "fixed"
- Weak verb → Strong: "is responsible for" → "handles"
- Filler → Direct: "It is important to note that X" → "X"
- Vague → Specific: "significantly" → "by 40%"
- Redundancy → Single: "end result" → "result"

Return your response as JSON:
{
  "summary": "Overall assessment of the prose",
  "improvements": {
    "clarity": ["improvement 1", "improvement 2"],
    "concision": ["improvement 1", "improvement 2"],
    "style": ["improvement 1", "improvement 2"]
  },
  "patterns": ["Common issue 1", "Common issue 2"],
  "edits": [
    {
      "location": { "start": 0, "end": 50 },
      "before": "original text",
      "after": "edited text",
      "reason": "why this is better",
      "type": "clarity|concision|style",
      "priority": "critical|important|minor"
    }
  ]
}`

  if (focus !== 'all') {
    return `${basePrompt}\n\nFOCUS: Prioritize ${focus} improvements above others.`
  }

  return basePrompt
}

/**
 * Build user prompt
 */
function buildUserPrompt({ content, metadata, section, focus }) {
  let userPrompt = `Edit this content at the sentence and word level to improve ${focus === 'all' ? 'clarity, concision, and style' : focus}.\n\n`

  if (metadata.title) {
    userPrompt += `Title: ${metadata.title}\n\n`
  }

  if (section) {
    userPrompt += `Focus on this section: ${section}\n\n`
  }

  userPrompt += `Content:\n\n${content}\n\n`
  userPrompt += `Provide specific line-level edits that improve the prose.`

  return userPrompt
}

/**
 * Parse editor response into change proposals
 */
function parseEditorResponse(response, documentState) {
  const proposals = []

  if (!response.edits || !Array.isArray(response.edits)) {
    console.error('Invalid editor response format:', response)
    return proposals
  }

  for (const edit of response.edits) {
    // Validate edit has required fields
    if (!edit.location || !edit.after) {
      console.warn('Skipping invalid edit:', edit)
      continue
    }

    // Map type to category
    let category = CHANGE_CATEGORIES.STYLE
    if (edit.type === 'clarity') {
      category = CHANGE_CATEGORIES.STYLE
    } else if (edit.type === 'concision') {
      category = CHANGE_CATEGORIES.STYLE
    }

    // Map priority
    let priority = CHANGE_PRIORITIES.MINOR
    if (edit.priority === 'critical') {
      priority = CHANGE_PRIORITIES.CRITICAL
    } else if (edit.priority === 'important') {
      priority = CHANGE_PRIORITIES.IMPORTANT
    }

    // Create proposal
    proposals.push({
      type: CHANGE_TYPES.REPLACE,
      location: edit.location,
      originalText: edit.before || '',
      proposedText: edit.after,
      rationale: edit.reason || 'Line-level editing improvement',
      category,
      priority,
      agentId: EDITOR_AGENT_ID,
      metadata: {
        editType: edit.type
      }
    })
  }

  return proposals
}
