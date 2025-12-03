/**
 * Draft Agent
 *
 * Rapid content generation with TK placeholders for gaps.
 * Focuses on getting words on page, not perfection.
 */

import { makeStreamingCompletion } from '../services/agents/aiService'
import {
  AGENT_STAGES,
  OPERATION_TYPES,
  CHANGE_TYPES,
  CHANGE_CATEGORIES,
  CHANGE_PRIORITIES
} from '../services/agents/agentRegistry'

export const DRAFT_AGENT_ID = 'draft-agent'

export const draftAgentContract = {
  id: DRAFT_AGENT_ID,
  name: 'Draft Agent',
  description: 'Rapidly generates draft content with TK placeholders for research gaps',
  stage: AGENT_STAGES.DRAFT,
  allowedOperations: [
    OPERATION_TYPES.READ,
    OPERATION_TYPES.GENERATE_CONTENT,
    OPERATION_TYPES.PROPOSE_CHANGE
  ],
  config: {
    model: 'gpt-4o',
    temperature: 0.8,
    maxTokens: 3000
  },
  execute: executeDraftAgent
}

/**
 * Execute draft agent
 */
async function executeDraftAgent(documentState, options = {}) {
  const {
    prompt = '',
    outline = '',
    section = '',
    targetWords = 500,
    onProgress = null
  } = options

  const content = documentState.getContent()
  const metadata = documentState.getMetadata()

  // Build system prompt
  const systemPrompt = buildSystemPrompt()

  // Build user prompt
  const userPrompt = buildUserPrompt({
    content,
    metadata,
    prompt,
    outline,
    section,
    targetWords
  })

  try {
    let draftContent = ''

    if (onProgress) {
      // Streaming mode
      await makeStreamingCompletion(
        {
          systemPrompt,
          userPrompt,
          model: draftAgentContract.config.model,
          temperature: draftAgentContract.config.temperature,
          maxTokens: draftAgentContract.config.maxTokens
        },
        (chunk) => {
          draftContent += chunk
          onProgress(draftContent)
        }
      )
    } else {
      // Non-streaming mode
      const { makeCompletion } = await import('../services/agents/aiService')
      draftContent = await makeCompletion({
        systemPrompt,
        userPrompt,
        model: draftAgentContract.config.model,
        temperature: draftAgentContract.config.temperature,
        maxTokens: draftAgentContract.config.maxTokens
      })
    }

    // Create change proposal
    const proposal = createDraftProposal(draftContent, documentState, section)
    documentState.addChangeProposal(proposal)

    // Add annotation
    documentState.addAnnotation({
      agentId: DRAFT_AGENT_ID,
      category: 'draft',
      title: 'Draft Generated',
      content: `Generated ${countWords(draftContent)} words of draft content`
    })

    return {
      success: true,
      proposalsCreated: 1,
      message: `Generated draft with ${countWords(draftContent)} words`,
      draftContent
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
  return `You are a draft generation agent for writers. Your role is to rapidly generate draft content that gets ideas on the page.

IMPORTANT GUIDELINES:
1. Focus on speed and completeness, not perfection
2. Use [TK: description] placeholders for:
   - Facts that need verification
   - Citations that need sourcing
   - Examples that need research
   - Sections that need expansion
3. Keep writing flowing - don't stop to perfect sentences
4. Maintain consistent voice and tone
5. Follow any outline or structure provided
6. Generate roughly the target word count requested

Example TK usage:
- "[TK: cite study on remote work productivity]"
- "[TK: add specific example of this pattern]"
- "[TK: verify this statistic]"

Write in a natural, engaging style. This is a draft - it will be revised later.`
}

/**
 * Build user prompt with context
 */
function buildUserPrompt({ content, metadata, prompt, outline, section, targetWords }) {
  let userPrompt = ''

  if (prompt && prompt.trim()) {
    userPrompt += `## Writing Request\n${prompt}\n\n`
  }

  if (outline && outline.trim()) {
    userPrompt += `## Outline\n${outline}\n\n`
  }

  if (content && content.trim()) {
    userPrompt += `## Existing Content\n${content}\n\n`
  }

  if (section && section.trim()) {
    userPrompt += `Focus specifically on this section: ${section}\n\n`
  }

  userPrompt += `Target word count: approximately ${targetWords} words\n\n`
  userPrompt += `Generate the draft content now. Use [TK: description] for any gaps that need research or verification.`

  return userPrompt
}

/**
 * Create draft proposal
 */
function createDraftProposal(draftContent, documentState, section) {
  const content = documentState.getContent()

  // If section specified, try to insert at relevant location
  // Otherwise, append to end or replace all if empty
  let location
  let type
  let originalText = ''

  if (!content || content.trim() === '') {
    // Empty document - replace all
    type = CHANGE_TYPES.REPLACE
    location = { start: 0, end: 0 }
  } else if (section) {
    // Try to find section header
    const sectionRegex = new RegExp(`^#+\\s+${section}`, 'mi')
    const match = sectionRegex.exec(content)

    if (match) {
      // Insert after section header
      const insertPosition = match.index + match[0].length
      type = CHANGE_TYPES.INSERT
      location = { start: insertPosition, end: insertPosition }
    } else {
      // Section not found, append to end
      type = CHANGE_TYPES.INSERT
      location = { start: content.length, end: content.length }
    }
  } else {
    // Append to end
    type = CHANGE_TYPES.INSERT
    location = { start: content.length, end: content.length }
  }

  return {
    type,
    location,
    originalText,
    proposedText: draftContent,
    rationale: 'Generated draft content based on your request',
    category: CHANGE_CATEGORIES.CONTENT,
    priority: CHANGE_PRIORITIES.IMPORTANT,
    agentId: DRAFT_AGENT_ID,
    metadata: {
      wordCount: countWords(draftContent),
      tkCount: countTKs(draftContent)
    }
  }
}

/**
 * Count words in text
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Count TK placeholders in text
 */
function countTKs(text) {
  const tkMatches = text.match(/\[TK:[^\]]+\]/g)
  return tkMatches ? tkMatches.length : 0
}
