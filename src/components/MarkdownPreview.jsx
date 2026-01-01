import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export default function MarkdownPreview({ text, preprocessMarkdown }) {
  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: ({ children }) => {
            if (!children || (Array.isArray(children) && children.length === 0)) {
              return <div className="h-6" />;
            }
            return <p className="mb-6 text-base leading-relaxed text-gray-700 dark:text-gray-300 text-justify font-light preview-paragraph">{children}</p>;
          },
          h1: ({ children }) => <h1 className="text-3xl font-medium text-gray-900 dark:text-gray-100 mb-8 mt-2 text-center preview-h1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-6 mt-8 preview-h2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-normal text-gray-900 dark:text-gray-100 mb-4 mt-6 preview-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="text-lg font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4 preview-h4">{children}</h4>,
          h5: ({ children }) => <h5 className="text-base font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4 preview-h5">{children}</h5>,
          h6: ({ children }) => <h6 className="text-sm font-normal text-gray-900 dark:text-gray-100 mb-3 mt-4 preview-h6">{children}</h6>,
          ul: ({ children }) => <ul className="mb-6 list-disc pl-6 space-y-2 text-base text-gray-700 dark:text-gray-300 font-light">{children}</ul>,
          ol: ({ children }) => <ol className="mb-6 list-decimal pl-6 space-y-2 text-base text-gray-700 dark:text-gray-300 font-light">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed preview-li">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-neutral-600 pl-6 my-6 italic text-gray-700 dark:text-gray-300">{children}</blockquote>,
          code: ({ inline, children }) => {
            if (inline) {
              return <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-neutral-700 text-xs font-mono rounded text-gray-800 dark:text-gray-200">{children}</code>;
            }
            return <code>{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="mb-6 p-4 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg overflow-x-auto">
              <code className="text-gray-800 dark:text-gray-200">{children}</code>
            </pre>
          ),
          strong: ({ children }) => <strong className="font-normal text-gray-900 dark:text-gray-100">{children}</strong>,
          a: ({ href, children }) => {
            const handleClick = (e) => {
              // In Electron, the main process will handle external links
              // via the will-navigate event, so we just need to handle
              // the fallback for web browsers
              if (!href?.startsWith('http://localhost')) {
                e.preventDefault();
                window.open(href, '_blank', 'noopener,noreferrer');
              }
            };
            return (
              <a
                href={href}
                onClick={handleClick}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-1 underline-offset-2 cursor-pointer"
              >
                {children}
              </a>
            );
          }
        }}
      >
        {preprocessMarkdown(text) || '# Start writing some markdown!\n\nYour preview will appear here.'}
      </ReactMarkdown>
    </div>
  )
}
