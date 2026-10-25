import type { Metadata } from "next";
import EmergenceClient from "./EmergenceClient";

export const metadata: Metadata = {
  title: "Emergence | Aethel Node",
  description: "Music and creative workbench for Aethel Node.",
};

export default function EmergencePage() {
  return <EmergenceClient />;
}
