/**
 * Sanitizes raw legal document content for display.
 * Strips markdown syntax, LaTeX, raw URLs, image references, and other artifacts.
 */
export const sanitizeLegalContent = (content: string): string => {
  if (!content) return '';

  let clean = content;

  // Remove LaTeX blocks: $$ ... $$ and inline $ ... $
  clean = clean.replace(/\$\$[\s\S]*?\$\$/g, '');
  clean = clean.replace(/\$[^$\n]+\$/g, '');

  // Remove LaTeX commands like \mu, \times, \begin{...}, \end{...}, etc.
  clean = clean.replace(/\\(?:mu|times|begin|end|frac|left|right|text|mathbf|mathrm|sqrt|sum|int|lim|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|sigma|omega|pi|phi|psi|partial|nabla|cdot|ldots|dots|cdots|vdots|ddots|hline|cline|multicolumn|textbf|textit|underline|overline|hat|bar|tilde|vec|binom|choose|displaystyle|scriptstyle|big|Big|bigg|Bigg)\b[^a-zA-Z]*/g, '');
  clean = clean.replace(/\\\[_^{}[\]&|]/g, '');
  clean = clean.replace(/\{[^{}]*\}/g, ' ');

  // Remove image references (markdown images and raw image filenames)
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  clean = clean.replace(/\b[a-f0-9]{20,}\.(jpg|jpeg|png|gif|webp|svg|bmp)\b/gi, '');

  // Remove raw URLs
  clean = clean.replace(/https?:\/\/[^\s)>\\]]+/g, '');

  // Remove markdown headers (## ### ####)
  clean = clean.replace(/^#{1,6}\s*/gm, '');

  // Remove markdown bold/italic
  clean = clean.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  clean = clean.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

  // Remove markdown links [text](url)
  clean = clean.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove markdown table separators
  clean = clean.replace(/\|?\s*-{3,}\s*\|?/g, '');
  clean = clean.replace(/^\|.*\|$/gm, (line) => {
    // Keep table content but strip pipes
    return line.replace(/\|/g, ' ').trim();
  });

  // Remove YouTube / embed artifacts
  clean = clean.replace(/Tap to unmute[\s\S]*?restarting your device\./gi, '');
  clean = clean.replace(/\b(Watch later|Share|Copy link|Info|Shopping|Search|2x|Unmute|Subscribe)\b/gi, '');
  clean = clean.replace(/If playback doesn't[\s\S]*?your device\./gi, '');

  // Remove [PDF] prefix
  clean = clean.replace(/\[PDF\]\s*/gi, '');

  // Remove markdown reference-style links [text]: url
  clean = clean.replace(/^\[.*?\]:\s*.*$/gm, '');

  // Collapse multiple spaces and blank lines
  clean = clean.replace(/[ \t]{2,}/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.trim();

  return clean;
};

/**
 * Returns a short, clean excerpt from legal document content.
 */
export const getCleanExcerpt = (content: string, maxLength = 300): string => {
  const clean = sanitizeLegalContent(content);
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.7 ? cut.slice(0, lastSpace) : cut) + '...';
};
