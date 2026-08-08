import { 
  IReportTemplate, 
  ITemplateParameter, 
  ITemplateSignatoryRequirement,
  IAutoSuggestion 
} from "../../domain/models/interfaces";
import { 
  ReferenceRuleSpec, 
  EvaluationOutcome 
} from "../../domain/types";

export interface HydratedTemplateSpec {
  template: IReportTemplate;
  parameters: ITemplateParameter[];
  signatoryRequirement: ITemplateSignatoryRequirement;
}

export interface IReportRegistryService {
  getTemplateByCode(templateCode: string): Promise<HydratedTemplateSpec | null>;
  getAllActiveTemplates(): Promise<IReportTemplate[]>;
  getAllTemplatesByFamily(family: string): Promise<IReportTemplate[]>;
}

export interface IReferenceEvaluationService {
  evaluateResult(resultValue: string, rule?: ReferenceRuleSpec | null): EvaluationOutcome;
}

export interface IAutoSuggestionLearningService {
  learnSuggestionsFromSessionDemographics(demographics: {
    requestingPhysician: string;
    referrerName?: string;
    companyName?: string;
  }): Promise<void>;
  getSuggestionsByCategory(category: "physician" | "referrer" | "company", query?: string): Promise<IAutoSuggestion[]>;
}
