'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Fix markdown corruption from machine translation services (Google Translate,
 * MyMemory) before rendering. Applied at render time so even stale cached
 * translations display correctly.
 *
 * Common issues:
 * - "# #Title" → "## Title" (splits ## into # #)
 * - "#Title"   → "# Title"  (removes space after heading marker)
 * - "* *bold* *" → "**bold**" (splits ** into * *)
 * - "· item" / "• item" → "- item" (wrong bullet character)
 */
function cleanMarkdown(raw: string): string {
  let t = raw
  // Reassemble split heading markers: "# #" → "##", "# # #" → "###"
  t = t.replace(/^(#\s)+#(?=\s|\S)/gm, (m) => '#'.repeat((m.match(/#/g) || []).length))
  // Ensure space after heading markers: "#Title" → "# Title"
  t = t.replace(/^(#{1,6})([^ #\n])/gm, '$1 $2')
  // Reassemble bold markers: "* *" → "**"
  t = t.replace(/\*\s\*/g, '**')
  // Fix bullet characters: "· " / "• " → "- "
  t = t.replace(/^(\s*)[·•]\s*/gm, '$1- ')
  // HTML entities from translation APIs
  t = t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // Clean stray spaces inside bold markers (same line only — preserve newlines)
  t = t.replace(/(\*\*)[^\S\n]+/g, '$1').replace(/[^\S\n]+(\*\*)/g, '$1')
  // Restore list marker spacing: "-**" → "- **"
  t = t.replace(/^(\s*-)\*\*/gm, '$1 **')
  return t
}

// Shared markdown renderer for user-authored content (campaign descriptions
// etc.). Inherits the surrounding text color; prose classes handle spacing.
export default function Markdown({ children, className = '' }: { children: string; className?: string }) {
  const cleaned = cleanMarkdown(children)
  return (
    <div className={`prose prose-sm max-w-none prose-headings:text-inherit prose-h2:text-base prose-h2:font-bold prose-h3:text-sm prose-h3:font-bold prose-headings:mt-5 prose-headings:mb-2 prose-p:text-inherit prose-p:my-2 prose-li:text-inherit prose-strong:text-inherit prose-ul:my-2 prose-li:my-0.5 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>
    </div>
  )
}
