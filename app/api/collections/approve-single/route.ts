import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withCollectionSecurity } from '../middleware';
import { sendSms } from '@/lib/sms-utils';
import { buildCollectionApprovedSms } from '@/lib/collection-utils';

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

    console.info('[collections/approve-single] request received', {
      masjidId: userContext.masjidId,
      userId,
      collectionIds,
      collectionCount: collectionIds.length,
    });

    // Get collections (NOTE: no FK constraint exists between subscription_collections.family_id and families.id in schema
    // so implicit join via families(...) fails schema cache lookup. Fetch families separately and merge.)
    const { data: collections, error: fetchError } = await supabaseAdmin
      .from('subscription_collections')
      .select('*')
      .in('id', collectionIds)
      .eq('masjid_id', userContext.masjidId)
      .eq('status', 'pending');

    if (fetchError) {
      throw fetchError;
    }

    const rawCollections: any[] = collections || [];

    console.info('[collections/approve-single] pending collections fetched', {
      masjidId: userContext.masjidId,
      fetchedCount: rawCollections.length,
    });

    // Resolve families separately (family_id column has no FK constraint → PostgREST cannot auto-join)
    let pendingCollections: any[] = rawCollections;
    if (rawCollections.length > 0) {
      const familyIds = Array.from(new Set(rawCollections.map((c: any) => c.family_id).filter(Boolean)));
      console.info('[collections/approve-single] resolving families by ids', {
        familyIdCount: familyIds.length,
      });
      const { data: families, error: familyFetchError } = await supabaseAdmin
        .from('families')
        .select('id, head_name, phone')
        .eq('masjid_id', userContext.masjidId)
        .in('id', familyIds);

      if (familyFetchError) {
        console.error('[collections/approve-single] families lookup failed', { familyFetchError });
        throw familyFetchError;
      }

      const familyMap = new Map<string, any>();
      (families || []).forEach((f: any) => familyMap.set(f.id, f));

      pendingCollections = rawCollections.map((c: any) => ({
        ...c,
        families: familyMap.get(c.family_id) || null,
      }));
    }
    const foundIds = new Set(pendingCollections.map((item: any) => item.id));
    const missingIds = collectionIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: 'Some collections are missing or already approved', success: false },
        { status: 400 }
      );
    }

    const totalAmount = pendingCollections.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    const { data: transaction, error: transactionError } = await supabaseAdmin
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
    const smsResults: Array<{ familyId: string; success: boolean; error?: string }> = [];

    for (const collection of pendingCollections) {
      try {
        console.info('[collections/approve-single] processing collection', {
          collectionId: collection.id,
          familyId: collection.family_id,
          amount: collection.amount,
          familyHeadName: collection.families?.head_name || null,
          phonePresent: Boolean(collection.families?.phone),
          phoneLength: collection.families?.phone?.length || 0,
        });

        const profileRes = await supabaseAdmin
          .from('subscription_collector_profiles')
          .select('default_commission_percent')
          .eq('masjid_id', userContext.masjidId)
          .eq('user_id', collection.collected_by_user_id)
          .maybeSingle();

        const commissionPercent = Number(profileRes.data?.default_commission_percent ?? 0);
        const commissionAmount = (Number(collection.amount || 0) * commissionPercent) / 100;

        try {
          await supabaseAdmin.from('employee_commissions').insert({
            masjid_id: userContext.masjidId,
            employee_id: collection.collected_by_user_id,
            collection_id: collection.id,
            amount: commissionAmount,
          });
        } catch (commissionError) {
          console.warn('Employee commission insert skipped:', commissionError);
        }

        try {
          await supabaseAdmin.from('staff_commissions').insert({
            masjid_id: userContext.masjidId,
            collector_user_id: collection.collected_by_user_id,
            amount: commissionAmount,
            status: 'pending',
          });
        } catch (staffCommissionError) {
          console.warn('Staff commission insert skipped:', staffCommissionError);
        }

        const { error: updateError } = await supabaseAdmin
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

        console.info('[collections/approve-single] collection approval update success', {
          collectionId: collection.id,
          mainTransactionId: transaction.id,
          commissionPercent,
          commissionAmount,
        });

        // Send SMS notification if family has phone number
        const family = collection.families;
        if (family?.phone) {
          const message = buildCollectionApprovedSms(family.head_name, collection.amount);
          console.info('[collections/approve-single] triggering auto SMS', {
            collectionId: collection.id,
            familyId: family.id,
            phoneLength: family.phone.length,
            messageLength: message.length,
          });

          try {
            const smsResult = await sendSms(
              userContext.masjidId,
              family.phone,
              message,
              userId
            );

            if (!smsResult.success) {
              console.error('[collections/approve-single] auto SMS failed', {
                collectionId: collection.id,
                familyId: family.id,
                phoneLength: family.phone.length,
                error: smsResult.error,
              });
            } else {
              console.info('[collections/approve-single] auto SMS completed', {
                collectionId: collection.id,
                familyId: family.id,
                smsResult,
              });
            }

            smsResults.push({
              familyId: family.id,
              success: smsResult.success,
              error: smsResult.error
            });
          } catch (smsError) {
            console.error('[collections/approve-single] auto SMS threw unexpectedly', {
              collectionId: collection.id,
              familyId: family.id,
              smsError,
            });
            smsResults.push({
              familyId: family.id,
              success: false,
              error: smsError instanceof Error ? smsError.message : 'Unknown SMS error',
            });
          }
        } else {
          console.error('[collections/approve-single] auto SMS skipped: missing family phone', {
            collectionId: collection.id,
            familyId: family?.id || collection.family_id,
            familyHeadName: family?.head_name || null,
          });
        }

        successCount += 1;
      } catch (error: any) {
        console.error('[collections/approve-single] collection processing failed', {
          collectionId: collection.id,
          familyId: collection.family_id,
          error,
        });
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
      sms_results: smsResults,
    });
  } catch (error: any) {
    console.error('Approve collection error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
});
