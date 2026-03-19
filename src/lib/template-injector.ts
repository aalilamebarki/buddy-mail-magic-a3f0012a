/**
 * Template Injector
 * 
 * Downloads the original .docx template from storage and injects
 * generated body content into it — preserving ALL original formatting:
 * headers, footers, images, fonts, styles, page setup.
 * 
 * This is far more reliable than parsing/reconstructing the letterhead
 * because the original file is never modified in those sections.
 * 
 * Strategy:
 * 1. Use the `docx` library to generate body content (tables, paragraphs)
 * 2. Pack that content into a temporary blob
 * 3. Open both the template AND the generated doc with JSZip
 * 4. Extract body paragraphs from generated doc
 * 5. Inject them into the template, preserving template's sectPr (headers/footers)
 * 6. Copy any generated media (e.g. images in body) to template
 * 7. Return final blob
 */

import JSZip from 'jszip';
import { Document, Packer, Paragraph, Table } from 'docx';
import { supabase } from '@/integrations/supabase/client';

/**
 * Download a template blob from Supabase storage.
 */
export async function downloadTemplate(templatePath: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from('letterhead-templates')
      .download(templatePath);
    if (error || !data) {
      console.warn('Template download failed:', error?.message);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Template download error:', e);
    return null;
  }
}

/**
 * Extract the body content (paragraphs/tables XML) from a document.xml string.
 * Returns everything inside <w:body> EXCEPT the final <w:sectPr>.
 */
function extractBodyContent(documentXml: string): string {
  // Find <w:body>...</w:body>
  const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return '';

  let bodyInner = bodyMatch[1];

  // Remove the final <w:sectPr>...</w:sectPr> (section properties that reference headers/footers)
  // Keep only body paragraphs and tables
  bodyInner = bodyInner.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>\s*$/, '');

  return bodyInner.trim();
}

/**
 * Extract the <w:sectPr> from a document.xml string.
 */
function extractSectPr(documentXml: string): string {
  const match = documentXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  return match ? match[0] : '';
}

/**
 * Inject generated body content into an original template.
 * 
 * @param templateBlob - The original .docx template file
 * @param bodyChildren - Array of Paragraph/Table from the `docx` library
 * @returns Final blob with template header/footer + generated body
 */
export async function injectIntoTemplate(
  templateBlob: Blob,
  bodyChildren: (Paragraph | Table)[],
): Promise<Blob> {
  // 1. Generate a temporary document with just the body content
  const tempDoc = new Document({
    sections: [{
      children: bodyChildren,
    }],
  });
  const tempBlob = await Packer.toBlob(tempDoc);

  // 2. Open both ZIPs
  const [templateZip, generatedZip] = await Promise.all([
    JSZip.loadAsync(templateBlob),
    JSZip.loadAsync(tempBlob),
  ]);

  // 3. Read document.xml from both
  const templateDocXml = await templateZip.file('word/document.xml')?.async('string');
  const generatedDocXml = await generatedZip.file('word/document.xml')?.async('string');

  if (!templateDocXml || !generatedDocXml) {
    throw new Error('Could not read document.xml');
  }

  // 4. Extract body content from generated doc (no sectPr)
  const newBodyContent = extractBodyContent(generatedDocXml);

  // 5. Extract sectPr from template (preserves header/footer references)
  const templateSectPr = extractSectPr(templateDocXml);

  // 6. Rebuild template's document.xml with new body
  const newDocXml = templateDocXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${newBodyContent}${templateSectPr}</w:body>`,
  );

  templateZip.file('word/document.xml', newDocXml);

  // 7. Copy any media files from generated doc that don't exist in template
  //    (e.g., images created by the docx library for the body)
  const genMediaFiles = Object.keys(generatedZip.files).filter(p => p.startsWith('word/media/'));
  for (const mediaPath of genMediaFiles) {
    if (!templateZip.file(mediaPath)) {
      const mediaData = await generatedZip.file(mediaPath)!.async('uint8array');
      templateZip.file(mediaPath, mediaData);
    }
  }

  // 8. Merge relationships: add any new relationships from generated doc
  const templateRelsPath = 'word/_rels/document.xml.rels';
  const generatedRelsPath = 'word/_rels/document.xml.rels';
  const templateRels = await templateZip.file(templateRelsPath)?.async('string');
  const generatedRels = await generatedZip.file(generatedRelsPath)?.async('string');

  if (templateRels && generatedRels) {
    // Extract individual relationships from generated
    const genRelRegex = /<Relationship[^>]+\/>/g;
    const templateRelRegex = /<Relationship[^>]+\/>/g;
    
    const existingIds = new Set<string>();
    let m;
    while ((m = templateRelRegex.exec(templateRels)) !== null) {
      const idMatch = m[0].match(/Id=\"([^\"]+)\"/);
      if (idMatch) existingIds.add(idMatch[1]);
    }

    const newRels: string[] = [];
    while ((m = genRelRegex.exec(generatedRels)) !== null) {
      const idMatch = m[0].match(/Id=\"([^\"]+)\"/);
      if (idMatch && !existingIds.has(idMatch[1])) {
        // Only add media/image relationships, skip header/footer refs
        if (m[0].includes('image') || m[0].includes('media')) {
          newRels.push(m[0]);
        }
      }
    }

    if (newRels.length > 0) {
      const updatedRels = templateRels.replace(
        '</Relationships>',
        newRels.join('\n') + '\n</Relationships>',
      );
      templateZip.file(templateRelsPath, updatedRels);
    }
  }

  // 9. Merge styles: copy numbering.xml if generated has one and template doesn't
  for (const auxFile of ['word/numbering.xml']) {
    if (!templateZip.file(auxFile) && generatedZip.file(auxFile)) {
      const data = await generatedZip.file(auxFile)!.async('string');
      templateZip.file(auxFile, data);
    }
  }

  // 10. Generate final blob
  return templateZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
