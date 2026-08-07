import React from "react";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import { NavigationMenu } from "./NavigationMenu";
import { cn } from "@/utils/cn";

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden animate-in fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-brand-border bg-brand-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0 shadow-md lg:shadow-none" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-brand-border">
          <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-brand-primary-foreground shadow-xs group-hover:bg-brand-primary-hover transition-colors">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="block font-bold text-brand-text text-sm leading-tight">St. Rose</span>
              <span className="block text-[11px] font-medium text-brand-text-muted">Diagnostic Laboratory</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-brand-text-subtle hover:bg-brand-surface-hover hover:text-brand-text lg:hidden"
            aria-label="Close Navigation Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Navigation Menu */}
        <div className="flex-1 overflow-y-auto p-3">
          <NavigationMenu onNavigate={onClose} />
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-brand-border bg-slate-50/50">
          <div className="rounded-lg border border-brand-border bg-brand-surface p-3 shadow-xs">
            <p className="text-xs font-semibold text-brand-text">Result Management System</p>
            <p className="text-[11px] text-brand-text-muted mt-0.5">Version 1.0.0 — Baseline</p>
          </div>
        </div>
      </aside>
    </>
  );
}
