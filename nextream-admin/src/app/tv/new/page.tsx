import { redirect } from "next/navigation";

// The four-step create wizard is gone: a show is now created as a draft from a
// dialog on the list page and filled in from its workspace. Kept as a redirect
// so old links and bookmarks land somewhere useful instead of 404ing.
export default function NewTVShowRedirect() {
  redirect("/tv?create=1");
}
