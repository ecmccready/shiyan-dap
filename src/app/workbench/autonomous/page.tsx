import type { Metadata } from "next";
import AutonomousClient from "./AutonomousClient";

export const metadata: Metadata = {
  title: "Autonomous run | Aethel Node",
  description:
    "Run the bounded Level 4 control loop with safety checks, measured outcomes, and durable verified experience.",
};

export default function AutonomousPage() {
  return <AutonomousClient />;
}
