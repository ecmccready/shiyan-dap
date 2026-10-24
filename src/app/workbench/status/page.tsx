import type { Metadata } from "next";
import StatusDashboard from "./StatusDashboard";

export const metadata: Metadata = {
  title: "Level 4 status | Aethel Node",
  description:
    "Review durable guided-start counts, verified experience, recent runs, and measured outcomes.",
};

export default function StatusPage() {
  return <StatusDashboard />;
}
