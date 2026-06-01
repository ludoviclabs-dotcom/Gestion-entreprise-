import { redirect } from "next/navigation";

export default async function CaseIndexPage(props: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await props.params;
  redirect(`/cases/${caseId}/graphe`);
}
