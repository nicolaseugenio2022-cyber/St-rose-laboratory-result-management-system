"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

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
        <div className="min-h-[400px] w-full flex items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-xl my-4 text-center">
          <div className="max-w-md space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {this.props.fallbackTitle || "System Operation Exception"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                An unexpected application error occurred. The operation was safely contained to prevent data corruption.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-left font-mono text-[11px] text-rose-800 break-words">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-primary text-white hover:bg-brand-hover transition-colors shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Operational View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
