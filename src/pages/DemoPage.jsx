
import { ArrowRight, Download, UploadCloud } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { APP_PAGES } from '../constants.js'
import { triggerWorkbookDownload } from '../utils/excel.js'
import { formatDateTime } from '../utils/format.js'

const DEMO_STEPS = [
  'Download the template to see the required columns.',
  'Copy your existing stocktake into the template or tidy your sheet and export as .xlsx.',
  'Import the workbook below to load the current stock into the app.',
  'Head to Stocktake to capture new counts, then export the updated workbook.',
]

const UploadGuide = ({ isDragging }) => (
  <div
    className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed ${
      isDragging ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-300 bg-white/70 text-slate-500'
    } px-6 py-10 text-center transition`}
  >
    <UploadCloud aria-hidden className="h-10 w-10 text-indigo-500" />
    <div className="space-y-2">
      <p className="text-sm font-semibold uppercase tracking-[0.3em]">Upload workbook</p>
      <p className="text-sm leading-relaxed">
        Drag and drop your .xlsx file here, or select it from your computer. We will validate the columns before loading.
      </p>
    </div>
    <p className="text-xs text-slate-400">Supported: .xlsx (Excel Open XML)</p>
  </div>
)

export const DemoPage = ({
  loadFromFile,
  error,
  metadata,
  hasInventory,
  hasImported,
  generateTemplateBytes,
  generateBlankTemplateBytes,
  navigate,
}) => {
  const [statusMessage, setStatusMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const infoRows = useMemo(
    () => [
      {
        label: 'Source File',
        value: metadata?.sourceFileName || '',
      },
      {
        label: 'Imported',
        value: metadata?.lastImportedAt ? formatDateTime(metadata.lastImportedAt) : '',
      },
      {
        label: 'Last Stocktake',
        value: metadata?.lastStocktakeAt ? formatDateTime(metadata.lastStocktakeAt) : '',
      },
    ],
    [metadata],
  )

  const handleTemplateDownload = () => {
    const bytes = generateTemplateBytes()
    triggerWorkbookDownload(bytes, 'stocktake-template.xlsx')
  }

  const handleBlankTemplateDownload = () => {
    const bytes = generateBlankTemplateBytes()
    triggerWorkbookDownload(bytes, 'stocktake-template-blank.xlsx')
  }

  const handleFiles = async (files) => {
    const [file] = files || []
    if (!file) {
      return
    }
    try {
      setStatusMessage('Importing workbook...')
      await loadFromFile(file)
      setStatusMessage(`Imported ${file.name}. Stocktake pages are ready.`)
    } catch (err) {
      console.error(err)
      setStatusMessage('We could not read that workbook. Please check the columns and try again.')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = (event) => {
    handleFiles(event.target.files)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (event.dataTransfer?.files?.length) {
      handleFiles(event.dataTransfer.files)
    }
  }

  const readyMessage = hasInventory
    ? 'Inventory data is ready. Proceed to Stocktake to capture the latest movements.'
    : hasImported
      ? 'Workbook imported. Register items on the Stocktake page to begin tracking.'
      : 'Import a workbook to enable Stocktake, History, and Analytics views.'

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Welcome"
        title="Stocktake Inventory Tool"
        description="Import a validated workbook, prepare your stocktake, and export auditable results with full traceability."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={handleTemplateDownload}
              iconPosition="right"
              icon={<Download aria-hidden className="h-4 w-4" />}
            >
              Template workbook
            </Button>
            <Button
              variant="ghost"
              onClick={handleBlankTemplateDownload}
              iconPosition="right"
              icon={<Download aria-hidden className="h-4 w-4" />}
            >
              Blank workbook
            </Button>
          </div>
        }
      />

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <article className="space-y-6 rounded-3xl border border-slate-200 bg-white/70 p-8 shadow-sm backdrop-blur">
          <header className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
            <ul className="grid gap-3 text-sm text-slate-600">
              {DEMO_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-[3px] inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-600">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </header>

          <div
            className="relative"
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setIsDragging(false)
            }}
            onDrop={handleDrop}
          >
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Upload workbook"
              onClick={() => fileInputRef.current?.click()}
            />
            <UploadGuide isDragging={isDragging} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-3 text-sm">
            {statusMessage ? <p className="rounded-2xl bg-indigo-50 px-4 py-2 text-indigo-700">{statusMessage}</p> : null}
            {error ? (
              <p className="rounded-2xl bg-rose-50 px-4 py-2 text-rose-600">
                {error?.message || 'We could not parse that workbook. Please double-check the headers.'}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              We do all processing locally in your browser. Files never leave your device.
            </p>
          </div>
        </article>

        <aside className="space-y-6 rounded-3xl border border-slate-200 bg-white/60 p-8 shadow-sm backdrop-blur">
          <h2 className="text-lg font-semibold text-slate-900">Import status</h2>
          <dl className="space-y-4 text-sm text-slate-600">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-6">
                <dt className="uppercase tracking-[0.2em] text-xs text-slate-500">{row.label}</dt>
                <dd className="text-right text-sm text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{readyMessage}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => navigate?.(APP_PAGES[1].id)}
              disabled={!hasImported}
              iconPosition="right"
              icon={<ArrowRight aria-hidden className="h-4 w-4" />}
            >
              Go to Stocktake
            </Button>
          </div>
        </aside>
      </section>

    </div>
  )
}



