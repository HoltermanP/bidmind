import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  type FileChild,
} from 'docx'
import { displayTenderTitle } from '@/lib/tenders/resolve-project-title'

/** Converteert een Markdown-string naar een reeks docx Paragraph-elementen. */
function markdownToParagraphs(md: string): FileChild[] {
  const out: FileChild[] = []
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    // Heading 1
    if (/^#\s/.test(trimmed)) {
      out.push(
        new Paragraph({
          text: trimmed.replace(/^#\s+/, '').replace(/\*\*/g, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 320, after: 120 },
        })
      )
      i++
      continue
    }
    // Heading 2
    if (/^##\s/.test(trimmed)) {
      out.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, '').replace(/\*\*/g, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 100 },
        })
      )
      i++
      continue
    }
    // Heading 3
    if (/^###\s/.test(trimmed)) {
      out.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, '').replace(/\*\*/g, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
        })
      )
      i++
      continue
    }
    // Bullet
    if (/^[-*]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text })],
          spacing: { before: 60, after: 60 },
        })
      )
      i++
      continue
    }
    // Numbered list (1. 2. etc.)
    if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
      out.push(
        new Paragraph({
          children: [new TextRun({ text })],
          indent: { left: convertInchesToTwip(0.25) },
          spacing: { before: 60, after: 60 },
        })
      )
      i++
      continue
    }
    // Normal paragraph: ondersteun **vet** en *cursief* via TextRun-splits
    const runParts = splitMarkdownRuns(trimmed)
    out.push(
      new Paragraph({
        children: runParts.length ? runParts : [new TextRun(trimmed.replace(/\*\*/g, '').replace(/\*/g, ''))],
        spacing: { before: 80, after: 80 },
      })
    )
    i++
  }

  return out
}

function splitMarkdownRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  let remaining = text
  const boldRegex = /\*\*([^*]+)\*\*/
  const italicRegex = /\*([^*]+)\*/

  while (remaining.length > 0) {
    const boldMatch = remaining.match(boldRegex)
    const italicMatch = remaining.match(italicRegex)
    let earliest: { index: number; length: number; bold?: boolean; content: string } | null = null

    if (boldMatch && boldMatch.index !== undefined) {
      earliest = { index: boldMatch.index, length: boldMatch[0].length, bold: true, content: boldMatch[1] }
    }
    if (italicMatch && italicMatch.index !== undefined) {
      const candidate = { index: italicMatch.index, length: italicMatch[0].length, content: italicMatch[1] }
      if (!earliest || candidate.index < earliest.index) {
        earliest = { ...candidate, bold: false }
      }
    }

    if (!earliest) {
      const plain = remaining.replace(/\*\*/g, '').replace(/\*/g, '')
      if (plain) runs.push(new TextRun(plain))
      break
    }

    const before = remaining.slice(0, earliest.index).replace(/\*\*/g, '').replace(/\*/g, '')
    if (before) runs.push(new TextRun(before))
    runs.push(
      new TextRun({
        text: earliest.content,
        bold: !!earliest.bold,
        italics: !earliest.bold,
      })
    )
    remaining = remaining.slice(earliest.index + earliest.length)
  }

  return runs
}

export interface TenderForExport {
  title: string | null
  contractingAuthority: string | null
  referenceNumber: string | null
}

export interface SectionForExport {
  title: string | null
  content: string | null
  orderIndex: number | null
}

/**
 * Bouwt een Word-document van de aanbieding (tender + secties).
 * Secties worden gesorteerd op orderIndex; content wordt als Markdown geïnterpreteerd.
 */
export async function buildAanbiedingDocx(
  tender: TenderForExport,
  sections: SectionForExport[]
): Promise<Buffer> {
  const sortedSections = [...sections].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
  const children: FileChild[] = []
  const docTitle = displayTenderTitle(tender.title) || 'Aanbieding'

  // Titelpagina / header
  children.push(
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
    })
  )
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: tender.contractingAuthority || '',
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  )
  if (tender.referenceNumber) {
    children.push(
      new Paragraph({
        text: `Referentie: ${tender.referenceNumber}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    )
  }
  children.push(
    new Paragraph({
      text: `Document gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  for (const section of sortedSections) {
    const title = section.title || 'Sectie'
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_1,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2C5282' } },
        spacing: { before: 400, after: 200 },
      })
    )
    const content = (section.content || '').trim()
    if (content) {
      children.push(...markdownToParagraphs(content))
    } else {
      children.push(
        new Paragraph({
          text: '(Geen inhoud)',
          spacing: { before: 80, after: 80 },
        })
      )
    }
  }

  const doc = new Document({
    title: docTitle,
    creator: 'BidMind',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  })

  return Packer.toBuffer(doc)
}
