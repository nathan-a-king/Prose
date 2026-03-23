import { Fragment } from 'react'

export default function RecentFilesSidebar({
  recentFiles,
  isOpen,
  currentFilePath,
  loadingDocuments,
  onOpenFile,
  onOpenRecentFile,
  onTogglePin,
  onRemoveFile
}) {
  return (
    <div className={`fixed top-24 left-8 bottom-8 w-80 bg-white dark:bg-neutral-700 shadow-xl rounded-lg transform transition-transform duration-300 ease-in-out z-10 overflow-hidden ${
      isOpen ? 'translate-x-0' : '-translate-x-96'
    }`}>
      <div className="p-6 border-b border-gray-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-normal text-gray-900 dark:text-gray-100">Recent Files</h2>
          <button
            onClick={onOpenFile}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
            title="Open file (Cmd+O)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Recently opened markdown files</p>
      </div>
      <div className="overflow-y-auto overflow-x-hidden h-full pb-20">
        {loadingDocuments ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <div className="w-6 h-6 border border-gray-400 border-t-transparent rounded-full animate-spin-gpu mx-auto mb-2"></div>
            <p>Loading files...</p>
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm mb-2">No recent files</p>
            <p className="text-xs">Press Cmd+O to open a file</p>
          </div>
        ) : (
          recentFiles.map((file, index) => {
            const prevFile = index > 0 ? recentFiles[index - 1] : null
            const showSeparator = prevFile?.isPinned && !file.isPinned

            return (
              <Fragment key={file.path}>
                {showSeparator && (
                  <div className="border-t border-gray-200 dark:border-neutral-600 my-2">
                    <div className="text-xs text-gray-400 dark:text-gray-500 px-4 py-1 uppercase tracking-wide">
                      Recent
                    </div>
                  </div>
                )}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenRecentFile(file.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenRecentFile(file.path)
                    }
                  }}
                  className={`p-4 border-b border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 cursor-pointer group transition-colors ${
                    currentFilePath === file.path ? 'bg-gray-100 dark:bg-neutral-800 border-gray-300 dark:border-neutral-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <button
                        onClick={(e) => onTogglePin(file.path, e)}
                        className={`p-1 rounded transition-all flex-shrink-0 ${
                          file.isPinned
                            ? 'text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
                            : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100'
                        }`}
                        title={file.isPinned ? 'Unpin file' : 'Pin file'}
                        aria-label={file.isPinned ? 'Unpin file' : 'Pin file'}
                      >
                        <svg className="w-4 h-4" fill={file.isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>

                      <svg className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>

                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{file.path}</p>
                        {file.preview && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{file.preview}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => onRemoveFile(file.path, e)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Remove from recent"
                      aria-label="Remove from recent"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Fragment>
            )
          })
        )}
      </div>
    </div>
  )
}
