import React from 'react';

export default function SyntaxHighlighter({ text }) {
  if (!text) {
    return (
      <span className="text-gray-400 dark:text-gray-500">
        Start writing markdown...
      </span>
    );
  }

  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // Highlight markdown syntax (copied from HomePage.jsx original implementation)
  const highlightMarkdownSyntax = (text) => {
    let result = escapeHtml(text);

    // Headers
    result = result.replace(/^(#{1,6}\s)/gm, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    // Bold
    result = result.replace(/(\*\*|__)(.*?)(\*\*|__)/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>$2<span class="text-gray-400 dark:text-gray-500">$3</span>');

    // Italic
    result = result.replace(/(\*|_)([^\*_]+?)(\*|_)/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>$2<span class="text-gray-400 dark:text-gray-500">$3</span>');

    // Strikethrough
    result = result.replace(/(~~)(.*?)(~~)/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>$2<span class="text-gray-400 dark:text-gray-500">$3</span>');

    // Inline code
    result = result.replace(/(`)([^`]+?)(`)/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>$2<span class="text-gray-400 dark:text-gray-500">$3</span>');

    // Code blocks
    result = result.replace(/(```)/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    // Blockquotes
    result = result.replace(/^(&gt;\s|>\s)/gm, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    // Unordered lists
    result = result.replace(/^([\*\-\+]\s)/gm, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    // Ordered lists
    result = result.replace(/^(\d+\.\s)/gm, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    // Links
    result = result.replace(/(\[)([^\]]+?)(\])(\()([^\)]+?)(\))/g, '<span class="text-gray-400 dark:text-gray-500">$1</span>$2<span class="text-gray-400 dark:text-gray-500">$3$4</span>$5<span class="text-gray-400 dark:text-gray-500">$6</span>');

    // Horizontal rules
    result = result.replace(/^(---|\*\*\*|___)$/gm, '<span class="text-gray-400 dark:text-gray-500">$1</span>');

    return result;
  };

  // Convert HTML string to React elements
  const htmlToReact = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const convertNode = (node, index) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const children = Array.from(node.childNodes).map((child, i) =>
          convertNode(child, i)
        );

        if (node.tagName === 'SPAN') {
          return (
            <span key={index} className={node.className}>
              {children}
            </span>
          );
        }

        return <React.Fragment key={index}>{children}</React.Fragment>;
      }

      return null;
    };

    return Array.from(doc.body.childNodes).map((node, i) => convertNode(node, i));
  };

  const highlighted = highlightMarkdownSyntax(text);
  return <>{htmlToReact(highlighted)}</>;
}
