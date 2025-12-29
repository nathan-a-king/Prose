import { useState, useEffect } from 'react'
import { isApiKeyConfigured } from '../../services/agents/aiService'

export default function SettingsPanel({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState('') // '', 'saving', 'saved', 'error'
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      checkExistingKey()
      setApiKey('')
      setShowKey(false)
      setSaveStatus('')
      setErrorMessage('')
    }
  }, [isOpen])

  const checkExistingKey = async () => {
    const configured = await isApiKeyConfigured()
    setHasExistingKey(configured)
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key')
      return
    }

    // Basic validation: OpenAI keys start with 'sk-'
    if (!apiKey.startsWith('sk-')) {
      setErrorMessage('Invalid API key format. OpenAI keys start with "sk-"')
      return
    }

    setSaveStatus('saving')
    setErrorMessage('')

    try {
      // Save to secure storage
      if (window.secureStorage) {
        await window.secureStorage.set('openai_api_key', apiKey)
        // Migration cleanup: remove from localStorage if it exists
        localStorage.removeItem('openai_api_key')
      } else {
        // Fallback to localStorage (non-Electron environment)
        localStorage.setItem('openai_api_key', apiKey)
      }

      setSaveStatus('saved')
      setHasExistingKey(true)
      setApiKey('')

      setTimeout(() => {
        setSaveStatus('')
      }, 2000)
    } catch (error) {
      console.error('Error saving API key:', error)
      setErrorMessage('Failed to save API key. Please try again.')
      setSaveStatus('error')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your API key? You will need to enter it again to use AI features.')) {
      return
    }

    setSaveStatus('saving')
    setErrorMessage('')

    try {
      if (window.secureStorage) {
        await window.secureStorage.delete('openai_api_key')
      }
      localStorage.removeItem('openai_api_key')

      setSaveStatus('saved')
      setHasExistingKey(false)
      setApiKey('')

      setTimeout(() => {
        setSaveStatus('')
      }, 2000)
    } catch (error) {
      console.error('Error deleting API key:', error)
      setErrorMessage('Failed to delete API key. Please try again.')
      setSaveStatus('error')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key
              </label>

              {hasExistingKey && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900 dark:bg-opacity-20 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-300">
                    API key is configured and encrypted
                  </p>
                </div>
              )}

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasExistingKey ? 'Enter new key to replace existing' : 'sk-...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700
                           dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Your API key is encrypted and stored locally. It never leaves your device.
                <br />
                Get your key from <a href="https://platform.openai.com/api-keys"
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline">
                  OpenAI Platform
                </a>
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-900 dark:bg-opacity-20 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700
                         disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save API Key'}
              </button>

              {hasExistingKey && (
                <button
                  onClick={handleDelete}
                  disabled={saveStatus === 'saving'}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700
                           disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
