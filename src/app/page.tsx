import type { Metadata } from "next";
import WorkbenchHome from "./workbench/WorkbenchHome";

export const metadata: Metadata = {
  title: "Aethel Node | Workbench",
  description:
    "Start a durable run, review verified experience, inspect proof, and access Aethel Node workbench resources.",
};

export default function HomePage() {
  return <WorkbenchHome />;
}
