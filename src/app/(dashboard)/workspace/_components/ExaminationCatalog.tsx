import React, { useState, useMemo, useRef, useId } from "react";
import { HydratedTemplateSpec } from "@/services/interfaces";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Search, SearchX, ChevronDown, ChevronRight, Check, Plus, FlaskConical, Stethoscope, Microscope, ShieldCheck, HeartPulse, X, PanelLeftClose } from "lucide-react";
import { PanelIcon } from "./PanelIcon";

export interface ExaminationCatalogProps {
  allTemplates: HydratedTemplateSpec[];
  selectedTemplateCodes: string[];
  activeTemplateCode: string | null;
  onSelectTemplate: (templateCode: string) => void;
  onToggleTemplateSelection: (templateCode: string) => void;
  /**
   * Desktop rail collapse. Optional by design: the mobile drawer renders this catalog without it
   * and therefore shows no collapse control, so the drawer keeps exactly the UX-10B1 behaviour.
   */
  onCollapse?: () => void;
  /** Id of the region the collapse control governs, so its aria-controls matches the rail control. */
  catalogRegionId?: string;
  /** Lets the Workspace move focus onto this control after an expand. */
  collapseControlRef?: React.Ref<HTMLButtonElement>;
  /**
   * Heading level for the panel title, because the catalog is rendered in two document contexts.
   *
   * As the full-width primary task of a session with nothing selected it is the first section
   * under the Workspace `<h1>`, so it is an `<h2>`. Inside the drawer it sits beside the report
   * panel's own `<h2>`, so it stays an `<h3>`. Defaults to 3, which is what every existing caller
   * already renders.
   */
  headingLevel?: 2 | 3;
}

/**
 * One monochrome family glyph. The icons differentiate by shape, not by hue: a five-colour
 * family palette competed with the only colours in this panel that carry meaning, which are
 * the active and selected row states.
 */
const FAMILY_ICON_CLASS = "h-4 w-4 shrink-0 text-brand-text-muted";

const FAMILY_ICONS: Record<string, React.ReactNode> = {
  Hematology: <FlaskConical aria-hidden="true" className={FAMILY_ICON_CLASS} />,
  "Clinical Chemistry": <Stethoscope aria-hidden="true" className={FAMILY_ICON_CLASS} />,
  "Clinical Microscopy": <Microscope aria-hidden="true" className={FAMILY_ICON_CLASS} />,
  "Serology & Immunology": <ShieldCheck aria-hidden="true" className={FAMILY_ICON_CLASS} />,
  "Blood Bank": <HeartPulse aria-hidden="true" className={FAMILY_ICON_CLASS} />,
};

const ALIASES: Record<string, string[]> = {
  CBC: ["blood", "complete blood count", "hema", "hematology", "platelet", "wbc", "rbc"],
  ESR: ["blood", "sedimentation", "erythrocyte", "hema"],
  CT_BT: ["blood", "clotting", "bleeding", "time", "hema"],
  BLOOD_TYPING: ["blood", "group", "rh", "type", "bank"],
  CHEM_8: ["chem", "chemistry", "panel", "fbs", "sugar"],
  CHEM_10: ["chem", "chemistry", "panel", "lipid", "ldl", "hdl"],
  HDL_LDL: ["chem", "lipid", "cholesterol", "triglycerides"],
  RBS: ["chem", "sugar", "glucose", "random"],
  HBA1C: ["chem", "diabetes", "glycated", "a1c"],
  OGTT: ["chem", "glucose", "tolerance", "sugar"],
  URINALYSIS: ["urine", "microscopy", "urinalysis", "uti"],
  FECALYSIS: ["stool", "feces", "microscopy", "parasite"],
  HBSAG: ["serology", "hep", "hepatitis", "screening"],
  RPR: ["serology", "syphilis", "vdrl"],
  PREG_TEST: ["serology", "urine", "pregnancy", "hcg"],
  DENGUE_DUO: ["serology", "dengue", "ns1", "igg", "igm"],
  HIV_RESULT: ["serology", "hiv", "aids", "certificate"],
};

export function ExaminationCatalog({
  allTemplates,
  selectedTemplateCodes,
  activeTemplateCode,
  onSelectTemplate,
  onToggleTemplateSelection,
  onCollapse,
  catalogRegionId,
  collapseControlRef,
  headingLevel = 3,
}: ExaminationCatalogProps) {
  const Heading = (headingLevel === 2 ? "h2" : "h3") as "h2" | "h3";
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFamilies, setCollapsedFamilies] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Two catalogs can be in the DOM at once - the CSS-hidden desktop instance and the mobile
  // drawer instance - so every id this component mints has to be scoped to its own instance or
  // the label and aria-controls references resolve to the wrong catalog.
  const instanceId = useId();
  const searchInputId = `catalog-search-${instanceId}`;
  const isSearchActive = searchQuery.trim().length > 0;

  const groupedTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const groups: Record<string, HydratedTemplateSpec[]> = {
      Hematology: [],
      "Clinical Chemistry": [],
      "Clinical Microscopy": [],
      "Serology & Immunology": [],
      "Blood Bank": [],
    };

    allTemplates.forEach((spec) => {
      const family = spec.template.examinationFamily || "Clinical Chemistry";
      const code = spec.template.templateCode;
      const aliases = ALIASES[code] || [];

      // Renderer family stays in the predicate even though the row no longer prints it: it remains
      // a searchable term, which is the only thing the badge's removal must not cost.
      const matchesSearch =
        query === "" ||
        code.toLowerCase().includes(query) ||
        spec.template.templateTitle.toLowerCase().includes(query) ||
        spec.template.examinationFamily.toLowerCase().includes(query) ||
        spec.template.rendererFamily.toLowerCase().includes(query) ||
        aliases.some((alias) => alias.toLowerCase().includes(query));

      if (matchesSearch) {
        if (!groups[family]) {
          groups[family] = [];
        }
        groups[family].push(spec);
      }
    });

    return groups;
  }, [allTemplates, searchQuery]);

  const toggleFamilyCollapse = (family: string) => {
    // A search forces every matching family open, so a toggle while searching could only record a
    // preference the operator never sees applied - and it would then surface as an unexplained
    // change the moment they clear the query. The control is disabled during a search; this guard
    // makes the invariant hold regardless of how the control is rendered.
    if (isSearchActive) return;
    setCollapsedFamilies((prev) => ({ ...prev, [family]: !prev[family] }));
  };

  const totalMatchingTemplates = useMemo(() => {
    return Object.values(groupedTemplates).reduce((acc, list) => acc + list.length, 0);
  }, [groupedTemplates]);

  const selectedCount = selectedTemplateCodes.length;

  // Clearing returns focus to the field the control belongs to. The clear button unmounts the
  // moment the query empties, so without this the operator's focus would fall back to the body.
  const handleClearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  // A white panel: the header band and every family header are structural, the list itself is
  // the working surface, and the three row states carry the only colour in the panel.
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-brand-border bg-brand-card shadow-low">
      {/* Header and search stay fixed; only the results list below scrolls. */}
      <div className="shrink-0 border-b border-brand-border bg-brand-structural px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <PanelIcon icon={FlaskConical} />
          <Heading className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight tracking-tight text-brand-navy">
            Examination catalog
          </Heading>
          {onCollapse && (
            <button
              type="button"
              ref={collapseControlRef}
              onClick={onCollapse}
              aria-label="Collapse examination catalog"
              aria-expanded
              aria-controls={catalogRegionId}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-brand-text-muted transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-structural-hover hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
            >
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* One quiet operational line rather than a row of count badges. */}
        <p className="mt-1 truncate text-xs text-brand-text-muted">
          {isSearchActive
            ? `${totalMatchingTemplates} matching · ${selectedCount} selected`
            : `${allTemplates.length} examinations · ${selectedCount} selected`}
        </p>

        <div className="relative mt-2">
          <label htmlFor={searchInputId} className="sr-only">
            Search examinations
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-brand-text-subtle" />
          <Input
            id={searchInputId}
            ref={searchInputRef}
            // A stable hook for the Workspace to move focus here when the catalog becomes the
            // task - entering the zero-selected state, or opening the drawer. Querying for the
            // first `input` instead would silently retarget the moment the header gains another.
            data-catalog-search
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Name, code, or keyword"
            className="pl-8 pr-9"
          />
          {isSearchActive && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-brand-text-subtle transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 hover:bg-brand-structural-hover hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* The list owns a continuous white sheet rather than letting the shell tint show between
          and below the rows. That is what stopped this reading as one grey slab: the rows were
          already white, but every gap and all the empty space under a short or collapsed list was
          not, so the tint - not the content - was the dominant surface.

          scroll-pt clears the sticky family header, so a row reached by keyboard is never parked
          underneath it (WCAG 2.2 Focus Not Obscured). */}
      <div className="flex-1 overflow-y-auto bg-brand-card scroll-pt-10">
        {totalMatchingTemplates === 0 ? (
          allTemplates.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No examinations available"
              description="No active examination templates are published in the registry."
              className="rounded-none border-0"
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No examinations match"
              description={`Nothing in the catalog matches “${searchQuery.trim()}”.`}
              className="rounded-none border-0"
              action={
                <Button type="button" variant="outline" size="sm" onClick={handleClearSearch}>
                  Clear search
                </Button>
              }
            />
          )
        ) : (
          Object.entries(groupedTemplates).map(([family, specs]) => {
            if (specs.length === 0) return null;
            // A family the operator collapsed must not swallow its own search matches. The
            // operator preference is read, never written, while a search is active, so clearing
            // the query restores exactly the collapsed/expanded arrangement they had before.
            const isCollapsedByOperator = Boolean(collapsedFamilies[family]);
            const isCollapsed = isSearchActive ? false : isCollapsedByOperator;
            const contentId = `catalog-family-${instanceId}-${family.replace(/\W+/g, "-").toLowerCase()}`;
            const selectedInFamily = specs.filter((s) => selectedTemplateCodes.includes(s.template.templateCode)).length;
            const isAllSelected = selectedInFamily === specs.length && specs.length > 0;

            return (
              // -mt-px on the first family lets its top rule sit on the header band's bottom
              // rule instead of doubling it.
              <div key={family} className="first:-mt-px">
                {/* Family disclosure: a sticky structural band with an eyebrow label, so a section
                    header cannot be mistaken for a selectable row. */}
                <button
                  type="button"
                  onClick={() => toggleFamilyCollapse(family)}
                  disabled={isSearchActive}
                  aria-expanded={!isCollapsed}
                  aria-controls={contentId}
                  title={isSearchActive ? "Expanded while a search is active" : undefined}
                  className="sticky top-0 z-10 flex min-h-9 w-full items-center gap-2 border-y border-brand-border bg-brand-structural px-3 text-left transition-colors duration-150 hover:bg-brand-structural-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring disabled:cursor-default disabled:hover:bg-brand-structural"
                >
                  <span className="flex shrink-0 items-center justify-center">
                    {FAMILY_ICONS[family] || <FlaskConical aria-hidden="true" className="h-4 w-4 text-brand-text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-text-muted">
                    {family}
                  </span>
                  <Badge variant={isAllSelected ? "success" : "neutral"} size="sm" className="font-mono tabular-nums">
                    {`${selectedInFamily}/${specs.length}`}
                  </Badge>
                  {isCollapsed ? (
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-text-subtle" />
                  ) : (
                    <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-text-subtle" />
                  )}
                </button>

                {/* Always rendered, hidden by CSS when collapsed, so aria-controls always resolves
                    to a real element. display:none also keeps hidden rows out of the Tab order. */}
                <div id={contentId} className={cn("divide-y divide-brand-border-subtle", isCollapsed && "hidden")}>
                  {specs.map((spec) => {
                    const code = spec.template.templateCode;
                    const isSelected = selectedTemplateCodes.includes(code);
                    const isActive = activeTemplateCode === code;
                    const displayTitle = spec.template.catalogTitle || spec.template.templateTitle;

                    return (
                      // Three states, each carrying a text cue so none of them depends on colour:
                      // active shows "Open" on the stronger selection fill, selected-inactive shows
                      // "Added" on the brand tint, unselected shows "Add" on white. Both selected
                      // states carry the teal rail and a navy label.
                      <div
                        key={code}
                        className={cn(
                          "group relative flex min-h-10 items-center gap-1.5 border-l-2 pr-1.5 transition-colors",
                          isActive
                            ? "border-l-brand-primary bg-brand-sidebar-active"
                            : isSelected
                              ? "border-l-brand-primary bg-brand-tint hover:bg-brand-sidebar-active"
                              : "border-l-transparent bg-brand-card hover:bg-brand-surface-hover"
                        )}
                      >
                        <button
                          type="button"
                          aria-current={isActive ? "true" : undefined}
                          onClick={() => {
                            if (!isSelected) {
                              onToggleTemplateSelection(code);
                            }
                            onSelectTemplate(code);
                          }}
                          className="min-w-0 flex-1 cursor-pointer rounded-sm px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus-ring"
                        >
                          <span
                            className={cn(
                              "block truncate text-[13px] leading-tight",
                              isActive || isSelected ? "font-semibold text-brand-navy" : "font-medium text-brand-text"
                            )}
                            title={spec.template.templateTitle}
                          >
                            {displayTitle}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 leading-tight">
                            <span className="min-w-0 truncate font-mono text-xs text-brand-text-muted">{code}</span>
                            {isActive && (
                              <span className="shrink-0 rounded-sm bg-brand-primary px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-primary-foreground">
                                Open
                              </span>
                            )}
                          </span>
                        </button>

                        {/* Sibling of the activation button, never nested, and deliberately outside
                            the Tab order: selection and activation are separate states. */}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleTemplateSelection(code);
                          }}
                          className={cn(
                            "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus-ring",
                            isSelected
                              ? "border-transparent bg-transparent text-brand-primary hover:border-brand-border hover:bg-brand-surface"
                              : "border-brand-border bg-brand-surface text-brand-text hover:border-brand-primary hover:bg-brand-tint hover:text-brand-primary"
                          )}
                          // The accessible name contains the visible word, so the two never disagree
                          // (WCAG 2.5.3), and it still states the action the control performs.
                          title={isSelected ? `Added. Remove ${displayTitle}` : `Add ${displayTitle}`}
                          aria-label={isSelected ? `Added. Remove ${displayTitle}` : `Add ${displayTitle}`}
                        >
                          {isSelected ? (
                            <Check aria-hidden="true" className="h-3.5 w-3.5 stroke-[2.5]" />
                          ) : (
                            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                          )}
                          {isSelected ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
