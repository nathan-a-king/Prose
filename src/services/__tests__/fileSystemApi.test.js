import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { fileSystemApi, setupMenuListeners } from '../fileSystemApi'

describe('fileSystemApi', () => {
  beforeEach(() => {
    // Reset window.fileSystem and window.electronAPI
    delete window.fileSystem
    delete window.electronAPI
  })

  describe('isAvailable', () => {
    test('returns false when window.fileSystem is undefined', () => {
      expect(fileSystemApi.isAvailable()).toBe(false)
    })

    test('returns true when window.fileSystem exists', () => {
      window.fileSystem = {}
      expect(fileSystemApi.isAvailable()).toBe(true)
    })
  })

  describe('openFile', () => {
    test('throws error when not in Electron', async () => {
      await expect(fileSystemApi.openFile()).rejects.toThrow(
        'File system access is only available in the desktop app'
      )
    })

    test('opens file and returns path and content', async () => {
      const mockResult = {
        filePath: '/path/to/document.md',
        content: 'File content'
      }

      window.fileSystem = {
        openFile: vi.fn().mockResolvedValue(mockResult)
      }

      const result = await fileSystemApi.openFile()

      expect(window.fileSystem.openFile).toHaveBeenCalled()
      expect(result).toEqual({
        filePath: '/path/to/document.md',
        content: 'File content',
        fileName: 'document.md'
      })
    })

    test('returns null when user cancels', async () => {
      window.fileSystem = {
        openFile: vi.fn().mockResolvedValue(null)
      }

      const result = await fileSystemApi.openFile()
      expect(result).toBeNull()
    })

    test('extracts fileName from Windows path', async () => {
      window.fileSystem = {
        openFile: vi.fn().mockResolvedValue({
          filePath: 'C:\\Users\\Documents\\file.md',
          content: 'Content'
        })
      }

      const result = await fileSystemApi.openFile()
      expect(result.fileName).toBe('file.md')
    })

    test('extracts fileName from Unix path', async () => {
      window.fileSystem = {
        openFile: vi.fn().mockResolvedValue({
          filePath: '/home/user/documents/file.md',
          content: 'Content'
        })
      }

      const result = await fileSystemApi.openFile()
      expect(result.fileName).toBe('file.md')
    })

    test('throws FileSystemApiError on failure', async () => {
      window.fileSystem = {
        openFile: vi.fn().mockRejectedValue(new Error('Read error'))
      }

      await expect(fileSystemApi.openFile()).rejects.toThrow(
        'Failed to open file: Read error'
      )
    })
  })

  describe('saveFile', () => {
    test('throws error when not in Electron', async () => {
      await expect(fileSystemApi.saveFile('/path/to/file.md', 'content')).rejects.toThrow(
        'File system access is only available in the desktop app'
      )
    })

    test('saves file to specified path', async () => {
      window.fileSystem = {
        saveFile: vi.fn().mockResolvedValue(true)
      }

      const result = await fileSystemApi.saveFile('/path/to/file.md', 'File content')

      expect(window.fileSystem.saveFile).toHaveBeenCalledWith(
        '/path/to/file.md',
        'File content'
      )
      expect(result).toBe(true)
    })

    test('throws FileSystemApiError on write failure', async () => {
      window.fileSystem = {
        saveFile: vi.fn().mockRejectedValue(new Error('Write error'))
      }

      await expect(
        fileSystemApi.saveFile('/path/to/file.md', 'content')
      ).rejects.toThrow('Failed to save file: Write error')
    })

    test('handles permission errors', async () => {
      window.fileSystem = {
        saveFile: vi.fn().mockRejectedValue(new Error('Permission denied'))
      }

      await expect(
        fileSystemApi.saveFile('/root/file.md', 'content')
      ).rejects.toThrow('Failed to save file: Permission denied')
    })
  })

  describe('saveFileAs', () => {
    test('throws error when not in Electron', async () => {
      await expect(fileSystemApi.saveFileAs('content')).rejects.toThrow(
        'File system access is only available in the desktop app'
      )
    })

    test('shows save dialog and saves file', async () => {
      window.fileSystem = {
        saveFileAs: vi.fn().mockResolvedValue({
          filePath: '/path/to/newfile.md'
        })
      }

      const result = await fileSystemApi.saveFileAs('File content', 'myfile.md')

      expect(window.fileSystem.saveFileAs).toHaveBeenCalledWith(
        'File content',
        'myfile.md'
      )
      expect(result).toEqual({
        filePath: '/path/to/newfile.md',
        fileName: 'newfile.md'
      })
    })

    test('returns null when user cancels dialog', async () => {
      window.fileSystem = {
        saveFileAs: vi.fn().mockResolvedValue(null)
      }

      const result = await fileSystemApi.saveFileAs('content')
      expect(result).toBeNull()
    })

    test('uses default filename when not provided', async () => {
      window.fileSystem = {
        saveFileAs: vi.fn().mockResolvedValue({
          filePath: '/path/to/untitled.md'
        })
      }

      await fileSystemApi.saveFileAs('content')

      expect(window.fileSystem.saveFileAs).toHaveBeenCalledWith(
        'content',
        'untitled.md'
      )
    })

    test('throws FileSystemApiError on failure', async () => {
      window.fileSystem = {
        saveFileAs: vi.fn().mockRejectedValue(new Error('Save dialog error'))
      }

      await expect(fileSystemApi.saveFileAs('content')).rejects.toThrow(
        'Failed to save file: Save dialog error'
      )
    })
  })

  describe('getFileInfo', () => {
    test('throws error when not in Electron', async () => {
      await expect(fileSystemApi.getFileInfo('/path/to/file.md')).rejects.toThrow(
        'File system access is only available in the desktop app'
      )
    })

    test('returns file information', async () => {
      const mockInfo = {
        size: 1024,
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-02')
      }

      window.fileSystem = {
        getFileInfo: vi.fn().mockResolvedValue(mockInfo)
      }

      const result = await fileSystemApi.getFileInfo('/path/to/file.md')

      expect(window.fileSystem.getFileInfo).toHaveBeenCalledWith('/path/to/file.md')
      expect(result).toEqual(mockInfo)
    })

    test('throws FileSystemApiError on failure', async () => {
      window.fileSystem = {
        getFileInfo: vi.fn().mockRejectedValue(new Error('File not found'))
      }

      await expect(fileSystemApi.getFileInfo('/nonexistent.md')).rejects.toThrow(
        'Failed to get file info: File not found'
      )
    })
  })

  describe('fileExists', () => {
    test('returns false when not in Electron', async () => {
      const result = await fileSystemApi.fileExists('/path/to/file.md')
      expect(result).toBe(false)
    })

    test('returns true when file exists', async () => {
      window.fileSystem = {
        fileExists: vi.fn().mockResolvedValue(true)
      }

      const result = await fileSystemApi.fileExists('/path/to/file.md')

      expect(window.fileSystem.fileExists).toHaveBeenCalledWith('/path/to/file.md')
      expect(result).toBe(true)
    })

    test('returns false when file does not exist', async () => {
      window.fileSystem = {
        fileExists: vi.fn().mockResolvedValue(false)
      }

      const result = await fileSystemApi.fileExists('/path/to/nonexistent.md')
      expect(result).toBe(false)
    })

    test('returns false on error', async () => {
      window.fileSystem = {
        fileExists: vi.fn().mockRejectedValue(new Error('Access denied'))
      }

      const result = await fileSystemApi.fileExists('/restricted/file.md')
      expect(result).toBe(false)
    })
  })

  describe('getFileName', () => {
    test('extracts filename from Unix path', () => {
      const fileName = fileSystemApi.getFileName('/home/user/documents/file.md')
      expect(fileName).toBe('file.md')
    })

    test('extracts filename from Windows path', () => {
      const fileName = fileSystemApi.getFileName('C:\\Users\\Documents\\file.md')
      expect(fileName).toBe('file.md')
    })

    test('handles filename only', () => {
      const fileName = fileSystemApi.getFileName('file.md')
      expect(fileName).toBe('file.md')
    })

    test('returns null for null input', () => {
      const fileName = fileSystemApi.getFileName(null)
      expect(fileName).toBeNull()
    })

    test('returns null for undefined input', () => {
      const fileName = fileSystemApi.getFileName(undefined)
      expect(fileName).toBeNull()
    })

    test('handles path with multiple dots', () => {
      const fileName = fileSystemApi.getFileName('/path/to/my.file.v2.md')
      expect(fileName).toBe('my.file.v2.md')
    })
  })

  describe('getDirectory', () => {
    test('extracts directory from Unix path', () => {
      const dir = fileSystemApi.getDirectory('/home/user/documents/file.md')
      expect(dir).toBe('/home/user/documents')
    })

    test('extracts directory from Windows path', () => {
      const dir = fileSystemApi.getDirectory('C:\\Users\\Documents\\file.md')
      expect(dir).toBe('C:/Users/Documents')
    })

    test('handles root directory', () => {
      const dir = fileSystemApi.getDirectory('/file.md')
      expect(dir).toBe('')
    })

    test('returns null for null input', () => {
      const dir = fileSystemApi.getDirectory(null)
      expect(dir).toBeNull()
    })

    test('returns null for undefined input', () => {
      const dir = fileSystemApi.getDirectory(undefined)
      expect(dir).toBeNull()
    })

    test('handles nested directories', () => {
      const dir = fileSystemApi.getDirectory('/a/b/c/d/file.md')
      expect(dir).toBe('/a/b/c/d')
    })
  })
})

describe('setupMenuListeners', () => {
  let mockHandlers

  beforeEach(() => {
    delete window.fileSystem
    delete window.electronAPI

    mockHandlers = {
      onNewDocument: vi.fn(),
      onSaveDocument: vi.fn(),
      onOpenFile: vi.fn(),
      onSaveFileAs: vi.fn()
    }
  })

  test('returns no-op cleanup function when not in Electron', () => {
    const cleanup = setupMenuListeners(mockHandlers)

    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
  })

  test('registers all menu listeners when electronAPI available', () => {
    window.fileSystem = {}
    window.electronAPI = {
      onNewDocument: vi.fn(),
      onSaveDocument: vi.fn(),
      onOpenFile: vi.fn(),
      onSaveFileAs: vi.fn(),
      removeNewDocumentListener: vi.fn(),
      removeSaveDocumentListener: vi.fn(),
      removeOpenFileListener: vi.fn(),
      removeSaveFileAsListener: vi.fn()
    }

    setupMenuListeners(mockHandlers)

    expect(window.electronAPI.onNewDocument).toHaveBeenCalledWith(
      mockHandlers.onNewDocument
    )
    expect(window.electronAPI.onSaveDocument).toHaveBeenCalledWith(
      mockHandlers.onSaveDocument
    )
    expect(window.electronAPI.onOpenFile).toHaveBeenCalledWith(
      mockHandlers.onOpenFile
    )
    expect(window.electronAPI.onSaveFileAs).toHaveBeenCalledWith(
      mockHandlers.onSaveFileAs
    )
  })

  test('handles partial handlers object', () => {
    window.fileSystem = {}
    window.electronAPI = {
      onNewDocument: vi.fn(),
      onSaveDocument: vi.fn(),
      onOpenFile: vi.fn(),
      onSaveFileAs: vi.fn(),
      removeNewDocumentListener: vi.fn(),
      removeSaveDocumentListener: vi.fn(),
      removeOpenFileListener: vi.fn(),
      removeSaveFileAsListener: vi.fn()
    }

    const partialHandlers = {
      onOpenFile: vi.fn()
    }

    setupMenuListeners(partialHandlers)

    expect(window.electronAPI.onOpenFile).toHaveBeenCalled()
    expect(window.electronAPI.onNewDocument).not.toHaveBeenCalled()
  })

  test('cleanup function removes all listeners', () => {
    window.fileSystem = {}
    window.electronAPI = {
      onNewDocument: vi.fn(),
      onSaveDocument: vi.fn(),
      onOpenFile: vi.fn(),
      onSaveFileAs: vi.fn(),
      removeNewDocumentListener: vi.fn(),
      removeSaveDocumentListener: vi.fn(),
      removeOpenFileListener: vi.fn(),
      removeSaveFileAsListener: vi.fn()
    }

    const cleanup = setupMenuListeners(mockHandlers)
    cleanup()

    expect(window.electronAPI.removeNewDocumentListener).toHaveBeenCalled()
    expect(window.electronAPI.removeSaveDocumentListener).toHaveBeenCalled()
    expect(window.electronAPI.removeOpenFileListener).toHaveBeenCalled()
    expect(window.electronAPI.removeSaveFileAsListener).toHaveBeenCalled()
  })

  test('cleanup handles missing electronAPI gracefully', () => {
    window.fileSystem = {}
    window.electronAPI = {
      onNewDocument: vi.fn(),
      onSaveDocument: vi.fn(),
      onOpenFile: vi.fn(),
      onSaveFileAs: vi.fn(),
      removeNewDocumentListener: vi.fn(),
      removeSaveDocumentListener: vi.fn(),
      removeOpenFileListener: vi.fn(),
      removeSaveFileAsListener: vi.fn()
    }

    const cleanup = setupMenuListeners(mockHandlers)

    // Remove electronAPI before cleanup
    delete window.electronAPI

    expect(() => cleanup()).not.toThrow()
  })
})
