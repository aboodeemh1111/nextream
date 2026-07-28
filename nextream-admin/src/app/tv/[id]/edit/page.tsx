import { redirect } from "next/navigation";

// The separate edit page was a near-duplicate of the detail page — the same
// season and episode management copy-pasted, already diverging. Both are now
// the one workspace at /tv/[id].
export default async function EditShowRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tv/${id}`);
}
