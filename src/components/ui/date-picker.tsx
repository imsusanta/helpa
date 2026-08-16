'use client';

import * as React from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface DatePickerProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value'
> {
  value?: string; // YYYY-MM-DD
  onChange?: (date: string) => void;
  label?: string;
  presetOptions?: boolean;
}

export function DatePicker({
  value,
  onChange,
  label,
  presetOptions = true,
  className,
  ...props
}: DatePickerProps) {
  const handlePreset = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = d.toISOString().split('T')[0];
    if (onChange) onChange(dateStr);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-muted-foreground text-xs font-medium">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <CalendarIcon className="text-muted-foreground pointer-events-none absolute left-2.5 h-4 w-4" />
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          className="h-9 pr-8 pl-9 text-xs"
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange && onChange('')}
            className="text-muted-foreground hover:text-foreground absolute right-2.5"
            aria-label="Clear date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {presetOptions && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => handlePreset(0)}
            className="h-6 px-1.5 text-[10px]"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => handlePreset(1)}
            className="h-6 px-1.5 text-[10px]"
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => handlePreset(7)}
            className="h-6 px-1.5 text-[10px]"
          >
            In 7 Days
          </Button>
        </div>
      )}
    </div>
  );
}
