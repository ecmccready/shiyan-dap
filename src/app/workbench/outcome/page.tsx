import type { Metadata } from "next";
import OutcomeClient from "./OutcomeClient";

export const metadata: Metadata = {
  title: "Declare outcome | Aethel Node",
  description:
    "Set a measurable goal for a bounded Aethel Node run with safety and budget checks.",
};

export default function OutcomePage() {
  return <OutcomeClient />;
}
