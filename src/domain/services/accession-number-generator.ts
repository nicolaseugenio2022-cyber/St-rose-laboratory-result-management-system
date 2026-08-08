import { formatDateISO } from "../../lib/utils";

/**
 * Accession Number Generator
 * Generates standardized accession numbers in the format: SR-YYYYMMDD-XXXX
 */
export class AccessionNumberGenerator {
  static generate(sequenceNumber: number, dateStr?: string): string {
    const rawDate = dateStr ? dateStr.replace(/-/g, "") : formatDateISO().replace(/-/g, "");
    const paddedSeq = String(sequenceNumber).padStart(4, "0");
    return `SR-${rawDate}-${paddedSeq}`;
  }
}
