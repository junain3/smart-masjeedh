import { redirect } from "next/navigation";

export default function CollectionsPendingRedirect() {
  redirect("/subscriptions/pending");
}
