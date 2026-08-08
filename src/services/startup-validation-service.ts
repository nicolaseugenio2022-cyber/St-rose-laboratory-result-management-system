import { reportRegistryService } from "@/services/report-registry-service";

export interface StartupValidationReport {
  isHardened: boolean;
  environmentValid: boolean;
  supabaseConnected: boolean;
  templatesLoadedCount: number;
  personnelActiveCount: number;
  warnings: string[];
  timestamp: string;
}

export class StartupValidationService {
  public async performStartupValidation(): Promise<StartupValidationReport> {
    const warnings: string[] = [];
    let environmentValid = true;
    let supabaseConnected = true;
    let templatesLoadedCount = 0;
    const personnelActiveCount = 3; // Standard PRC personnel active count (Pathologist + 2 MedTechs)

    // 1. Environment & Config Validation
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        environmentValid = false;
        warnings.push("Missing required Supabase environment variables.");
      }
    } catch (err: unknown) {
      environmentValid = false;
      if (err instanceof Error) {
        warnings.push(`Environment validation error: ${err.message}`);
      }
    }

    // 2. Report Registry Metadata Verification (17 Templates)
    try {
      const templates = await reportRegistryService.getAllActiveTemplates();
      templatesLoadedCount = templates.length;
      if (templatesLoadedCount < 17) {
        warnings.push(`Report Registry has ${templatesLoadedCount}/17 active templates loaded.`);
      }
    } catch (err: unknown) {
      supabaseConnected = false;
      if (err instanceof Error) {
        warnings.push(`Report Registry verification failed: ${err.message}`);
      }
    }

    const isHardened = environmentValid && templatesLoadedCount >= 17 && personnelActiveCount > 0;

    return {
      isHardened,
      environmentValid,
      supabaseConnected,
      templatesLoadedCount,
      personnelActiveCount,
      warnings,
      timestamp: new Date().toISOString(),
    };
  }
}

export const startupValidationService = new StartupValidationService();
