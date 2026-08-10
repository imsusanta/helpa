'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  onLogin: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Dashboard uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-background flex h-screen w-full flex-col items-center justify-center p-6 text-center">
          <div className="bg-destructive/10 text-destructive mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-foreground text-2xl font-bold">
            Something went wrong
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm">
            {this.state.error?.message ||
              'An unexpected error occurred while loading the dashboard.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button
              onClick={() => {
                if (typeof globalThis.location !== 'undefined') {
                  globalThis.location.reload();
                }
              }}
              className="gap-2 font-semibold"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                this.props.onLogin();
              }}
            >
              Return to Login
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
