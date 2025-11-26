# House Of Berry - Stocktake Inventory Platform

Stocktake Inventory Platform is a modern, in-browser inventory control and stocktake experience built with React and Vite. It delivers a smooth flow from workbook import to adjustment capture, audit-ready history, and analytics-rich exports—all running locally in the browser.

## ✨ Features

### 📦 Stocktake Workflow
- **Workbook Import**: Validates required headers and loads your SKU catalog from .xlsx files.
- **Live Variance Preview**: Stage sold/received quantities per item with immediate unit and value impact.
- **Cost Layering**: Merges received batches and maintains average cost for precise valuation.
- **Audit Trail**: Records operator, notes, and timestamps for every adjustment.
- **Analytics Window**: 30-day movement trends, top/low movers, and category contribution.

### 🧮 Editing & Controls
- **Inline Edits**: Update unit costs directly in the table with auto-recalculated averages.
- **Search & Filters**: SKU/item search, category filtering, and hash-based page navigation.
- **Manual Item Entry**: Auto-generated SKUs with configurable prefix/padding.
- **Typography & Layout**: Tailwind-driven spacing, cards, and headers for consistent UI hierarchy.
- **Preview Net Impact**: See unit/value effects before committing stocktake changes.

### 📤 Export & Share
- **Template Downloads**: Grab filled or blank Excel templates with required headers.
- **Workbook Export**: Output updated inventory plus history and summary sheets (.xlsx) client-side.
- **Audit Preservation**: Generated files include movement logs and valuation summaries for reviews.

## 🛠️ Tech Stack

- **Framework**: [React](https://react.dev/)
- **Build Tool**: [Vite](https://vite.dev/) (rolldown)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) via @tailwindcss/vite
- **Icons**: [lucide-react](https://lucide.dev/)
- **Excel**: [xlsx-js-style](https://www.npmjs.com/package/xlsx-js-style)
- **Utilities**: Custom cost-layering, formatting, and hash-routing helpers

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
├── hooks/                   # useInventory state machine and costing logic
├── pages/                   # Demo, Stocktake, History, and Stats views
├── utils/                   # Excel helpers, formatting, number parsing, classNames
├── constants.js             # Required columns, sheet names, defaults
├── App.jsx                  # Hash-based navigation and layout shell
└── main.jsx                 # Entry point
```

## 🎨 Customization Guide

- **Templates & Sheets**: Adjust required columns, sheet names, and default template rows in `src/constants.js`.
- **Excel Output**: Tweak headers, column widths, and summary rows in `src/utils/excel.js`.
- **Styling**: Update global fonts/themes in `src/index.css`; refine layout accents in `App.jsx` and page components.
- **Behavior**: Modify cost-layer rules or movement windows inside `useInventory.js` (in `src/hooks`).

## 📝 Development Notes

- **Security**: All parsing/exporting happens client-side; files never leave the browser. Supports .xlsx (Open XML) only.
- **Performance**: Large workbooks or long histories can increase client-side processing with xlsx-js-style.
- **Responsiveness**: UI adapts to mobile/tablet; wide tables scroll horizontally on smaller screens.
- **Static Hosting**: Hash-based routing works on static hosts. Update `base` in `vite.config.js` if the repo name changes for GitHub Pages.

---

To Cleaner Inventory! 📊
