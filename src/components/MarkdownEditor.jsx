import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const MarkdownEditor = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [content, setContent] = useState('');

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-950">
      {/* Simple header */}
      <div className="flex-none border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Markdown Editor
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
          >
            {isDarkMode ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 p-8">
        <div className="h-full max-w-3xl mx-auto">
          <div className="h-full bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg">
            <div className="h-full p-6">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full resize-none outline-none font-mono text-gray-900 dark:text-gray-100 bg-transparent placeholder-gray-400 dark:placeholder-gray-500 markdown-editor-simple"
                placeholder="Let's make something beautiful"
                spellCheck="false"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;