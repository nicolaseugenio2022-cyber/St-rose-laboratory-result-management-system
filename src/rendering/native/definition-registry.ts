import type { NativeReportDefinition } from "./types";
import { cbcNativeDefinition } from "./definitions/cbc.definition";

const nativeDefinitionRegistry: ReadonlyMap<string, NativeReportDefinition> = new Map([
  [cbcNativeDefinition.templateCode, cbcNativeDefinition],
]);

export function getNativeReportDefinition(templateCode: string): NativeReportDefinition | null {
  return nativeDefinitionRegistry.get(templateCode) || null;
}

export function getNativeReportDefinitionCodes(): string[] {
  return [...nativeDefinitionRegistry.keys()];
}

