'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1 pr-6">
            <DialogTitle className="text-foreground text-base font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="border-border/40 mt-4 flex justify-end gap-2 border-t pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="cursor-pointer text-xs font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="shrink-0 cursor-pointer border border-transparent bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
          >
            {loading ? 'Deleting...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
