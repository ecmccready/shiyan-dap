import { redirect } from "next/navigation";

export default function LegacyDiagnosticsPage() {
  redirect("/workbench/diagnostic/reference");
}
