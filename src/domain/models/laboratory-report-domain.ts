import { 
  ILaboratoryReport, 
  ILaboratoryResult,
  IReportEncodingData,
} from "./interfaces";
import { 
  RendererFamily, 
  ReagentKitInfo, 
  SignatorySnapshot, 
  EvaluationOutcome, 
  ReferenceRuleSpec 
} from "../types";
import { DomainInvariantError } from "../../lib/errors";

export interface LaboratoryResultDomainProps extends ILaboratoryResult {
  isSelected?: boolean;
}

export class LaboratoryResultDomain implements ILaboratoryResult {
  public readonly id: string;
  public readonly reportId: string;
  public readonly parameterCode: string;
  public readonly parameterName: string;
  public readonly resultValue: string;
  public readonly rawResultValue?: string | null;
  public readonly formattedResultValue?: string | null;
  public readonly unit?: string | null;
  public readonly evaluationOutcome: EvaluationOutcome;
  public readonly referenceRuleSnapshot?: ReferenceRuleSpec | null;
  public readonly computationMetadata?: Record<string, unknown> | null;
  public readonly displayOrder: number;
  public readonly isSelected: boolean;

  constructor(props: LaboratoryResultDomainProps) {
    this.id = props.id;
    this.reportId = props.reportId;
    this.parameterCode = props.parameterCode;
    this.parameterName = props.parameterName;
    this.resultValue = props.resultValue;
    this.rawResultValue = props.rawResultValue;
    this.formattedResultValue = props.formattedResultValue;
    this.unit = props.unit;
    this.evaluationOutcome = props.evaluationOutcome;
    this.referenceRuleSnapshot = props.referenceRuleSnapshot;
    this.computationMetadata = props.computationMetadata;
    this.displayOrder = props.displayOrder;
    this.isSelected = props.isSelected ?? true;
  }
}

export class LaboratoryReportDomain implements ILaboratoryReport {
  public readonly id: string;
  public readonly sessionId: string;
  public readonly templateCode: string;
  public readonly templateTitle: string;
  public readonly rendererFamily: RendererFamily;
  public readonly reagentKitInfo?: ReagentKitInfo | null;
  public readonly remarks?: string | null;
  public readonly encodingData?: IReportEncodingData;
  public results: LaboratoryResultDomain[];
  public signatories: SignatorySnapshot[];

  constructor(props: {
    id: string;
    sessionId: string;
    templateCode: string;
    templateTitle: string;
    rendererFamily: RendererFamily;
    reagentKitInfo?: ReagentKitInfo | null;
    remarks?: string | null;
    encodingData?: IReportEncodingData;
    results: LaboratoryResultDomainProps[];
    signatories: SignatorySnapshot[];
  }) {
    this.id = props.id;
    this.sessionId = props.sessionId;
    this.templateCode = props.templateCode;
    this.templateTitle = props.templateTitle;
    this.rendererFamily = props.rendererFamily;
    this.reagentKitInfo = props.reagentKitInfo;
    this.remarks = props.remarks;
    this.encodingData = props.encodingData
      ? {
          ...props.encodingData,
          additionalFields: { ...(props.encodingData.additionalFields || {}) },
          repeatableFindings: Object.fromEntries(
            Object.entries(props.encodingData.repeatableFindings || {}).map(([category, findings]) => [
              category,
              findings.map((finding) => ({ ...finding })),
            ])
          ),
        }
      : undefined;
    this.results = props.results.map((r) => new LaboratoryResultDomain(r));
    this.signatories = props.signatories;
  }

  /**
   * Removes deselected parameters (isSelected = false) prior to session completion and persistence.
   */
  public scrubDeselectedResults(): void {
    this.results = this.results.filter((r) => r.isSelected);
  }

  /**
   * Validates that signatory counts satisfy template requirements.
   */
  public validateSignatories(requiredPathologists: number, requiredMedtechs: number): void {
    const pathologistsCount = this.signatories.filter((s) => s.role === "Pathologist").length;
    const medtechsCount = this.signatories.filter((s) => s.role === "MedicalTechnologist").length;

    if (pathologistsCount < requiredPathologists) {
      throw new DomainInvariantError(
        `Report '${this.templateTitle}' requires at least ${requiredPathologists} Pathologist(s), but has ${pathologistsCount}.`
      );
    }

    if (medtechsCount < requiredMedtechs) {
      throw new DomainInvariantError(
        `Report '${this.templateTitle}' requires at least ${requiredMedtechs} Medical Technologist(s), but has ${medtechsCount}.`
      );
    }
  }
}
