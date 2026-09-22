'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Shared markdown renderer for user-authored content (campaign descriptions
// etc.). Inherits the surrounding text color; prose classes handle spacing.
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose prose-sm max-w-none prose-headings:text-inherit prose-p:text-inherit prose-li:text-inherit prose-strong:text-inherit ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
