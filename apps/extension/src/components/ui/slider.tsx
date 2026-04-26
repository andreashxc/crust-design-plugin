import type * as React from 'react';
import { cn } from '@/lib/utils';

type SliderProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'defaultValue' | 'onChange'
> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
};

function Slider({ className, value, defaultValue, onValueChange, ...props }: SliderProps) {
  return (
    <input
      type="range"
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => onValueChange?.(event.currentTarget.valueAsNumber)}
      className={cn(
        'accent-primary h-5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-ring rounded-md focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export { Slider };
