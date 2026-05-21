import { getTenantContext } from "@/lib/tenant";

export async function getPdfMasjidName(supabase: any, masjidId?: string | null) {
  let resolvedMasjidId = masjidId || null;

  try {
    if (!resolvedMasjidId) {
      const ctx = await getTenantContext();
      resolvedMasjidId = ctx?.masjidId || null;
    }

    if (!resolvedMasjidId) return "Masjid";

    const { data } = await supabase
      .from("masjids")
      .select("masjid_name")
      .eq("id", resolvedMasjidId)
      .maybeSingle();

    return data?.masjid_name || "Masjid";
  } catch (error) {
    console.error("Failed to load Masjeedh name for PDF:", error);
    return "Masjid";
  }
}

export function escapePdfHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
