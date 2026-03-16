import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Use CDN worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    return extractPdfText(file);
  }
  if (ext === 'docx') {
    return extractDocxText(file);
  }
  if (ext === 'txt' || ext === 'md') {
    return file.text();
  }

  return `[ملف غير مدعوم: ${file.name}]`;
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  const maxPages = Math.min(pdf.numPages, 50);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    if (text.trim()) pages.push(text);
  }

  return pages.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractAllFiles(files: File[]): Promise<{ name: string; text: string }[]> {
  const results: { name: string; text: string }[] = [];
  for (const file of files) {
    try {
      const text = await extractTextFromFile(file);
      if (text.trim()) {
        results.push({ name: file.name, text: text.slice(0, 5000) });
      }
    } catch (e) {
      console.error(`Error parsing ${file.name}:`, e);
      results.push({ name: file.name, text: `[تعذر قراءة الملف: ${file.name}]` });
    }
  }
  return results;
}
