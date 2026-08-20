import React, { useState, useRef, useEffect } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { Layers, X, MoreVertical, Trash2, XCircle } from "lucide-react";

export interface SelectedReportsPanelProps {
  selectedSpecs: HydratedTemplateSpec[];
  activeTemplateCode: string | null;
  onSelectActiveTemplate: (templateCode: string) => void;
  onRemoveTemplate: (templateCode: string) => void;
  onCloseOtherTemplates: (keepTemplateCode: string) => void;
  onClearAllTemplates: () => void;
  isDirty?: boolean;
}

export function SelectedReportsPanel({
  selectedSpecs,
  activeTemplateCode,
  onSelectActiveTemplate,
  onRemoveTemplate,
  onCloseOtherTemplates,
  onClearAllTemplates,
  isDirty = false,
}: SelectedReportsPanelProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedSpecs.length === 0) {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 text-center">
        <p className="text-xs font-bold text-amber-800">No examinations selected.</p>
        <p className="text-xs text-amber-600 mt-1">
          Choose one or more laboratory examinations from the catalog to begin encoding laboratory results.
        </p>
      </div>
    );
  }

  const handleClearAllWithConfirm = () => {
    setIsMenuOpen(false);
    if (window.confirm("Are you sure you want to remove all laboratory examinations from this visit session?")) {
      onClearAllTemplates();
    }
  };

  return (
    <div>
      {/* Header Info Bar & Actions Dropdown Menu */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Layers aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Active Examination Tabs ({selectedSpecs.length})
          </span>
          {isDirty && (
            <span
              className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse"
              title="Unsaved changes in active session"
            />
          )}
        </div>

        {/* Examination Actions Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-sm"
            aria-label="Examination Actions Menu"
          >
            <span>Actions</span>
            <MoreVertical className="h-3.5 w-3.5 text-slate-500" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (activeTemplateCode) {
                    onRemoveTemplate(activeTemplateCode);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              >
                <X className="h-3.5 w-3.5 text-slate-500" />
                Close Current Examination
              </button>

              {selectedSpecs.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (activeTemplateCode) {
                      onCloseOtherTemplates(activeTemplateCode);
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <XCircle className="h-3.5 w-3.5 text-slate-500" />
                  Close Other Examinations
                </button>
              )}

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={handleClearAllWithConfirm}
                className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                Clear All Examinations...
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Browser-style Tab Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200">
        {selectedSpecs.map((spec) => {
          const code = spec.template.templateCode;
          const isActive = activeTemplateCode === code;

          return (
            <div
              key={code}
              onClick={() => onSelectActiveTemplate(code)}
              title={`${spec.template.templateTitle} (${spec.template.examinationFamily})`}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs transition-all cursor-pointer select-none ${
                isActive
                  ? "bg-white border-t-2 border-t-brand-primary border-x border-b-white font-bold text-brand-primary shadow-sm -mb-px"
                  : "bg-slate-100/90 border border-slate-200/80 text-slate-600 hover:bg-slate-200/70 font-medium"
              }`}
            >
              <span className="truncate max-w-[180px] xl:max-w-[260px]">{spec.template.templateTitle}</span>

              {/* Renderer Badge */}
              <span
                className={`text-[9px] font-mono px-1 py-0.5 rounded ${
                  isActive ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-slate-200/60 text-slate-500"
                }`}
              >
                {spec.template.rendererFamily}
              </span>

              {/* Close Tab (X) Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTemplate(code);
                }}
                className={`p-0.5 rounded hover:bg-slate-200 transition-colors ml-1 ${
                  isActive ? "text-slate-400 hover:text-red-600" : "text-slate-400 hover:text-red-600"
                }`}
                title="Remove examination tab"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
