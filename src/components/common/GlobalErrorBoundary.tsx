"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("GlobalErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="my-4 flex min-h-[400px] w-full items-center justify-center rounded-lg border border-brand-border bg-brand-structural p-6 text-center">
          <div className="max-w-md space-y-4">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-brand-danger-border bg-brand-danger-bg text-brand-danger">
              <AlertOctagon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-brand-navy">
                {this.props.fallbackTitle || "System Operation Exception"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-brand-text-muted">
                An unexpected application error occurred. The operation was safely contained to prevent data corruption.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="break-words rounded-md border border-brand-danger-border bg-brand-danger-bg p-3 text-left font-mono text-[11px] text-brand-danger">
                {this.state.error.message}
              </div>
            )}
            <Button type="button" size="sm" onClick={this.handleReset}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reload Operational View
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
