# House Of Berry - Stocktake Inventory Platform

Stocktake Inventory Platform is a modern, in-browser inventory control and stocktake experience built with React and Vite. Import Excel workbooks, register new SKUs, capture sold/received movements with audit history, and export reconciled files—all processed locally in the browser.

## ✨ Features

### 📦 Stocktake Workflow
- Workbook import with required header validation for .xlsx files
- Stage sold/received quantities per item with live variance and value impact
- Cost layering to merge received batches and maintain average cost
- Audit trail with operator, adjustment notes, per-item notes, and timestamps
- Analytics window with 30-day movement trends, top/low movers, and category contribution
- New-item movements auto-logged on first commit so exports always capture added SKUs

### 🎛️ Editing & Controls
- Inline unit cost editing with average cost recalculation
- SKU/item search, category filters, and hash-based navigation
- Manual item entry with auto-generated SKUs (configurable prefix/padding)
- Per-item note editing via modal with last-updated context
- Preview net unit/value impact before committing stocktake

### 📤 Export & Share
- Download filled or blank Excel templates with required headers
- Export updated inventory with movements and summary sheets (client-side .xlsx)
- Stocktake confirmation automatically exports (no separate history export needed)
- Timestamped export filenames to avoid overwriting/confusion

## 🛠️ Tech Stack
- Framework: React 19
- Build Tool: Vite (rolldown)
- Styling: Tailwind CSS via @tailwindcss/vite
- Icons: lucide-react
- Excel: xlsx-js-style for parsing, styling, and exports
- Utilities: Custom cost-layering, formatting, and hash-routing helpers

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start the development server (http://localhost:5173)
npm run dev

# Run the production build
npm run build

# Preview the production build locally
npm run preview
```

## 📂 Project Structure

```
src/
├── components/              # Buttons, headers, metric cards, empty states
├── hooks/                   # useInventory state machine, costing, history logic
├── pages/                   # Demo, Stocktake, History, Stats views
├── utils/                   # Excel helpers, formatting, number parsing, classNames
├── constants.js             # Required columns, sheet names, defaults
├── App.jsx                  # Hash-based navigation and layout shell
└── main.jsx                 # Entry point
```

## 🎨 Customization Guide
- Templates & sheets: adjust required columns, sheet names, and default template rows in `src/constants.js`.
- Excel output: tweak headers, column widths, and summary rows in `src/utils/excel.js`.
- Styling: update global fonts/themes in `src/index.css`; refine layout accents in `App.jsx` and page components.
- Behavior: modify cost-layer rules or movement windows inside `useInventory.js` (in `src/hooks`).

## 📝 Development Notes
- Processing is client-side; files never leave the browser. Supports .xlsx (Open XML) only.
- Large workbooks/history can increase client-side processing time with xlsx-js-style.
- UI adapts to mobile/tablet; wide tables scroll horizontally on smaller screens.
- Static hosting: hash-based routing works on GitHub Pages/other static hosts; update `base` in `vite.config.js` if the repo name changes.

---

Happy counting!
