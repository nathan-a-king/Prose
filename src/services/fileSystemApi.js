// File System API service for opening and saving markdown files
// Uses Electron's IPC for file operations when available

class FileSystemApiError extends Error {
  constructor(message) {
    super(message)
    this.name = 'FileSystemApiError'
  }
}

// Check if we're running in Electron with file system access
const isElectron = () => {
  return typeof window !== 'undefined' && window.fileSystem !== undefined
}

export const fileSystemApi = {
  // Check if file system access is available
  isAvailable() {
    return isElectron()
  },

  // Open a file dialog and return the selected file's path and content
  async openFile() {
    if (!isElectron()) {
      throw new FileSystemApiError('File system access is only available in the desktop app')
    }

    try {
      const result = await window.fileSystem.openFile()
      if (!result) {
        return null // User cancelled
      }
      return {
        filePath: result.filePath,
        content: result.content,
        fileName: result.filePath.split(/[/\\]/).pop()
      }
    } catch (error) {
      throw new FileSystemApiError(`Failed to open file: ${error.message}`)
    }
  },

  // Save content to a specific file path
  async saveFile(filePath, content) {
    if (!isElectron()) {
      throw new FileSystemApiError('File system access is only available in the desktop app')
    }

    try {
      const result = await window.fileSystem.saveFile(filePath, content)
      return result
    } catch (error) {
      throw new FileSystemApiError(`Failed to save file: ${error.message}`)
    }
  },

  // Show save dialog and save file
  async saveFileAs(content, defaultName = 'untitled.md') {
    if (!isElectron()) {
      throw new FileSystemApiError('File system access is only available in the desktop app')
    }

    try {
      const result = await window.fileSystem.saveFileAs(content, defaultName)
      if (!result) {
        return null // User cancelled
      }
      return {
        filePath: result.filePath,
        fileName: result.filePath.split(/[/\\]/).pop()
      }
    } catch (error) {
      throw new FileSystemApiError(`Failed to save file: ${error.message}`)
    }
  },

  // Get file info
  async getFileInfo(filePath) {
    if (!isElectron()) {
      throw new FileSystemApiError('File system access is only available in the desktop app')
    }

    try {
      return await window.fileSystem.getFileInfo(filePath)
    } catch (error) {
      throw new FileSystemApiError(`Failed to get file info: ${error.message}`)
    }
  },

  // Check if a file exists
  async fileExists(filePath) {
    if (!isElectron()) {
      return false
    }

    try {
      return await window.fileSystem.fileExists(filePath)
    } catch (error) {
      return false
    }
  },

  // Extract file name from path
  getFileName(filePath) {
    if (!filePath) return null
    return filePath.split(/[/\\]/).pop()
  },

  // Extract directory from path
  getDirectory(filePath) {
    if (!filePath) return null
    const parts = filePath.split(/[/\\]/)
    parts.pop()
    return parts.join('/')
  }
}

// Helper to set up menu event listeners
export const setupMenuListeners = (handlers) => {
  if (!isElectron() || !window.electronAPI) {
    return () => {} // Return no-op cleanup function
  }

  const { onOpenFile, onSaveDocument, onSaveFileAs, onNewDocument } = handlers

  if (onNewDocument) {
    window.electronAPI.onNewDocument(onNewDocument)
  }
  if (onSaveDocument) {
    window.electronAPI.onSaveDocument(onSaveDocument)
  }
  if (onOpenFile) {
    window.electronAPI.onOpenFile(onOpenFile)
  }
  if (onSaveFileAs) {
    window.electronAPI.onSaveFileAs(onSaveFileAs)
  }

  // Return cleanup function
  return () => {
    if (window.electronAPI) {
      window.electronAPI.removeNewDocumentListener()
      window.electronAPI.removeSaveDocumentListener()
      window.electronAPI.removeOpenFileListener()
      window.electronAPI.removeSaveFileAsListener()
    }
  }
}
