import pptxgen from 'pptxgenjs'

const NAVY = '58595B'
const ACCENT = 'FFC600'
const BODY = '374151'
const PAGE_BG = 'F8FAFC'

function extractBulletsFromElement(el: Element): string[] {
  const out: string[] = []
  el.querySelectorAll('li').forEach((li) => {
    const t = li.textContent?.trim()
    if (t) out.push(t)
  })
  if (out.length > 0) return out
  el.querySelectorAll('p').forEach((p) => {
    const t = p.textContent?.trim()
    if (t) out.push(t)
  })
  if (out.length > 0) return out
  el.querySelectorAll('table').forEach((table) => {
    table.querySelectorAll('tr').forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll('th, td'))
        .map((c) => c.textContent?.trim())
        .filter(Boolean)
      if (cells.length) out.push(cells.join(' — '))
    })
  })
  return out
}

function extractSlideContent(section: Element): { title: string; bullets: string[] } {
  const clone = section.cloneNode(true) as HTMLElement
  const h = clone.querySelector('h2, h3, h1')
  const title = h?.textContent?.trim() || 'Slide'
  h?.remove()
  let bullets = extractBulletsFromElement(clone)
  if (bullets.length === 0) {
    const rest = clone.textContent?.replace(/\s+/g, ' ').trim()
    if (rest) bullets = [rest]
  }
  return { title, bullets }
}

export function parseHandoverPresentationSlides(html: string): { title: string; bullets: string[] }[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const article = doc.querySelector('article.tender-handover-presentation') ?? doc.body
  const sections = Array.from(article.querySelectorAll('section.handover-slide'))
  if (sections.length > 0) {
    return sections.map((s) => extractSlideContent(s))
  }
  const title = article.querySelector('h1, h2, h3')?.textContent?.trim() || 'Presentatie'
  const clone = article.cloneNode(true) as HTMLElement
  clone.querySelector('h1, h2, h3')?.remove()
  let bullets = extractBulletsFromElement(clone)
  if (bullets.length === 0) {
    const t = article.textContent?.replace(/\s+/g, ' ').trim()
    if (t) bullets = [t]
  }
  return [{ title, bullets }]
}

/**
 * Bouwt een opgemaakte PowerPoint (16:9) uit de gesanitized HTML-presentatie van de Overdracht Agent.
 */
export async function downloadHandoverPresentationPptx(opts: {
  presentationHtml: string
  fileBaseName: string
  tenderTitle?: string | null
}): Promise<void> {
  const { presentationHtml, fileBaseName, tenderTitle } = opts
  if (typeof document === 'undefined') {
    throw new Error('PowerPoint-export is alleen in de browser beschikbaar.')
  }

  const slides = parseHandoverPresentationSlides(presentationHtml)
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'BidMind'
  pptx.title = tenderTitle ? `Overdracht — ${tenderTitle}` : 'Implementatieplan — presentatie'
  pptx.subject = 'Implementatieplan (overdracht)'

  pptx.defineSlideMaster({
    title: 'HANDOVER_MASTER',
    background: { color: PAGE_BG },
    objects: [{ rect: { x: 0, y: 0, w: 10, h: 0.14, fill: { color: ACCENT } } }],
  })

  const titleSlide = pptx.addSlide({ masterName: 'HANDOVER_MASTER' })
  titleSlide.addText(tenderTitle?.trim() || 'Tender', {
    x: 0.55,
    y: 1.35,
    w: 8.9,
    h: 1.1,
    fontSize: 30,
    bold: true,
    color: NAVY,
    fontFace: 'Arial',
  })
  titleSlide.addText('Implementatieplan — presentatie', {
    x: 0.55,
    y: 2.55,
    w: 8.9,
    h: 0.55,
    fontSize: 16,
    color: NAVY,
    fontFace: 'Arial',
  })

  for (const { title, bullets } of slides) {
    const slide = pptx.addSlide({ masterName: 'HANDOVER_MASTER' })
    slide.addText(title, {
      x: 0.55,
      y: 0.42,
      w: 8.9,
      h: 0.85,
      fontSize: 22,
      bold: true,
      color: NAVY,
      fontFace: 'Arial',
    })
    if (bullets.length > 0) {
      const textParts = bullets.map((b) => ({
        text: b,
        options: { bullet: true, fontSize: 14, color: BODY, breakLine: true, fontFace: 'Arial' },
      }))
      slide.addText(textParts, {
        x: 0.55,
        y: 1.28,
        w: 8.9,
        h: 4.15,
        valign: 'top',
      })
    }
  }

  const safeName = fileBaseName.replace(/[^\w\d\-_.\s]+/g, '_').trim().slice(0, 80) || 'presentatie'
  await pptx.writeFile({ fileName: `${safeName}-presentatie.pptx` })
}
