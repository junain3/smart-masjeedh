/** Commission from collection amount and profile percent */
export function calcCommission(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(percent) || percent <= 0) return 0;
  return Math.round((amount * percent) / 100 * 100) / 100;
}

export function isAccountSubscriptionTransaction(tx: {
  type?: string;
  category?: string;
}): boolean {
  const cat = (tx.category || "").trim().toLowerCase();
  return cat === "subscription" || tx.type === "subscription";
}

export function buildDirectSubscriptionDescription(
  familyCode: string,
  headName: string,
  userNote?: string
): string {
  const base = `சந்தா வரவு — ${familyCode} (${headName})`;
  const note = userNote?.trim();
  return note ? `${base}: ${note}` : base;
}

export const DIRECT_ACCOUNT_COLLECTION_NOTE = "நேரடி கணக்கு வரவு";

export function isDirectAccountCollection(notes?: string | null): boolean {
  return (notes || "").includes(DIRECT_ACCOUNT_COLLECTION_NOTE);
}

export function buildDirectAccountCollectionNotes(userNote?: string | null): string {
  const note = userNote?.trim();
  return note
    ? `${DIRECT_ACCOUNT_COLLECTION_NOTE}: ${note}`
    : `${DIRECT_ACCOUNT_COLLECTION_NOTE} (கமிஷன் இல்லை)`;
}

export function extractDirectAccountNote(notes?: string | null): string {
  if (!notes) return "";
  const prefix = `${DIRECT_ACCOUNT_COLLECTION_NOTE}:`;
  if (notes.startsWith(prefix)) return notes.slice(prefix.length).trim();
  if (notes.includes(DIRECT_ACCOUNT_COLLECTION_NOTE)) {
    return notes.replace(DIRECT_ACCOUNT_COLLECTION_NOTE, "").replace(/^[(\s:]+|[)\s]+$/g, "").trim();
  }
  return notes;
}

type DirectAccountCollectionInput = {
  masjidId: string;
  userId: string;
  familyId: string;
  amount: number;
  date: string;
  notes?: string | null;
};

/** Pending collection from accounts — family updates immediately; main account on batch approval. */
export async function createPendingCollectionFromAccounts(
  supabase: { from: (table: string) => any },
  input: DirectAccountCollectionInput
) {
  return supabase.from("subscription_collections").insert({
    masjid_id: input.masjidId,
    family_id: input.familyId,
    amount: input.amount,
    commission_percent: 0,
    commission_amount: 0,
    status: "pending",
    notes: buildDirectAccountCollectionNotes(input.notes),
    collected_by_user_id: input.userId,
    date: input.date,
  });
}

export async function updatePendingCollectionFromAccounts(
  supabase: { from: (table: string) => any },
  collectionId: string,
  masjidId: string,
  input: Omit<DirectAccountCollectionInput, "masjidId" | "userId">
) {
  return supabase
    .from("subscription_collections")
    .update({
      family_id: input.familyId,
      amount: input.amount,
      date: input.date,
      notes: buildDirectAccountCollectionNotes(input.notes),
    })
    .eq("id", collectionId)
    .eq("masjid_id", masjidId)
    .eq("status", "pending");
}

export async function deletePendingCollectionFromAccounts(
  supabase: { from: (table: string) => any },
  collectionId: string,
  masjidId: string
) {
  return supabase
    .from("subscription_collections")
    .delete()
    .eq("id", collectionId)
    .eq("masjid_id", masjidId)
    .eq("status", "pending");
}

type DirectSubscriptionSyncInput = DirectAccountCollectionInput & {
  transactionId: string;
};

/** Legacy: keep accepted collections linked to old direct account transactions. */
export async function syncCollectionForAccountTransaction(
  supabase: { from: (table: string) => any },
  input: DirectSubscriptionSyncInput
) {
  const payload = {
    masjid_id: input.masjidId,
    family_id: input.familyId,
    amount: input.amount,
    commission_percent: 0,
    commission_amount: 0,
    status: "accepted",
    notes: buildDirectAccountCollectionNotes(input.notes),
    collected_by_user_id: input.userId,
    accepted_by_user_id: input.userId,
    accepted_at: new Date().toISOString(),
    main_transaction_id: input.transactionId,
    date: input.date,
  };

  const { data: existing } = await supabase
    .from("subscription_collections")
    .select("id")
    .eq("main_transaction_id", input.transactionId)
    .maybeSingle();

  if (existing?.id) {
    return supabase
      .from("subscription_collections")
      .update({
        family_id: payload.family_id,
        amount: payload.amount,
        date: payload.date,
        notes: payload.notes,
        status: "accepted",
      })
      .eq("id", existing.id);
  }

  return supabase.from("subscription_collections").insert(payload);
}

export async function deleteCollectionForAccountTransaction(
  supabase: { from: (table: string) => any },
  transactionId: string
) {
  return supabase
    .from("subscription_collections")
    .delete()
    .eq("main_transaction_id", transactionId);
}

/** Display label for main-account transaction rows (batch subscriptions, etc.) */
export function formatTransactionDescription(
  description: string,
  category?: string,
  familyId?: string | null
): string {
  const desc = (description || "").trim();
  if (!desc) return desc;

  const batchMatch = desc.match(
    /Subscription Collections Batch\s*-\s*(\d+)\s*families?/i
  );
  if (batchMatch) {
    return `சந்தா வசூல் — ${batchMatch[1]} குடும்பங்கள்`;
  }

  if (
    !familyId &&
    (desc.toLowerCase().includes("subscription collection") ||
      category?.toLowerCase() === "subscription")
  ) {
    return "சந்தா வசூல் (தொகுப்பு)";
  }

  return desc
    .replace(/^Subscription Collections Batch/i, "சந்தா வசூல்")
    .replace(/^Subscription:\s*/i, "சந்தா: ")
    .replace(/^சந்தா வரவு\s*—/i, "சந்தா வரவு —")
    .replace(/^Subscription collection approved/i, "சந்தா வசூல் அனுமதி")
    .replace(/^Income:\s*/i, "வரவு: ")
    .replace(/^Expense:\s*/i, "செலவு: ");
}

export function formatTransactionCategory(category: string): string {
  const key = (category || "").trim().toLowerCase();
  const labels: Record<string, string> = {
    subscription: "சந்தா வசூல்",
    subscription_collection: "சந்தா வசூல்",
    income: "வரவு",
    expense: "செலவு",
  };
  return labels[key] || category;
}
