import { useState, useEffect, useCallback } from 'react'
import { fileSystemApi } from '../services/fileSystemApi'

// Sorts recent files: pinned first (by recency), then unpinned (by recency)
function sortRecentFiles(files) {
  const pinned = files.filter(f => f.isPinned)
    .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))
  const unpinned = files.filter(f => !f.isPinned)
    .sort((a, b) => new Date(b.lastOpened) - new Date(a.lastOpened))
  return [...pinned, ...unpinned]
}

// Applies file limit, preserving pinned files and removing oldest unpinned files
function limitRecentFiles(files, maxFiles) {
  if (files.length <= maxFiles) {
    return files
  }

  const pinnedFiles = files.filter(f => f.isPinned)
  const unpinnedFiles = files.filter(f => !f.isPinned)
  const remainingSlots = maxFiles - pinnedFiles.length

  return [...pinnedFiles, ...unpinnedFiles.slice(0, Math.max(0, remainingSlots))]
}

export function useRecentFiles(maxFiles = 15) {
  const [recentFiles, setRecentFiles] = useState([])

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('prose_recent_files')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const migrated = parsed.map(file => ({
          ...file,
          isPinned: file.isPinned ?? false
        }))
        localStorage.setItem('prose_recent_files', JSON.stringify(migrated))
        setRecentFiles(migrated)
      } catch (e) {
        console.error('Failed to parse recent files:', e)
      }
    }
  }, [])

  const addToRecentFiles = useCallback((filePath, content) => {
    const fileName = fileSystemApi.getFileName(filePath)
    const preview = content.substring(0, 100).replace(/\n/g, ' ') + (content.length > 100 ? '...' : '')

    setRecentFiles(prev => {
      const existing = prev.find(f => f.path === filePath)
      const isPinned = existing?.isPinned ?? false
      const filtered = prev.filter(f => f.path !== filePath)

      const updated = [{
        path: filePath,
        name: fileName,
        preview,
        lastOpened: new Date().toISOString(),
        isPinned
      }, ...filtered]

      const sorted = sortRecentFiles(updated)
      const limited = limitRecentFiles(sorted, maxFiles)
      localStorage.setItem('prose_recent_files', JSON.stringify(limited))
      return limited
    })
  }, [maxFiles])

  const togglePin = useCallback((filePath, e) => {
    e.stopPropagation()

    setRecentFiles(prev => {
      const updated = prev.map(file =>
        file.path === filePath
          ? { ...file, isPinned: !file.isPinned }
          : file
      )

      const sorted = sortRecentFiles(updated)
      const limited = limitRecentFiles(sorted, maxFiles)
      localStorage.setItem('prose_recent_files', JSON.stringify(limited))
      return limited
    })
  }, [maxFiles])

  const removeFromRecent = useCallback((filePath, e) => {
    if (e) e.stopPropagation()

    setRecentFiles(prev => {
      const updated = prev.filter(f => f.path !== filePath)
      localStorage.setItem('prose_recent_files', JSON.stringify(updated))
      return updated
    })
  }, [])

  return { recentFiles, addToRecentFiles, togglePin, removeFromRecent }
}
