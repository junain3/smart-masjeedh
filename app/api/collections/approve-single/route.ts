import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withCollectionSecurity } from '../middleware';

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    const userContext = (request as any).userContext;
    const userId = userContext?.userId;

    const body = await request.json();
    const collectionIds: string[] = Array.isArray(body.collection_ids)
      ? body.collection_ids
      : body.collection_id
        ? [body.collection_id]
        : [];

    if (!userContext || !userId) {
      return NextResponse.json({ error: 'User context missing' }, { status: 403 });
    }

    const isAdminApprover = Boolean(
      userContext.role === 'super_admin' || userContext.permissions?.subscriptions_approve
    );

    if (!isAdminApprover) {
      return NextResponse.json({ error: 'Approval permission required' }, { status: 403 });
    }

    if (collectionIds.length === 0) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    const { data: collections, error: fetchError } = await supabase
      .from('subscription_collections')
      .select('*')
      .in('id', collectionIds)
      .eq('masjid_id', userContext.masjidId)
      .eq('status', 'pending');

    if (fetchError) {
      throw fetchError;
    }

    const pendingCollections = collections || [];
    const foundIds = new Set(pendingCollections.map((item: any) => item.id));
    const missingIds = collectionIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some collections are missing or already approved', success: false },
        { status: 400 }
      );
    }

    const totalAmount = pendingCollections.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        masjid_id: userContext.masjidId,
        user_id: userId,
        family_id: null,
        amount: totalAmount,
        type: 'income',
        category: 'subscription',
        description: `சந்தா வசூல் — ${pendingCollections.length} குடும்பங்கள்`,
        date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction creation error:', transactionError);
      return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }

    const failures: string[] = [];
    let successCount = 0;

    for (const collection of pendingCollections) {
      try {
        const profileRes = await supabase
          .from('subscription_collector_profiles')
          .select('default_commission_percent')
          .eq('masjid_id', userContext.masjidId)
          .eq('user_id', collection.collected_by_user_id)
          .maybeSingle();

        const commissionPercent = Number(profileRes.data?.default_commission_percent ?? 0);
        const commissionAmount = (Number(collection.amount || 0) * commissionPercent) / 100;

        try {
          await supabase.from('employee_commissions').insert({
            masjid_id: userContext.masjidId,
            employee_id: collection.collected_by_user_id,
            collection_id: collection.id,
            amount: commissionAmount,
          });
        } catch (commissionError) {
          console.warn('Employee commission insert skipped:', commissionError);
        }

        try {
          await supabase.from('staff_commissions').insert({
            masjid_id: userContext.masjidId,
            collector_user_id: collection.collected_by_user_id,
            amount: commissionAmount,
            status: 'pending',
          });
        } catch (staffCommissionError) {
          console.warn('Staff commission insert skipped:', staffCommissionError);
        }

        const { error: updateError } = await supabase
          .from('subscription_collections')
          .update({
            status: 'accepted',
            commission_percent: commissionPercent,
            commission_amount: commissionAmount,
            main_transaction_id: transaction.id,
            accepted_by_user_id: userId,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', collection.id);

        if (updateError) {
          throw updateError;
        }

        successCount += 1;
      } catch (error: any) {
        failures.push(error?.message || 'Unknown error');
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      success_count: successCount,
      failure_count: failures.length,
      total_amount: totalAmount,
      failures,
      main_transaction_id: transaction.id,
    });
  } catch (error: any) {
    console.error('Approve collection error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
});
