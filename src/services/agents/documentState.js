/**
 * Document State Manager
 *
 * Maintains single source of truth for document content and metadata.
 * Tracks changes, versions, and agent interactions.
 */

export class DocumentState {
  constructor(initialContent = '', metadata = {}) {
    this.content = initialContent
    this.metadata = {
      title: metadata.title || 'Untitled Document',
      createdAt: metadata.createdAt || new Date(),
      updatedAt: new Date(),
      wordCount: this.countWords(initialContent),
      ...metadata
    }
    this.versions = [{
      content: initialContent,
      timestamp: new Date(),
      source: 'initial'
    }]
    this.changeProposals = []
    this.appliedChanges = []
    this.annotations = [] // Agent comments and analysis
  }

  /**
   * Get current content
   */
  getContent() {
    return this.content
  }

  /**
   * Get metadata
   */
  getMetadata() {
    return { ...this.metadata }
  }

  /**
   * Update content and create version
   */
  updateContent(newContent, source = 'user') {
    const oldContent = this.content
    this.content = newContent
    this.metadata.updatedAt = new Date()
    this.metadata.wordCount = this.countWords(newContent)

    // Create version history entry
    this.versions.push({
      content: newContent,
      timestamp: new Date(),
      source,
      diff: this.computeDiff(oldContent, newContent)
    })

    return this.versions.length - 1 // Return version ID
  }

  /**
   * Add a change proposal from an agent
   */
  addChangeProposal(proposal) {
    const proposalWithId = {
      ...proposal,
      id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date()
    }

    this.changeProposals.push(proposalWithId)
    return proposalWithId.id
  }

  /**
   * Get all change proposals
   */
  getChangeProposals(filter = {}) {
    let proposals = [...this.changeProposals]

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

  /**
   * Get pending change proposals
   */
  getPendingProposals() {
    return this.getChangeProposals({ status: 'pending' })
  }

  /**
   * Approve a change proposal and apply it
   */
  approveProposal(proposalId) {
    const proposal = this.changeProposals.find(p => p.id === proposalId)
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    if (proposal.status !== 'pending') {
      throw new Error(`Proposal ${proposalId} is not pending`)
    }

    // Apply the change
    const newContent = this.applyChange(proposal)
    this.updateContent(newContent, `agent:${proposal.agentId}`)

    // Update proposal status
    proposal.status = 'approved'
    proposal.appliedAt = new Date()

    // Track applied change
    this.appliedChanges.push({
      proposalId,
      timestamp: new Date()
    })

    return newContent
  }

  /**
   * Reject a change proposal
   */
  rejectProposal(proposalId, reason = '') {
    const proposal = this.changeProposals.find(p => p.id === proposalId)
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`)
    }

    proposal.status = 'rejected'
    proposal.rejectedAt = new Date()
    proposal.rejectionReason = reason

    return proposal
  }

  /**
   * Approve all proposals from an agent run
   */
  approveAllFromAgent(agentId) {
    const proposals = this.getChangeProposals({
      agentId,
      status: 'pending'
    })

    const results = []
    for (const proposal of proposals) {
      try {
        this.approveProposal(proposal.id)
        results.push({ proposalId: proposal.id, success: true })
      } catch (error) {
        results.push({
          proposalId: proposal.id,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Apply a change to the document content
   */
  applyChange(proposal) {
    const { type, location, originalText, proposedText } = proposal
    const content = this.content

    switch (type) {
      case 'replace':
        // Replace text at location
        return (
          content.substring(0, location.start) +
          proposedText +
          content.substring(location.end)
        )

      case 'insert':
        // Insert text at location
        return (
          content.substring(0, location.start) +
          proposedText +
          content.substring(location.start)
        )

      case 'delete':
        // Delete text at location
        return (
          content.substring(0, location.start) +
          content.substring(location.end)
        )

      case 'restructure':
        // More complex restructuring
        return proposedText // Assumes proposedText is full restructured content

      case 'comment':
        // Comments don't change content
        return content

      default:
        throw new Error(`Unknown change type: ${type}`)
    }
  }

  /**
   * Add annotation (agent comment or analysis)
   */
  addAnnotation(annotation) {
    const annotationWithId = {
      ...annotation,
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    }

    this.annotations.push(annotationWithId)
    return annotationWithId.id
  }

  /**
   * Get annotations
   */
  getAnnotations(filter = {}) {
    let annotations = [...this.annotations]

    if (filter.agentId) {
      annotations = annotations.filter(a => a.agentId === filter.agentId)
    }

    if (filter.category) {
      annotations = annotations.filter(a => a.category === filter.category)
    }

    return annotations
  }

  /**
   * Get version history
   */
  getVersionHistory() {
    return [...this.versions]
  }

  /**
   * Revert to a previous version
   */
  revertToVersion(versionIndex) {
    if (versionIndex < 0 || versionIndex >= this.versions.length) {
      throw new Error(`Invalid version index: ${versionIndex}`)
    }

    const version = this.versions[versionIndex]
    this.updateContent(version.content, 'revert')

    return this.content
  }

  /**
   * Count words in text
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length
  }

  /**
   * Compute simple diff between two texts
   */
  computeDiff(oldText, newText) {
    // Simple diff - in production, use a proper diff library
    return {
      added: newText.length - oldText.length,
      type: newText.length > oldText.length ? 'addition' : 'deletion'
    }
  }

  /**
   * Export state for persistence
   */
  export() {
    return {
      content: this.content,
      metadata: this.metadata,
      versions: this.versions,
      changeProposals: this.changeProposals,
      appliedChanges: this.appliedChanges,
      annotations: this.annotations
    }
  }

  /**
   * Import state from persistence
   */
  static import(data) {
    const state = new DocumentState(data.content, data.metadata)
    state.versions = data.versions || []
    state.changeProposals = data.changeProposals || []
    state.appliedChanges = data.appliedChanges || []
    state.annotations = data.annotations || []
    return state
  }
}
