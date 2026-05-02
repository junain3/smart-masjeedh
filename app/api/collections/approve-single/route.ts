import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withCollectionSecurity } from '../middleware';

export const POST = withCollectionSecurity(async (request: NextRequest) => {
  try {
    // Get user context from middleware
    const userContext = (request as any).userContext;
    const user = userContext?.userId;

    // Parse request body
    const body = await request.json();
    const { collection_id } = body;

    if (!collection_id) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    // Fetch the collection by id
    const { data: collection, error: fetchError } = await supabase
      .from('subscription_collections')
      .select('*')
      .eq('id', collection_id)
      .eq('masjid_id', userContext.masjidId)
      .single();

    if (fetchError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    // Check if already approved or has transaction
    if (collection.status === 'accepted' || collection.main_transaction_id) {
      return NextResponse.json(
        { 
          message: 'Collection already approved',
          alreadyApproved: true,
          status: collection.status,
          mainTransactionId: collection.main_transaction_id
        },
        { status: 200 }
      );
    }

    // Insert transaction into accounts
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        masjid_id: collection.masjid_id,
        user_id: user,
        family_id: collection.family_id,
        amount: collection.amount,
        type: 'subscription',
        category: 'subscription_collection',
        description: 'Subscription collection approved',
        date: collection.date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Transaction creation error:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Update collection status
    const { error: updateError } = await supabase
      .from('subscription_collections')
      .update({
        status: 'accepted',
        accepted_by_user_id: user,
        accepted_at: new Date().toISOString(),
        main_transaction_id: transaction.id
      })
      .eq('id', collection_id);

    if (updateError) {
      console.error('Collection update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update collection status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Collection approved and recorded in accounts',
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        family_id: transaction.family_id
      },
      collection: {
        id: collection.id,
        status: 'accepted',
        family_id: collection.family_id
      }
    });

  } catch (error) {
    console.error('Approve collection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
