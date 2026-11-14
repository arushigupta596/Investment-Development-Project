/** Downloadable reports: branded PDF (text, chart, table) and CSV. */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AssistantAnswer } from './assistant'

const NAVY: [number, number, number] = [0, 28, 39]
const TEAL: [number, number, number] = [1, 86, 119]

async function svgToPng(svg: SVGSVGElement | null, scale = 2, bg = '#ffffff'): Promise<{ data: string; w: number; h: number } | null> {
  if (!svg) return null
  const { width, height } = svg.getBoundingClientRect()
  if (!width || !height) return null
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.style.fontFamily = 'Helvetica, Arial, sans-serif'
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  await new Promise((ok, fail) => {
    img.onload = ok
    img.onerror = fail
  })
  const c = document.createElement('canvas')
  c.width = width * scale
  c.height = height * scale
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  return { data: c.toDataURL('image/jpeg', 0.9), w: width, h: height }
}

let logo: Promise<{ data: string; w: number; h: number } | null> | null = null
function loadLogo() {
  logo ??= (async () => {
    try {
      const txt = await (await fetch('/ido-logo-white.svg')).text()
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:300px'
      host.innerHTML = txt
      document.body.appendChild(host)
      const svg = host.querySelector('svg') as SVGSVGElement
      svg.setAttribute('width', '300')
      svg.removeAttribute('height')
      const out = await svgToPng(svg, 3, '#001C27')
      host.remove()
      return out
    } catch {
      return null
    }
  })()
  return logo
}

const plain = (s: string) => s.replace(/\*\*/g, '').replace(/^\s*[-*•]\s/gm, '- ').replace(/[·•]/g, '-').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\n\u00A0-\u00FF]/g, '')

export interface ReportItem {
  question: string
  answer: AssistantAnswer
  chartEl?: HTMLElement | null
}

export async function downloadPdf(items: ReportItem[], title = 'IDO Portfolio Assistant report') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  const l = await loadLogo()
  const drawn = new Set<number>()
  const header = () => {
    const pg = doc.getCurrentPageInfo().pageNumber
    if (drawn.has(pg)) return
    drawn.add(pg)
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, W, 64, 'F')
    if (l) doc.addImage(l.data, 'JPEG', M, 16, 32 * (l.w / l.h), 32)
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.text('Finance Supervisor | Demo data', W - M, 30, { align: 'right' })
    doc.text('As of 12 Nov 2026', W - M, 44, { align: 'right' })
  }
  const footer = () => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(128, 142, 147)
    doc.text('All figures are fictional demo data generated for illustration. Investment & Development Office, Ras Al Khaimah.', M, H - 20)
    doc.text(`Page ${doc.getNumberOfPages()}`, W - M, H - 20, { align: 'right' })
  }
  header()
  let y = 96
  doc.setTextColor(...NAVY)
  doc.setFontSize(18)
  doc.text(title, M, y)
  y += 16
  doc.setFontSize(9)
  doc.setTextColor(111, 125, 130)
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, M, y)
  y += 24

  const ensure = async (h: number) => {
    if (y + h > H - 50) {
      footer()
      doc.addPage()
      header()
      y = 90
    }
  }

  for (const [i, it] of items.entries()) {
    await ensure(60)
    doc.setFontSize(12)
    doc.setTextColor(...TEAL)
    const q = doc.splitTextToSize(plain(`${items.length > 1 ? `${i + 1}. ` : ''}${it.question}`), W - 2 * M)
    doc.text(q, M, y)
    y += q.length * 15 + 4
    doc.setFontSize(10)
    doc.setTextColor(...NAVY)
    for (const para of plain(it.answer.text).split('\n')) {
      const lines = doc.splitTextToSize(para || ' ', W - 2 * M)
      await ensure(lines.length * 13)
      doc.text(lines, M, y)
      y += lines.length * 13
    }
    y += 8
    const svg = it.chartEl?.querySelector('svg.recharts-surface') as SVGSVGElement | null
    const png = await svgToPng(svg).catch(() => null)
    if (png) {
      const w = W - 2 * M
      const h = Math.min(260, w * (png.h / png.w))
      await ensure(h + 24)
      if (it.answer.chart?.title) {
        doc.setFontSize(10)
        doc.setTextColor(111, 125, 130)
        doc.text(plain(it.answer.chart.title), M, y)
        y += 10
      }
      doc.addImage(png.data, 'JPEG', M, y, h / (png.h / png.w), h)
      y += h + 14
    }
    if (it.answer.table) {
      await ensure(60)
      autoTable(doc, {
        startY: y,
        head: [it.answer.table.columns.map((c) => plain(String(c)))],
        body: it.answer.table.rows.map((r) => r.map((c) => (typeof c === 'number' ? c.toLocaleString('en-US') : plain(String(c))))),
        margin: { left: M, right: M, top: 90, bottom: 50 },
        styles: { fontSize: 8, cellPadding: 4, textColor: NAVY },
        headStyles: { fillColor: TEAL, textColor: 255 },
        alternateRowStyles: { fillColor: [238, 243, 245] },
        didDrawPage: () => {
          const pg = doc.getCurrentPageInfo().pageNumber
          if (!drawn.has(pg)) {
            header()
            footer()
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20
    }
    y += 10
  }
  footer()
  doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`)
}

export function downloadCsv(a: AssistantAnswer, name = 'ido-assistant-data') {
  let cols: string[] = []
  let rows: (string | number)[][] = []
  if (a.table) {
    cols = a.table.columns
    rows = a.table.rows
  } else if (a.chart) {
    cols = [a.chart.xKey, ...a.chart.series.map((s) => s.name ?? s.key)]
    rows = a.chart.data.map((d) => [d[a.chart!.xKey], ...a.chart!.series.map((s) => d[s.key])])
  }
  if (!cols.length) return
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
