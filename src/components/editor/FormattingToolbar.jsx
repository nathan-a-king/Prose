export default function FormattingToolbar({ insertFormatting, insertHeading, insertList, clearFormatting }) {
  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-20 bg-white dark:bg-neutral-700 shadow-lg rounded-lg px-2 py-1.5 flex items-center gap-1 border border-gray-200 dark:border-neutral-600">
      {/* Heading dropdown */}
      <select
        onChange={(e) => e.target.value && insertHeading(parseInt(e.target.value))}
        className="px-2 py-1 text-sm bg-white dark:bg-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-600 rounded cursor-pointer outline-none text-gray-700 dark:text-gray-300 appearance-none pr-6"
        value=""
      >
        <option value="">H</option>
        <option value="1">H1</option>
        <option value="2">H2</option>
        <option value="3">H3</option>
      </select>

      <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />

      {/* Bold */}
      <button
        onClick={() => insertFormatting('**', '**')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Bold (Ctrl+B)"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/>
        </svg>
      </button>

      {/* Italic */}
      <button
        onClick={() => insertFormatting('*', '*')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Italic (Ctrl+I)"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/>
        </svg>
      </button>

      {/* Underline */}
      <button
        onClick={() => insertFormatting('<u>', '</u>')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Underline"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
        </svg>
      </button>

      {/* Strikethrough */}
      <button
        onClick={() => insertFormatting('~~', '~~')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Strikethrough"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12L8 8m4 4l4 4m-4-4l4-4m-4 4l-4 4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18" />
        </svg>
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />

      {/* Link */}
      <button
        onClick={() => insertFormatting('[', '](url)')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Insert link"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </button>

      {/* Quote */}
      <button
        onClick={() => insertFormatting('> ', '')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Quote"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
        </svg>
      </button>

      {/* Code */}
      <button
        onClick={() => insertFormatting('`', '`')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Inline code"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />

      {/* Numbered list */}
      <button
        onClick={() => insertList(true)}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Numbered list"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10l5 5 5-5H7z" />
          <text x="4" y="10" className="text-xs fill-current">1.</text>
        </svg>
      </button>

      {/* Bullet list */}
      <button
        onClick={() => insertList(false)}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Bullet list"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-neutral-600" />

      {/* Horizontal rule */}
      <button
        onClick={() => insertFormatting('\n---\n', '')}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Horizontal rule"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Clear formatting */}
      <button
        onClick={clearFormatting}
        className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded transition-colors"
        title="Clear formatting"
      >
        <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.9,6.9l4.2,4.2l-4.2,4.2L11.5,14l2.8-2.8L11.5,8.4L12.9,6.9z M6.8,11.1h5.7v1.5H6.8V11.1z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h3m12 0h3" />
        </svg>
      </button>
    </div>
  )
}
