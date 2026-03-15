// =====================================================
// SECURE MULTI-USER TRANSACTION OPERATIONS
// =====================================================
// These examples show how to safely handle transactions
// in a multi-user environment with strict user isolation

import { supabase } from '@/lib/supabase';

// =====================================================
// 1. DELETE TRANSACTION - USER ISOLATION
// =====================================================
export async function deleteTransaction(transactionId: string) {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Delete with user_id check - RLS also protects this
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id); // Extra safety check

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error("Delete transaction error:", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// 2. UPDATE TRANSACTION - USER ISOLATION
// =====================================================
export async function updateTransaction(
  transactionId: string, 
  updates: {
    amount?: number;
    description?: string;
    type?: 'income' | 'expense' | 'subscription';
    category?: string;
    date?: string;
  }
) {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Update with user_id check - RLS also protects this
    const { error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", transactionId)
      .eq("user_id", user.id); // Extra safety check

    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error("Update transaction error:", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// 3. GET USER TRANSACTIONS ONLY
// =====================================================
export async function getUserTransactions() {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Fetch user's transactions only
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id) // Explicit user filter
      .order("date", { ascending: false });

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error("Get transactions error:", error);
    return { success: false, error: error.message, data: [] };
  }
}

// =====================================================
// 4. INSERT TRANSACTION - USER ISOLATION
// =====================================================
export async function insertTransaction(transactionData: {
  amount: number;
  description: string;
  type: 'income' | 'expense' | 'subscription';
  category: string;
  date: string;
}) {
  try {
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    // Insert with user_id - REQUIRED for RLS
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        ...transactionData,
        user_id: user.id, // CRITICAL: Always include user_id
      })
      .select()
      .single();

    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error("Insert transaction error:", error);
    return { success: false, error: error.message };
  }
}

// =====================================================
// 5. REACT SUBMIT HANDLER EXAMPLE
// =====================================================
export const useSecureTransactionSubmit = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitTransaction = async (formData: {
    amount: string;
    description: string;
    type: 'income' | 'expense' | 'subscription';
    category: string;
    date: string;
  }) => {
    setLoading(true);
    setError("");

    try {
      // Validate input
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error("Amount must be greater than 0");
      }

      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated. Please login again.");
      }

      // Insert transaction with user_id
      const { error } = await supabase.from("transactions").insert([
        {
          amount: parseFloat(formData.amount),
          description: formData.description,
          type: formData.type,
          category: formData.category,
          date: formData.date,
          user_id: user.id, // CRITICAL: Always include user_id
        }
      ]);

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  return { submitTransaction, loading, error };
};

// =====================================================
// SECURITY NOTES:
// 1. ALWAYS check authentication before operations
// 2. ALWAYS include user_id in inserts
// 3. ALWAYS use .eq("user_id", user.id) for extra safety
// 4. NEVER use service role key in frontend
// 5. NEVER disable RLS
// 6. NEVER use USING (true) or WITH CHECK (true)
// 7. RLS policies are the last line of defense
// =====================================================
