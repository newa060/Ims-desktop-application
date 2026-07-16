import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupPurchaseHandlers = () => {

  // ── purchases:getAll ───────────────────────────────────────────────────────
  ipcMain.handle('purchases:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '', supplierId } = params;
      const from = (page - 1) * limit;
      const to   = from + limit - 1;

      let query = supabase
        .from('purchases')
        .select(
          // Join purchase_items → variant → parent product for display
          '*, supplier:suppliers(*), user:users(firstName, lastName), ' +
          'items:purchase_items(*, variant:product_variant(sku, variant_name, color, size, ' +
          '  product:product_variant_flat(name, purchase_price, selling_price)))',
          { count: 'exact' }
        )
        .is('deletedAt', null);

      if (search)     query = query.ilike('purchaseNumber', `%${search}%`);
      if (supplierId) query = query.eq('supplierId', supplierId);

      const { data: purchases, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        success: true,
        data: {
          data: purchases,
          pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        },
      };
    } catch (error) {
      logger.error('Get purchases handler error:', error);
      return { success: false, error: 'Failed to fetch purchases' };
    }
  });

  // ── purchases:getById ──────────────────────────────────────────────────────
  ipcMain.handle('purchases:getById', async (_event, id: string) => {
    try {
      const { data: purchase, error } = await supabase
        .from('purchases')
        .select(
          '*, supplier:suppliers(*), user:users(firstName, lastName), ' +
          'items:purchase_items(*, variant:product_variant(sku, variant_name, color, size, ' +
          '  product:product_variant_flat(name, purchase_price, selling_price)))'
        )
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Get purchase by ID handler error:', error);
      return { success: false, error: 'Failed to fetch purchase' };
    }
  });

  // ── purchases:create ───────────────────────────────────────────────────────
  // Uses create_purchase_v2 — each item MUST include variantId.
  ipcMain.handle('purchases:create', async (_event, data: any) => {
    try {
      const { data: purchase, error } = await supabase
        .rpc('create_purchase_v2', { payload: data })
        .single();

      if (error) throw new Error(error.message);
      logger.info(`Purchase created: ${(purchase as any).id}`);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Create purchase handler error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create purchase' };
    }
  });

  // ── purchases:recordPayment ────────────────────────────────────────────────
  ipcMain.handle('purchases:recordPayment', async (_event, params: any) => {
    try {
      const { purchaseId, amount } = params;
      if (!purchaseId) throw new Error('purchaseId is required');
      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than 0');

      const { data: purchase, error: fetchError } = await supabase
        .from('purchases')
        .select('id, supplierId, paidAmount, balanceAmount, paymentStatus')
        .eq('id', purchaseId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = Number((purchase as any).balanceAmount || 0);
      const currentPaid    = Number((purchase as any).paidAmount    || 0);
      const supplierId     = (purchase as any).supplierId;

      if (currentBalance <= 0) throw new Error('This purchase has no outstanding balance');
      if (paymentAmount > currentBalance) throw new Error('Payment exceeds balance due');

      const newPaidAmount    = currentPaid    + paymentAmount;
      const newBalanceAmount = currentBalance - paymentAmount;
      const newPaymentStatus = newBalanceAmount <= 0 ? 'paid'
        : newPaidAmount > 0 ? 'partial' : 'unpaid';

      const { error: updateErr } = await supabase
        .from('purchases')
        .update({ paidAmount: newPaidAmount, balanceAmount: newBalanceAmount, paymentStatus: newPaymentStatus })
        .eq('id', purchaseId);

      if (updateErr) throw updateErr;

      if (supplierId) {
        const { data: supplier, error: supErr } = await supabase
          .from('suppliers').select('balance').eq('id', supplierId).single();
        if (!supErr && supplier) {
          const newBalance = Math.max(0, Number((supplier as any).balance || 0) - paymentAmount);
          await supabase.from('suppliers').update({ balance: newBalance }).eq('id', supplierId);
        }
      }

      return { success: true, data: { newPaidAmount, newBalanceAmount, newPaymentStatus } };
    } catch (error) {
      logger.error('Record purchase payment handler error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record payment' };
    }
  });

  // ── purchases:getReturns ───────────────────────────────────────────────────
  ipcMain.handle('purchases:getReturns', async (_event, purchaseId: string) => {
    try {
      const { data: returns, error } = await supabase
        .from('inventory_history')
        .select(
          '*, variant:product_variant(sku, variant_name, ' +
          '  product:product_variant_flat(name))'
        )
        .eq('referenceId', purchaseId)
        .in('reference', ['Purchase Return', 'Purchase Refund', 'Purchase Exchange']);

      if (error) throw error;
      return { success: true, data: returns };
    } catch (error) {
      logger.error('Get purchase returns handler error:', error);
      return { success: false, error: 'Failed to fetch returns' };
    }
  });

  // ── purchases:createReturn ─────────────────────────────────────────────────
  // Decrements variant stock and logs inventory_history.
  ipcMain.handle('purchases:createReturn', async (_event, params: any) => {
    try {
      const { purchaseId, variantId, productFlatId, quantity, notes } = params;
      const qty = Number(quantity);

      if (!variantId) throw new Error('variantId is required for returns');

      const { data: updatedVariant, error: rpcError } = await supabase
        .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: -qty })
        .single();
      if (rpcError) throw rpcError;

      const { error: historyError } = await supabase
        .from('inventory_history')
        .insert({
          productId:      productFlatId,
          variant_id:     variantId,
          type:           'return',
          quantityChange: -qty,
          quantityBefore: (updatedVariant as any).stock + qty,
          quantityAfter:  (updatedVariant as any).stock,
          reference:      'Purchase Return',
          referenceId:    purchaseId,
          notes:          notes || 'Damaged goods returned to supplier',
        });
      if (historyError) throw historyError;

      return { success: true };
    } catch (error) {
      logger.error('Create purchase return handler error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to process return' };
    }
  });

  // ── purchases:createRefundOrExchange ──────────────────────────────────────
  ipcMain.handle('purchases:createRefundOrExchange', async (_event, params: any) => {
    try {
      const { purchaseId, variantId, productFlatId, quantity, actionType, notes } = params;
      const qty = Number(quantity);

      if (!variantId) throw new Error('variantId is required');

      // Get unit price from the purchase item
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*, items:purchase_items(*), supplierId, totalAmount, paidAmount, balanceAmount')
        .eq('id', purchaseId)
        .single();
      if (purchaseError || !purchase) throw purchaseError || new Error('Purchase not found');

      const purchaseItem = (purchase.items || []).find((i: any) => i.variant_id === variantId);
      const unitPrice    = Number(purchaseItem?.unitPrice || 0);
      const refundValue  = unitPrice * qty;

      if (actionType === 'refund') {
        // Decrement variant stock
        const { data: updatedVariant, error: stockErr } = await supabase
          .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: -qty })
          .single();
        if (stockErr) throw stockErr;

        await supabase.from('inventory_history').insert({
          productId: productFlatId, variant_id: variantId,
          type: 'refund', quantityChange: -qty,
          quantityBefore: (updatedVariant as any).stock + qty,
          quantityAfter:  (updatedVariant as any).stock,
          reference: 'Purchase Refund', referenceId: purchaseId,
          notes: notes || 'Refunded from supplier',
        });

        // Adjust purchase amounts
        const currentTotal   = Number(purchase.totalAmount   || 0);
        const currentPaid    = Number(purchase.paidAmount    || 0);
        const currentBalance = Number(purchase.balanceAmount || 0);
        const newTotal       = Math.max(0, currentTotal - refundValue);
        const newBalance     = Math.max(0, currentBalance - refundValue);
        const remainingRefund = refundValue - (currentBalance - newBalance);
        const newPaid        = Math.max(0, currentPaid - remainingRefund);
        const newPaymentStatus = newBalance <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

        await supabase.from('purchases').update({
          totalAmount: newTotal, paidAmount: newPaid,
          balanceAmount: newBalance, paymentStatus: newPaymentStatus,
        }).eq('id', purchaseId);

        if (purchase.supplierId) {
          const { data: s } = await supabase.from('suppliers').select('balance').eq('id', purchase.supplierId).single();
          if (s) {
            await supabase.from('suppliers')
              .update({ balance: Math.max(0, Number((s as any).balance || 0) - refundValue) })
              .eq('id', purchase.supplierId);
          }
        }

      } else if (actionType === 'exchange') {
        // Remove damaged unit
        const { data: decVariant, error: decErr } = await supabase
          .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: -qty })
          .single();
        if (decErr) throw decErr;

        await supabase.from('inventory_history').insert({
          productId: productFlatId, variant_id: variantId,
          type: 'exchange_out', quantityChange: -qty,
          quantityBefore: (decVariant as any).stock + qty,
          quantityAfter:  (decVariant as any).stock,
          reference: 'Purchase Exchange', referenceId: purchaseId,
          notes: notes || `Returned ${qty} damaged unit(s) for exchange`,
        });

        // Add replacement unit
        const { data: incVariant, error: incErr } = await supabase
          .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: qty })
          .single();
        if (incErr) throw incErr;

        await supabase.from('inventory_history').insert({
          productId: productFlatId, variant_id: variantId,
          type: 'exchange_in', quantityChange: qty,
          quantityBefore: (incVariant as any).stock - qty,
          quantityAfter:  (incVariant as any).stock,
          reference: 'Purchase Exchange', referenceId: purchaseId,
          notes: notes || `Received ${qty} replacement unit(s)`,
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Create purchase refund/exchange handler error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to process refund/exchange' };
    }
  });
};
