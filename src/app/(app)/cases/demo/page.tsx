import { redirect } from "next/navigation";

// L'ancienne démo pointe désormais vers le dossier holding dans le workspace.
export default function DemoRedirect() {
  redirect("/cases/demo-holding/graphe");
}
