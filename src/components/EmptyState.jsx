export const EmptyState = ({ title, message, action = null }) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-slate-500">
    <div className="max-w-md space-y-3">
      <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
      {message ? <p className="text-sm leading-relaxed">{message}</p> : null}
    </div>
    {action ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
  </div>
)
