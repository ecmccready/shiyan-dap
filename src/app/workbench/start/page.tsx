import { redirect } from "next/navigation";

export default function StartPage() {
  redirect("/workbench#guided-run");
}