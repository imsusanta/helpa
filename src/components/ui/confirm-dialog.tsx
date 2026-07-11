"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

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
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-500 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1 pr-6">
            <DialogTitle className="text-base font-bold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2 pt-2 border-t border-border/40 mt-4">
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
            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shrink-0 border border-transparent"
          >
            {loading ? "Deleting..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
