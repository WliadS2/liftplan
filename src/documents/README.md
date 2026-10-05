# Documents

Document view models, export contracts, and generators belong here. Documents consume validated project read models and do not recalculate engineering values.

The technical plan PDF pipeline consumes the existing fixed-page drawing
presentation. It validates completeness, spatial status, fixed scale, and A4
fit before conversion. The SVG page viewBox is mapped to a PDF page with the
same millimetre width and height; drawing bounds are never fitted again.

`technical-plan-pdf.ts` owns preparation, metadata, page order, filenames, and
structured export failures. `technical-plan-pdf-renderer.tsx` serializes the
existing `TechnicalDrawingSvg`, translates its complete visible bounds into a
reserved PDF drawing area, adds paper-space frame/information elements, and
converts that SVG to browser-local vector PDF content through jsPDF and
svg2pdf.js. The translation is calculated in millimetres and never introduces
another scale transform.

`src/drawings/technical-drawing-sheet.ts` owns the physical A4 sheet
partition: a 9 mm frame inset, 6 mm drawing-area padding, and a 34 mm high
title area anchored at the lower right. It provides reusable vector frame,
rules, metadata and planning-notice primitives to both the browser preview and
the PDF renderer. The document modules retain compatibility exports for the
PDF API. These paper-space modules do not change technical drawing primitives
or project geometry. The exporter does not use screenshots, canvas images,
backend services, or a second drawing projection.

The DXF pipeline consumes the unpresented `TechnicalDrawingDocument` directly,
before the SVG/PDF paper-space transformation. `technical-plan-dxf.ts` owns
metadata, deterministic filenames, plan-set order, and structured failures.
`technical-plan-dxf-renderer.ts` maps the existing primitives to browser-local
ASCII DXF R12 (`AC1009`) entities. Coordinates are model-space millimetres;
selected PDF scale, A4 fit, and browser viewport dimensions are deliberately
absent from this path. Complete drawing sets use model-space block definitions
and translation-only inserts, preserving every block's original dimensions.
