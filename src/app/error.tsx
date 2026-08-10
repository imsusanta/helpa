'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Uncaught Error:', error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen w-full flex-col items-center justify-center p-6 text-center">
      <div className="bg-destructive/10 text-destructive mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-foreground text-2xl font-bold">
        Application Error Occurred
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {error.message ||
          'An unexpected error occurred. Please try reloading the page.'}
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} className="gap-2 font-semibold">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = '/login';
          }}
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
}
