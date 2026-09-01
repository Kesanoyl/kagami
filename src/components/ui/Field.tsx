import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const BASE =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-[border-color,background-color] duration-200 hover:border-line-strong focus:border-brand focus:outline-none';

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-medium text-ink-dim">{children}</span>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, helper, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      {/* h-11 keeps mobile taps comfortable and stops iOS from zooming in. */}
      <input ref={ref} id={inputId} className={cn(BASE, 'h-11', className)} {...props} />
      {helper && <p className="mt-1.5 text-[11px] text-ink-faint">{helper}</p>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, helper, id, ...props },
  ref,
) {
  const generatedId = useId();
  const areaId = id ?? generatedId;
  return (
    <div>
      {label && <Label htmlFor={areaId}>{label}</Label>}
      <textarea
        ref={ref}
        id={areaId}
        className={cn(BASE, 'scroll-slim resize-y py-3 leading-relaxed', className)}
        {...props}
      />
      {helper && <p className="mt-1.5 text-[11px] text-ink-faint">{helper}</p>}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, label, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div>
      {label && <Label htmlFor={selectId}>{label}</Label>}
      <select
        ref={ref}
        id={selectId}
        className={cn(BASE, 'h-11 cursor-pointer appearance-none pr-9', className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b6b7b' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  );
});

/** Small on/off row used throughout Settings. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2.5 text-left transition-colors duration-200"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-dim">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-brand' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out-soft)]',
            checked && 'translate-x-5',
          )}
        />
      </span>
    </button>
  );
}
