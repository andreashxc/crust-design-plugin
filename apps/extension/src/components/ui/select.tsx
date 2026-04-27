import { ChevronDown } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div data-slot="select-wrapper" className="relative w-full">
      <select
        data-slot="select"
        className={cn(
          'border-transparent bg-input ring-offset-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-9 w-full appearance-none items-center rounded-lg border px-3 py-1 pr-8 text-sm shadow-none transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
    </div>
  );
}

function SelectOption(props: React.ComponentProps<'option'>) {
  return <option data-slot="select-option" {...props} />;
}

export { Select, SelectOption };
