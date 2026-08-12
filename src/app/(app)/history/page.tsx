import React from "react";
import { SessionHistoryView } from "@/features/history/components/SessionHistoryView";

export const runtime = "nodejs";

export default function HistoryPage() {
  return <SessionHistoryView />;
}
