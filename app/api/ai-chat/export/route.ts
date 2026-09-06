import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  ImageRun,
  TabStopPosition,
  TabStopType,
} from 'docx'
import fs from 'fs'
import path from 'path'

const COLORS = {
  creator: { brand: 'E6296B', headerBg: 'FFF1F4', logo: 'logo-horizontal.png' },
  brand: { brand: '2563EB', headerBg: 'EFF6FF', logo: 'logo-horizontal.png' },
}

// Will be set per-request
let BRAND_COLOR = 'E6296B'
let HEADER_BG = 'FFF1F4'
const ALT_ROW_BG = 'FAFAFA'
const BORDER_COLOR = 'E5E7EB'
const OVERSEED_WORDMARK_LOGO = 'logo-horizontal.png'

type DocElement = Paragraph | Table

function buildTable(tableRows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows.map((cells, rowIdx) =>
      new TableRow({
        tableHeader: rowIdx === 0,
        children: cells.map((cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: parseInlineFormatting(cell.trim(), rowIdx === 0),
                spacing: { before: 40, after: 40 },
                alignment: AlignmentType.LEFT,
              }),
            ],
            shading: rowIdx === 0
              ? { type: ShadingType.CLEAR, fill: HEADER_BG }
              : rowIdx % 2 === 0
                ? { type: ShadingType.CLEAR, fill: ALT_ROW_BG }
                : undefined,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            },
          })
        ),
      })
    ),
  })
}

function markdownToDocxElements(markdown: string): DocElement[] {
  const elements: DocElement[] = []
  const lines = markdown.split('\n')
  let inCodeBlock = false
  let codeLines: string[] = []
  let inTable = false
  let tableRows: string[][] = []

  const flushTable = () => {
    if (tableRows.length === 0) return
    // Add spacing before table
    elements.push(new Paragraph({ spacing: { before: 120, after: 0 } }))
    elements.push(buildTable(tableRows))
    elements.push(new Paragraph({ spacing: { before: 0, after: 120 } }))
    tableRows = []
  }

  const flushCode = () => {
    if (codeLines.length === 0) return
    // Code block with dark background
    elements.push(new Paragraph({ spacing: { before: 120, after: 0 } }))
    codeLines.forEach((cl, idx) => {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cl || ' ',
              font: 'Courier New',
              size: 17,
              color: 'E2E8F0',
            }),
          ],
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          spacing: { before: 0, after: 0 },
          indent: { left: 200, right: 200 },
        })
      )
    })
    elements.push(new Paragraph({ spacing: { before: 0, after: 120 } }))
    codeLines = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCode()
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Table rows
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter((c) => c.trim() !== '')
      if (cells.every((c) => /^[\s\-:]+$/.test(c))) continue
      if (!inTable) inTable = true
      tableRows.push(cells.map((c) => c.trim()))
      continue
    } else if (inTable) {
      inTable = false
      flushTable()
    }

    // Empty line
    if (!line.trim()) {
      elements.push(new Paragraph({ spacing: { before: 80, after: 80 } }))
      continue
    }

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(5), bold: true, size: 21, font: 'Arial', color: '374151' })],
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 200, after: 60 },
        })
      )
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(4), bold: true, size: 23, font: 'Arial', color: '1F2937' })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
        })
      )
      continue
    }
    if (line.startsWith('## ')) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(3), bold: true, size: 26, font: 'Arial', color: BRAND_COLOR })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'FFD6E0', space: 6 } },
        })
      )
      continue
    }
    if (line.startsWith('# ')) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2), bold: true, size: 32, font: 'Arial', color: '111827' })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: BRAND_COLOR, space: 8 } },
        })
      )
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR, space: 1 } },
          spacing: { before: 160, after: 160 },
        })
      )
      continue
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)/)
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2)
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(bulletMatch[2]),
          bullet: { level: indent },
          spacing: { before: 30, after: 30 },
        })
      )
      continue
    }

    // Numbered list
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.*)/)
    if (numberMatch) {
      const indent = Math.floor(numberMatch[1].length / 2)
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(numberMatch[2]),
          numbering: { reference: 'default-numbering', level: indent },
          spacing: { before: 30, after: 30 },
        })
      )
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        new Paragraph({
          children: [
            new TextRun({ text: '  ' }),
            new TextRun({ text: line.slice(2), italics: true, color: '6B7280', size: 20, font: 'Arial' }),
          ],
          indent: { left: 400 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR, space: 8 } },
          shading: { type: ShadingType.CLEAR, fill: 'FFF8FA' },
          spacing: { before: 80, after: 80 },
        })
      )
      continue
    }

    // Regular paragraph
    elements.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { before: 50, after: 50 },
        indent: { left: 0 },
      })
    )
  }

  if (inTable) flushTable()
  if (inCodeBlock) flushCode()

  return elements
}

function parseInlineFormatting(text: string, isBold = false): TextRun[] {
  const runs: TextRun[] = []
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, size: 20, font: 'Arial' }))
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], bold: true, size: 20, font: 'Arial' }))
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], italics: true, size: 20, font: 'Arial' }))
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], font: 'Courier New', size: 18, color: BRAND_COLOR, shading: { type: ShadingType.CLEAR, fill: 'FFF1F4' } }))
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], bold: isBold, size: 20, font: 'Arial' }))
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, bold: isBold, size: 20, font: 'Arial' }))
  }

  return runs
}

// Detect if markdown has a "table of contents" section (numbered list near the top)
function extractTOC(markdown: string): string[] {
  const lines = markdown.split('\n')
  const tocItems: string[] = []
  let foundTocHeader = false

  for (const line of lines) {
    if (/^#+\s*(目录|table of contents|contents|toc)/i.test(line)) {
      foundTocHeader = true
      continue
    }
    if (foundTocHeader) {
      const m = line.match(/^\d+\.\s+(.+)/)
      if (m) {
        tocItems.push(m[1])
        continue
      }
      if (line.trim() === '') continue
      break // End of TOC
    }
  }
  return tocItems
}

// --- Excel generation ---
function markdownToExcelSheets(markdown: string): { name: string; rows: string[][] }[] {
  const sheets: { name: string; rows: string[][] }[] = []
  const lines = markdown.split('\n')
  let currentSheet = 'Sheet1'
  let currentRows: string[][] = []
  let inTable = false

  const flushSheet = () => {
    if (currentRows.length > 0) {
      sheets.push({ name: currentSheet.slice(0, 31), rows: currentRows })
      currentRows = []
    }
  }

  for (const line of lines) {
    // Heading = new sheet name
    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch && !inTable) {
      flushSheet()
      currentSheet = headingMatch[1].trim().replace(/[\\/*?[\]:]/g, '').slice(0, 31)
      continue
    }

    // Table row
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter((c) => c.trim() !== '')
      if (cells.every((c) => /^[\s\-:]+$/.test(c))) continue
      inTable = true
      currentRows.push(cells.map((c) => c.trim()))
      continue
    }

    if (inTable && !line.trim()) {
      inTable = false
      continue
    }

    // Non-table text — add as single-cell row
    if (line.trim() && !inTable) {
      currentRows.push([line.trim()])
    }
  }
  flushSheet()

  // If no sheets were created, put everything in one sheet
  if (sheets.length === 0) {
    sheets.push({ name: 'Sheet1', rows: markdown.split('\n').filter(l => l.trim()).map(l => [l]) })
  }

  return sheets
}

async function generateExcel(content: string, title: string, theme: string = 'creator'): Promise<Buffer> {
  const excelBrandColor = theme === 'brand' ? 'FF2563EB' : 'FFE6296B'
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AI Assistant'
  workbook.created = new Date()

  const sheets = markdownToExcelSheets(content)

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name)

    sheet.rows.forEach((row, rowIdx) => {
      const excelRow = ws.addRow(row)
      excelRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { vertical: 'middle', wrapText: true }
        if (rowIdx === 0 && row.length > 1) {
          // Header row styling
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: excelBrandColor } }
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
        } else if (rowIdx % 2 === 0 && row.length > 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        }
        cell.border = row.length > 1 ? {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        } : {}
      })
    })

    // Auto-width columns
    ws.columns.forEach((col) => {
      let maxLen = 10
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0
        if (len > maxLen) maxLen = Math.min(len, 50)
      })
      col.width = maxLen + 4
    })
  }

  // Add footer sheet with branding
  const brandSheet = workbook.addWorksheet('About')
  brandSheet.addRow(['Generated by AI Assistant'])
  brandSheet.addRow([`Title: ${title}`])
  brandSheet.addRow([`Date: ${new Date().toLocaleDateString()}`])
  brandSheet.addRow(['Website: overseed.net'])
  brandSheet.getColumn(1).width = 40

  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf)
}

// --- PDF generation ---
async function generatePDF(content: string, title: string, theme: string = 'creator'): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  const brandHex = theme === 'brand' ? '#2563EB' : '#E6296B'
  const logoPath = path.join(process.cwd(), 'public', OVERSEED_WORDMARK_LOGO)
  let hasLogo = false
  try { fs.accessSync(logoPath); hasLogo = true } catch {}

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info: { Title: title, Author: 'AI Assistant', Creator: 'overseed.net' },
    })

    const chunks: Uint8Array[] = []
    doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Cover page
    doc.moveDown(6)
    if (hasLogo) {
      try { doc.image(logoPath, 72, 180, { width: 150 }) } catch {}
    }
    doc.fontSize(28).fillColor(brandHex).text(title, 72, 260, { width: 450 })
    doc.moveDown(1)
    doc.moveTo(72, doc.y).lineTo(523, doc.y).strokeColor(brandHex).lineWidth(2).stroke()
    doc.moveDown(1)
    doc.fontSize(10).fillColor('#9CA3AF')
      .text('Generated by AI Assistant', 72)
      .text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
      .text('overseed.net')

    // Content pages
    doc.addPage()

    const lines = content.split('\n')
    for (const line of lines) {
      // Headings
      if (line.startsWith('#### ')) {
        doc.moveDown(0.5).fontSize(11).fillColor('#374151').text(line.slice(5), { bold: true } as any)
        continue
      }
      if (line.startsWith('### ')) {
        doc.moveDown(0.5).fontSize(12).fillColor('#1F2937').text(line.slice(4), { bold: true } as any)
        continue
      }
      if (line.startsWith('## ')) {
        doc.moveDown(0.8).fontSize(14).fillColor(brandHex).text(line.slice(3), { bold: true } as any)
        doc.moveDown(0.2)
        continue
      }
      if (line.startsWith('# ')) {
        doc.moveDown(1).fontSize(18).fillColor('#111827').text(line.slice(2), { bold: true } as any)
        doc.moveDown(0.3)
        continue
      }

      // Bullet list
      const bulletMatch = line.match(/^\s*[-*]\s+(.*)/)
      if (bulletMatch) {
        doc.fontSize(10).fillColor('#374151').text(`  •  ${bulletMatch[1]}`, { indent: 10 })
        continue
      }

      // Numbered list
      const numMatch = line.match(/^(\d+\.)\s+(.*)/)
      if (numMatch) {
        doc.fontSize(10).fillColor('#374151').text(`  ${numMatch[1]}  ${numMatch[2]}`, { indent: 10 })
        continue
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        doc.moveDown(0.3)
        doc.moveTo(72, doc.y).lineTo(523, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
        doc.moveDown(0.3)
        continue
      }

      // Empty line
      if (!line.trim()) {
        doc.moveDown(0.3)
        continue
      }

      // Regular text — strip markdown bold/italic
      const cleaned = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1')
      doc.fontSize(10).fillColor('#374151').text(cleaned)
    }

    // Footer on each page
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(7).fillColor('#B0B0B0')
        .text('Generated by AI Assistant  |  overseed.net', 72, doc.page.height - 50, {
          width: doc.page.width - 144,
          align: 'center',
        })
    }

    doc.end()
  })
}

// --- Word generation (existing) ---
function generateWord(content: string, title: string, theme: string = 'creator') {
  const elements = markdownToDocxElements(content)

  let headerLogoBuffer: Buffer | null = null
  try {
    headerLogoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', OVERSEED_WORDMARK_LOGO))
  } catch {}

  const headerContent: Paragraph[] = []
  if (headerLogoBuffer) {
    headerContent.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ data: headerLogoBuffer, transformation: { width: 161, height: 32 }, type: 'png' }),
        ],
        spacing: { after: 100 },
      })
    )
  }

  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Generated by AI Assistant  |  overseed.net', font: 'Arial', size: 14, color: 'B0B0B0' })],
  })

  const defaultHeader = new Header({ children: headerContent })
  const defaultFooter = new Footer({ children: [footerParagraph] })

  return new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          { level: 0, format: 'decimal' as any, text: '%1.', alignment: AlignmentType.LEFT },
          { level: 1, format: 'lowerLetter' as any, text: '%2)', alignment: AlignmentType.LEFT },
          { level: 2, format: 'lowerRoman' as any, text: '%3.', alignment: AlignmentType.LEFT },
        ],
      }],
    },
    sections: [
      {
        properties: { page: { margin: { top: 2880, right: 1440, bottom: 1440, left: 1440 } } },
        footers: { default: defaultFooter },
        children: [
          new Paragraph({ spacing: { before: 2000 } }),
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 52, font: 'Arial', color: BRAND_COLOR })], alignment: AlignmentType.LEFT, spacing: { after: 300 } }),
          new Paragraph({ children: [new TextRun({ text: '' })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_COLOR, space: 1 } }, spacing: { after: 300 } }),
          new Paragraph({ children: [new TextRun({ text: 'Generated by AI Assistant', size: 22, color: '9CA3AF', font: 'Arial' })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), size: 22, color: '9CA3AF', font: 'Arial' })], spacing: { after: 80 } }),
          new Paragraph({ children: [new TextRun({ text: 'overseed.net', size: 20, color: BRAND_COLOR, font: 'Arial' })] }),
        ],
      },
      {
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: { default: defaultHeader },
        footers: { default: defaultFooter },
        children: elements as Paragraph[],
      },
    ],
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Doc export is free (0 credits, pricing v4) but rate-limited: 30/hour/user.
  const { checkRateLimit } = await import('@/lib/rate-limit')
  const rate = checkRateLimit(`doc_export:${(session.user as any).id}`, 30, 60 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json(
      { error: 'Too many export requests. Try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    )
  }

  try {
    const { content, title, format = 'docx', theme = 'creator' } = await req.json()
    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Set colors based on theme
    const themeColors = theme === 'brand' ? COLORS.brand : COLORS.creator
    BRAND_COLOR = themeColors.brand
    HEADER_BG = themeColors.headerBg

    const docTitle = title || 'Overseed Document'

    if (format === 'xlsx') {
      const buffer = await generateExcel(content, docTitle, theme)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(docTitle)}.xlsx"`,
        },
      })
    }

    if (format === 'pdf') {
      const buffer = await generatePDF(content, docTitle, theme)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(docTitle)}.pdf"`,
        },
      })
    }

    // Default: docx
    const doc = generateWord(content, docTitle, theme)
    const buffer = await Packer.toBuffer(doc)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(docTitle)}.docx"`,
      },
    })
  } catch (error: any) {
    console.error('Document export error:', error)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
