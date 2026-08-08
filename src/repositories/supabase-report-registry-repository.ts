import { IReportRegistryRepository } from "./interfaces";
import { 
  IReportTemplate, 
  ITemplateParameter, 
  ITemplateSignatoryRequirement 
} from "../domain/models/interfaces";
import { 
  INITIAL_REPORT_TEMPLATES, 
  INITIAL_TEMPLATE_PARAMETERS, 
  INITIAL_TEMPLATE_SIGNATORY_REQUIREMENTS 
} from "../services/registry-seed-data";
import { supabase } from "../lib/supabase/client";

/**
 * Supabase Implementation of IReportRegistryRepository
 * Queries database tables with defensive fallback to authoritative seed specifications.
 */
export class SupabaseReportRegistryRepository implements IReportRegistryRepository {
  async getTemplateByCode(templateCode: string): Promise<IReportTemplate | null> {
    try {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("template_code", templateCode)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        const found = INITIAL_REPORT_TEMPLATES.find(
          (t) => t.templateCode === templateCode && t.isActive
        );
        return found || null;
      }

      return {
        id: data.id,
        templateCode: data.template_code,
        templateTitle: data.template_title,
        examinationFamily: data.examination_family,
        rendererFamily: data.renderer_family,
        colorPalette: data.color_palette,
        supportsRemarks: data.supports_remarks,
        defaultRemarks: data.default_remarks,
        requiresKitInfo: data.requires_kit_info,
        supportedDemographics: data.supported_demographics,
        conditionalRules: data.conditional_rules,
        isActive: data.is_active,
      };
    } catch {
      const found = INITIAL_REPORT_TEMPLATES.find(
        (t) => t.templateCode === templateCode && t.isActive
      );
      return found || null;
    }
  }

  async getParametersByTemplateCode(templateCode: string): Promise<ITemplateParameter[]> {
    try {
      const { data, error } = await supabase
        .from("template_parameters")
        .select("*")
        .eq("template_code", templateCode)
        .order("display_order", { ascending: true });

      if (error || !data || data.length === 0) {
        return INITIAL_TEMPLATE_PARAMETERS.filter((p) => p.templateCode === templateCode).sort(
          (a, b) => a.displayOrder - b.displayOrder
        );
      }

      return data.map((p: Record<string, unknown>) => ({
        id: String(p.id || ""),
        templateCode: String(p.template_code || ""),
        parameterCode: String(p.parameter_code || ""),
        parameterName: String(p.parameter_name || ""),
        inputType: p.input_type as ITemplateParameter["inputType"],
        unit: (p.unit as string) || null,
        defaultValue: (p.default_value as string) || null,
        options: (p.options as string[]) || null,
        referenceRule: (p.reference_rule as ITemplateParameter["referenceRule"]) || null,
        computedFormula: (p.computed_formula as ITemplateParameter["computedFormula"]) || null,
        isRequired: Boolean(p.is_required),
        isSelectable: Boolean(p.is_selectable),
        displayOrder: Number(p.display_order || 0),
      }));
    } catch {
      return INITIAL_TEMPLATE_PARAMETERS.filter((p) => p.templateCode === templateCode).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );
    }
  }

  async getSignatoryRequirementByTemplateCode(
    templateCode: string
  ): Promise<ITemplateSignatoryRequirement | null> {
    try {
      const { data, error } = await supabase
        .from("template_signatory_requirements")
        .select("*")
        .eq("template_code", templateCode)
        .single();

      if (error || !data) {
        const found = INITIAL_TEMPLATE_SIGNATORY_REQUIREMENTS.find(
          (req) => req.templateCode === templateCode
        );
        return found || null;
      }

      return {
        id: data.id,
        templateCode: data.template_code,
        requiredPathologistsCount: data.required_pathologists_count,
        requiredMedtechsCount: data.required_medtechs_count,
      };
    } catch {
      const found = INITIAL_TEMPLATE_SIGNATORY_REQUIREMENTS.find(
        (req) => req.templateCode === templateCode
      );
      return found || null;
    }
  }

  async getAllActiveTemplates(): Promise<IReportTemplate[]> {
    try {
      const { data, error } = await supabase
        .from("report_templates")
        .select("*")
        .eq("is_active", true);

      if (error || !data || data.length === 0) {
        return INITIAL_REPORT_TEMPLATES.filter((t) => t.isActive);
      }

      return data.map((dataItem: Record<string, unknown>) => ({
        id: String(dataItem.id || ""),
        templateCode: String(dataItem.template_code || ""),
        templateTitle: String(dataItem.template_title || ""),
        examinationFamily: dataItem.examination_family as IReportTemplate["examinationFamily"],
        rendererFamily: dataItem.renderer_family as IReportTemplate["rendererFamily"],
        colorPalette: String(dataItem.color_palette || "#093982"),
        supportsRemarks: Boolean(dataItem.supports_remarks),
        defaultRemarks: (dataItem.default_remarks as string) || null,
        requiresKitInfo: Boolean(dataItem.requires_kit_info),
        supportedDemographics: (dataItem.supported_demographics as Record<string, unknown>) || null,
        conditionalRules: (dataItem.conditional_rules as Record<string, unknown>[]) || null,
        isActive: Boolean(dataItem.is_active),
      }));
    } catch {
      return INITIAL_REPORT_TEMPLATES.filter((t) => t.isActive);
    }
  }
}
