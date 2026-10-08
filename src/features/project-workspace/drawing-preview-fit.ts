export interface PreviewSize { readonly width: number; readonly height: number }

/** Screen pixels only. Never used by engineering, fixed 1:N paper layout, PDF or DXF. */
export function fitDrawingSheetToViewport(viewport: PreviewSize, sheet: PreviewSize, marginPx = 16): PreviewSize {
  if (![viewport.width, viewport.height, sheet.width, sheet.height, marginPx].every(Number.isFinite) ||
    viewport.width <= marginPx * 2 || viewport.height <= marginPx * 2 || sheet.width <= 0 || sheet.height <= 0 || marginPx < 0) {
    return { width: 0, height: 0 }
  }
  const factor = Math.min((viewport.width - marginPx * 2) / sheet.width, (viewport.height - marginPx * 2) / sheet.height)
  return { width: sheet.width * factor, height: sheet.height * factor }
}
