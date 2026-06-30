import { redirect } from "next/navigation";

export default function LegacyStaffEmployeePage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/staff/${params.id}`);
}
