import type * as React from 'react';
import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> & {
  onCheckedChange?: (checked: boolean) => void;
};

function Checkbox({ className, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
      className={cn(
        'border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 size-4 shrink-0 rounded border shadow-none transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
