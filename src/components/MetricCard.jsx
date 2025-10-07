import { classNames } from '../utils/classNames.js'

export const MetricCard = ({
  label,
  value,
  delta = null,
  deltaLabel = '',
  positive = null,
  icon = null,
}) => {
  const deltaColour = positive === null ? 'text-slate-500' : positive ? 'text-emerald-600' : 'text-rose-500'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {delta ? (
        <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
          <span
            className={classNames(
              deltaColour,
              'rounded-full bg-slate-100 px-2 py-1',
            )}
          >
            {delta}
          </span>
          {deltaLabel ? <span className="text-slate-500">{deltaLabel}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
