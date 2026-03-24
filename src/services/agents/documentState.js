/**
 * Document State — Immutable Data Pattern
 *
 * Plain state objects + pure functions that return new state.
 * Maintains single source of truth for document content and metadata.
 *
 * The DocumentState class at the bottom is a backward-compatible wrapper
 * for consumers that haven't migrated to the pure function API yet.
 */

const MAX_VERSIONS = 50

// ─── Utilities ───────────────────────────────────────────────────────────────

export function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

export function computeDiff(oldText, newText) {
  return {
    added: newText.length - oldText.length,
    type: newText.length > oldText.length ? 'addition' : 'deletion'
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDocumentState(content = '', metadata = {}) {
  return {
    content,
    metadata: {
      title: metadata.title || 'Untitled Document',
      createdAt: metadata.createdAt || new Date(),
      updatedAt: new Date(),
      wordCount: countWords(content),
      ...metadata
    },
    versions: [{
      content,
      timestamp: new Date(),
      source: 'initial'
    }],
    changeProposals: [],
    appliedChanges: [],
    annotations: []
  }
}

// ─── Pure State Transitions ──────────────────────────────────────────────────

function capVersions(versions) {
  if (versions.length <= MAX_VERSIONS) return versions
  // Keep the initial version (index 0) and the most recent entries
  return [versions[0], ...versions.slice(versions.length - (MAX_VERSIONS - 1))]
}

export function updateContent(state, newContent, source = 'user') {
  const newVersions = capVersions([...state.versions, {
    content: newContent,
    timestamp: new Date(),
    source,
    diff: computeDiff(state.content, newContent)
  }])

  return {
    ...state,
    content: newContent,
    metadata: {
      ...state.metadata,
      updatedAt: new Date(),
      wordCount: countWords(newContent)
    },
    versions: newVersions
  }
}

export function addChangeProposal(state, proposal) {
  const proposalWithId = {
    ...proposal,
    id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending',
    createdAt: new Date()
  }

  return {
    newState: {
      ...state,
      changeProposals: [...state.changeProposals, proposalWithId]
    },
    proposalId: proposalWithId.id
  }
}

export function applyChange(content, proposal) {
  const { type, location, originalText, proposedText } = proposal

  switch (type) {
    case 'replace':
      if (originalText && originalText.trim()) {
        const index = content.indexOf(originalText)
        if (index !== -1) {
          return (
            content.substring(0, index) +
            proposedText +
            content.substring(index + originalText.length)
          )
        } else {
          console.warn('Could not find exact match for originalText, using positions:', originalText.substring(0, 50))
          return (
            content.substring(0, location.start) +
            proposedText +
            content.substring(location.end)
          )
        }
      } else {
        return (
          content.substring(0, location.start) +
          proposedText +
          content.substring(location.end)
        )
      }

    case 'insert':
      return (
        content.substring(0, location.start) +
        proposedText +
        content.substring(location.start)
      )

    case 'delete':
      return (
        content.substring(0, location.start) +
        content.substring(location.end)
      )

    case 'restructure':
      return proposedText

    case 'comment':
      return content

    default:
      throw new Error(`Unknown change type: ${type}`)
  }
}

function markInvalidatedProposals(proposals, contentAfter, appliedProposalId) {
  return proposals.map(proposal => {
    if (proposal.id === appliedProposalId) return proposal
    if (proposal.status !== 'pending' || !proposal.originalText) return proposal

    const stillExists = contentAfter.indexOf(proposal.originalText) !== -1
    if (stillExists) return proposal

    return {
      ...proposal,
      metadata: {
        ...proposal.metadata,
        mayBeInvalid: true
      }
    }
  })
}

export function approveProposal(state, proposalId) {
  const proposal = state.changeProposals.find(p => p.id === proposalId)
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`)
  }
  if (proposal.status !== 'pending') {
    throw new Error(`Proposal ${proposalId} is not pending`)
  }

  const newContent = applyChange(state.content, proposal)
  const contentUpdated = updateContent(state, newContent, `agent:${proposal.agentId}`)

  const updatedProposals = markInvalidatedProposals(
    contentUpdated.changeProposals,
    newContent,
    proposalId
  ).map(p =>
    p.id === proposalId
      ? { ...p, status: 'approved', appliedAt: new Date() }
      : p
  )

  return {
    ...contentUpdated,
    changeProposals: updatedProposals,
    appliedChanges: [...contentUpdated.appliedChanges, {
      proposalId,
      timestamp: new Date()
    }]
  }
}

export function rejectProposal(state, proposalId, reason = '') {
  const proposal = state.changeProposals.find(p => p.id === proposalId)
  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`)
  }

  return {
    ...state,
    changeProposals: state.changeProposals.map(p =>
      p.id === proposalId
        ? { ...p, status: 'rejected', rejectedAt: new Date(), rejectionReason: reason }
        : p
    )
  }
}

export function approveAllFromAgent(state, agentId) {
  const pending = getChangeProposals(state, { agentId, status: 'pending' })

  let currentState = state
  const results = []

  for (const proposal of pending) {
    try {
      currentState = approveProposal(currentState, proposal.id)
      results.push({ proposalId: proposal.id, success: true })
    } catch (error) {
      results.push({ proposalId: proposal.id, success: false, error: error.message })
    }
  }

  return { newState: currentState, results }
}

export function addAnnotation(state, annotation) {
  const annotationWithId = {
    ...annotation,
    id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date()
  }

  return {
    newState: {
      ...state,
      annotations: [...state.annotations, annotationWithId]
    },
    annotationId: annotationWithId.id
  }
}

export function revertToVersion(state, versionIndex) {
  if (versionIndex < 0 || versionIndex >= state.versions.length) {
    throw new Error(`Invalid version index: ${versionIndex}`)
  }

  const version = state.versions[versionIndex]
  return updateContent(state, version.content, 'revert')
}

// ─── Pure Queries ────────────────────────────────────────────────────────────

export function getChangeProposals(state, filter = {}) {
  let proposals = state.changeProposals

  if (filter.status) {
    proposals = proposals.filter(p => p.status === filter.status)
  }
  if (filter.agentId) {
    proposals = proposals.filter(p => p.agentId === filter.agentId)
  }
  if (filter.category) {
    proposals = proposals.filter(p => p.category === filter.category)
  }
  if (filter.priority) {
    proposals = proposals.filter(p => p.priority === filter.priority)
  }

  return proposals
}

export function getPendingProposals(state) {
  return getChangeProposals(state, { status: 'pending' })
}

export function getAnnotations(state, filter = {}) {
  let annotations = state.annotations

  if (filter.agentId) {
    annotations = annotations.filter(a => a.agentId === filter.agentId)
  }
  if (filter.category) {
    annotations = annotations.filter(a => a.category === filter.category)
  }

  return annotations
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function exportState(state) {
  return {
    content: state.content,
    metadata: state.metadata,
    versions: state.versions,
    changeProposals: state.changeProposals,
    appliedChanges: state.appliedChanges,
    annotations: state.annotations
  }
}

export function importState(data) {
  return {
    content: data.content,
    metadata: data.metadata,
    versions: data.versions || [],
    changeProposals: data.changeProposals || [],
    appliedChanges: data.appliedChanges || [],
    annotations: data.annotations || []
  }
}

// ─── Backward-Compatible Class Wrapper ───────────────────────────────────────
// Delegates to pure functions above. Consumers should migrate to the pure
// function API (Phase 2.2–2.3), after which this class can be removed.

export class DocumentState {
  constructor(initialContent = '', metadata = {}) {
    this._state = createDocumentState(initialContent, metadata)
  }

  getState() {
    return this._state
  }

  setState(state) {
    this._state = state
  }

  getContent() {
    return this._state.content
  }

  getMetadata() {
    return { ...this._state.metadata }
  }

  updateContent(newContent, source = 'user') {
    this._state = updateContent(this._state, newContent, source)
    return this._state.versions.length - 1
  }

  addChangeProposal(proposal) {
    const { newState, proposalId } = addChangeProposal(this._state, proposal)
    this._state = newState
    return proposalId
  }

  getChangeProposals(filter = {}) {
    return getChangeProposals(this._state, filter)
  }

  getPendingProposals() {
    return getPendingProposals(this._state)
  }

  approveProposal(proposalId) {
    this._state = approveProposal(this._state, proposalId)
    return this._state.content
  }

  rejectProposal(proposalId, reason = '') {
    this._state = rejectProposal(this._state, proposalId, reason)
    const proposal = this._state.changeProposals.find(p => p.id === proposalId)
    return proposal
  }

  approveAllFromAgent(agentId) {
    const { newState, results } = approveAllFromAgent(this._state, agentId)
    this._state = newState
    return results
  }

  applyChange(proposal) {
    return applyChange(this._state.content, proposal)
  }

  addAnnotation(annotation) {
    const { newState, annotationId } = addAnnotation(this._state, annotation)
    this._state = newState
    return annotationId
  }

  getAnnotations(filter = {}) {
    return getAnnotations(this._state, filter)
  }

  getVersionHistory() {
    return [...this._state.versions]
  }

  revertToVersion(versionIndex) {
    this._state = revertToVersion(this._state, versionIndex)
    return this._state.content
  }

  updatePendingProposalsAfterChange() {
    // Now handled internally by approveProposal
  }

  countWords(text) {
    return countWords(text)
  }

  computeDiff(oldText, newText) {
    return computeDiff(oldText, newText)
  }

  export() {
    return exportState(this._state)
  }

  static import(data) {
    const state = new DocumentState()
    state.setState({
      ...importState(data),
      // Preserve content from import data
      content: data.content
    })
    return state
  }
}
