/**
 * Change Proposal Panel Component
 *
 * Displays and manages change proposals from agents.
 * Allows approving, rejecting, and reviewing suggested edits.
 */

import { useState } from 'react'
import { useDocumentProposals } from '../../contexts/AgentContext'
import { CHANGE_CATEGORIES, CHANGE_PRIORITIES, CHANGE_TYPES } from '../../agents'

export default function ChangeProposalPanel({ onClose, onApplyChange }) {
  const {
    changeProposals,
    approveProposal,
    rejectProposal,
    approveAllFromAgent
  } = useDocumentProposals()

  const [filter, setFilter] = useState('pending') // 'pending' | 'approved' | 'rejected' | 'all'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [expandedProposalId, setExpandedProposalId] = useState(null)

  // Filter proposals
  const filteredProposals = changeProposals.filter(proposal => {
    if (filter !== 'all' && proposal.status !== filter) return false
    if (categoryFilter !== 'all' && proposal.category !== categoryFilter) return false
    return true
  })

  // Group proposals by agent
  const proposalsByAgent = {}
  filteredProposals.forEach(proposal => {
    const agentId = proposal.agentId
    if (!proposalsByAgent[agentId]) {
      proposalsByAgent[agentId] = []
    }
    proposalsByAgent[agentId].push(proposal)
  })

  // Handle approve
  const handleApprove = (proposalId) => {
    try {
      const newContent = approveProposal(proposalId)
      if (onApplyChange) {
        onApplyChange(newContent)
      }
    } catch (error) {
      console.error('Failed to approve proposal:', error)
    }
  }

  // Handle reject
  const handleReject = (proposalId) => {
    try {
      rejectProposal(proposalId)
    } catch (error) {
      console.error('Failed to reject proposal:', error)
    }
  }

  // Handle approve all from agent
  const handleApproveAllFromAgent = (agentId) => {
    try {
      approveAllFromAgent(agentId)
    } catch (error) {
      console.error('Failed to approve all proposals:', error)
    }
  }

  const pendingCount = changeProposals.filter(p => p.status === 'pending').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-6 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Change Proposals
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {pendingCount} pending {pendingCount === 1 ? 'suggestion' : 'suggestions'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Categories</option>
            <option value={CHANGE_CATEGORIES.STRUCTURE}>Structure</option>
            <option value={CHANGE_CATEGORIES.STYLE}>Style</option>
            <option value={CHANGE_CATEGORIES.MECHANICS}>Mechanics</option>
            <option value={CHANGE_CATEGORIES.LOGIC}>Logic</option>
            <option value={CHANGE_CATEGORIES.CONTENT}>Content</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredProposals.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No change proposals</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Run an agent to generate suggestions
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(proposalsByAgent).map(([agentId, proposals], index) => (
              <AgentProposalGroup
                key={agentId}
                agentId={agentId}
                proposals={proposals}
                onApprove={handleApprove}
                onReject={handleReject}
                onApproveAll={() => handleApproveAllFromAgent(agentId)}
                expandedProposalId={expandedProposalId}
                setExpandedProposalId={setExpandedProposalId}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Agent Proposal Group Component
 */
function AgentProposalGroup({
  agentId,
  proposals,
  onApprove,
  onReject,
  onApproveAll,
  expandedProposalId,
  setExpandedProposalId,
  index = 0
}) {
  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const hasPending = pendingProposals.length > 0

  return (
    <div
      className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 animate-slide-up"
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {agentId.replace('-agent', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'}
          </p>
        </div>
        {hasPending && (
          <button
            onClick={onApproveAll}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Approve All ({pendingProposals.length})
          </button>
        )}
      </div>

      <div className="space-y-2">
        {proposals.map((proposal, proposalIndex) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onApprove={onApprove}
            onReject={onReject}
            isExpanded={expandedProposalId === proposal.id}
            onToggleExpand={() => setExpandedProposalId(
              expandedProposalId === proposal.id ? null : proposal.id
            )}
            index={proposalIndex}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Proposal Card Component
 */
function ProposalCard({ proposal, onApprove, onReject, isExpanded, onToggleExpand, index = 0 }) {
  const priorityColors = {
    [CHANGE_PRIORITIES.CRITICAL]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    [CHANGE_PRIORITIES.IMPORTANT]: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
    [CHANGE_PRIORITIES.MINOR]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  const categoryColors = {
    [CHANGE_CATEGORIES.STRUCTURE]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    [CHANGE_CATEGORIES.STYLE]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
    [CHANGE_CATEGORIES.MECHANICS]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    [CHANGE_CATEGORIES.LOGIC]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
    [CHANGE_CATEGORIES.CONTENT]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300'
  }

  return (
    <div
      className={`border rounded p-3 transition-colors animate-slide-up ${
        proposal.status === 'approved'
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
          : proposal.status === 'rejected'
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-xs rounded ${priorityColors[proposal.priority]}`}>
              {proposal.priority}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded ${categoryColors[proposal.category]}`}>
              {proposal.category}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {proposal.type}
            </span>
          </div>

          <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
            {proposal.rationale}
          </p>

          {isExpanded && (
            <div className="space-y-2 mt-3 pt-3 border-t border-gray-200 dark:border-neutral-700">
              {proposal.originalText && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Original:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-red-50 dark:bg-red-900/10 p-2 rounded">
                    {proposal.originalText}
                  </p>
                </div>
              )}
              {proposal.proposedText && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Proposed:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/10 p-2 rounded">
                    {proposal.proposedText}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onToggleExpand}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
          >
            {isExpanded ? 'Show less' : 'Show details'}
          </button>
        </div>

        {proposal.status === 'pending' && (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => onApprove(proposal.id)}
              className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
              title="Approve"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => onReject(proposal.id)}
              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
              title="Reject"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {proposal.status === 'approved' && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Approved</span>
        )}

        {proposal.status === 'rejected' && (
          <span className="text-xs text-red-600 dark:text-red-400 font-medium">✗ Rejected</span>
        )}
      </div>
    </div>
  )
}
