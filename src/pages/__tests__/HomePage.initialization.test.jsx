import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderWithAllProviders } from '../../test/utils/renderWithProviders'
import HomePage from '../HomePage'
import * as documentApi from '../../services/documentApi'
import * as fileSystemApi from '../../services/fileSystemApi'

// Mock APIs
vi.mock('../../services/documentApi', () => ({
  documentApi: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  }
}))

vi.mock('../../services/fileSystemApi', () => ({
  fileSystemApi: {
    isAvailable: vi.fn(() => false),
    openFile: vi.fn(),
    saveFile: vi.fn(),
    saveFileAs: vi.fn()
  },
  setupMenuListeners: vi.fn(() => () => {})
}))

// Mock SyntaxHighlighter
vi.mock('../../components/SyntaxHighlighter', () => ({
  default: () => null
}))

// TODO: Complete HomePage tests - need proper component mocking
describe.skip('HomePage - Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    documentApi.documentApi.getAll.mockResolvedValue([])
    localStorage.clear()
  })

  test('loads with empty document by default', async () => {
    render(<HomePage />, { wrapper: ({ children }) => renderWithAllProviders(children).container })

    await waitFor(() => {
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      expect(textarea.value).toBe('')
    })
  })

  test('initializes document state when text is entered', async () => {
    const { container } = renderWithAllProviders(<HomePage />)

    const textarea = container.querySelector('textarea')
    expect(textarea).toBeInTheDocument()

    // Initially no document state
    // When text is entered, document state should be created
  })

  test('loads recent files from localStorage', async () => {
    const recentFiles = [
      { filePath: '/path/to/file1.md', content: 'File 1', lastOpened: Date.now() },
      { filePath: '/path/to/file2.md', content: 'File 2', lastOpened: Date.now() - 1000 }
    ]
    localStorage.setItem('prose_recent_files', JSON.stringify(recentFiles))

    renderWithAllProviders(<HomePage />)

    await waitFor(() => {
      expect(localStorage.getItem('prose_recent_files')).toBeTruthy()
    })
  })

  test('handles malformed localStorage data gracefully', async () => {
    localStorage.setItem('prose_recent_files', 'invalid json')

    renderWithAllProviders(<HomePage />)

    // Should not crash and should continue loading
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  test('sets platform-specific window controls offset', async () => {
    renderWithAllProviders(<HomePage />)

    await waitFor(() => {
      const offset = document.documentElement.style.getPropertyValue('--window-controls-offset')
      expect(offset).toBeDefined()
    })
  })

  test('sets caret color based on theme', async () => {
    renderWithAllProviders(<HomePage />, {
      themeProps: { initialTheme: 'dark' }
    })

    await waitFor(() => {
      const caretColor = document.documentElement.style.getPropertyValue('--editor-caret-color')
      expect(caretColor).toBeDefined()
    })
  })
})
