import { forwardRef } from 'react'
import { classNames } from '../utils/classNames.js'

const VARIANTS = {
  primary:
    'bg-indigo-500 text-white shadow-sm hover:bg-indigo-600 active:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400',
  secondary:
    'bg-white text-indigo-600 border border-indigo-100 hover:border-indigo-300 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400',
  subtle:
    'bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400',
  ghost:
    'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400',
}

export const Button = forwardRef(
  (
    {
      variant = 'primary',
      className = '',
      children,
      isLoading = false,
      disabled,
      icon,
      iconPosition = 'left',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const renderChildren = () => {
      if (!icon) {
        return children
      }
      return (
        <span className="flex items-center gap-2">
          {iconPosition === 'left' && icon}
          <span>{children}</span>
          {iconPosition === 'right' && icon}
        </span>
      )
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classNames(
          'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
          VARIANTS[variant] || VARIANTS.primary,
          className,
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        <span className="flex items-center gap-2">
          {isLoading ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
              aria-hidden
            />
          ) : null}
          {renderChildren()}
        </span>
      </button>
    )
  },
)

Button.displayName = 'Button'
