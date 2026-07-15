import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

export const setupPurchaseHandlers = () => {
  // purchases:getAll - paginated list with supplier info
  ipcMain.handle('purchases:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '', supplierId } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('purchases')
        .select(
          '*, supplier:suppliers(*), user:users(firstName, lastName), items:purchase_items(*, product:products(*))',
          { count: 'exact' }
        )
        .is('deletedAt', null);

      if (search) {
        query = query.ilike('purchaseNumber', `%${search}%`);
      }

      if (supplierId) {
        query = query.eq('supplierId', supplierId);
      }

      const { data: purchases, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: purchases,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
          },
        },
      };
    } catch (error) {
      logger.error('Get purchases handler error:', error);
      return { success: false, error: 'Failed to fetch purchases' };
    }
  });

  // purchases:getById
  ipcMain.handle('purchases:getById', async (_event, id: string) => {
    try {
      const { data: purchase, error } = await supabase
        .from('purchases')
        .select(
          '*, supplier:suppliers(*), user:users(firstName, lastName), items:purchase_items(*, product:products(*))'
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

  // purchases:create - creates purchase with items, updates stock & inventory history
  // Done atomically via the create_purchase Postgres function (see Supabase SQL
  // schema) since PostgREST has no client-side multi-statement transactions.
  ipcMain.handle('purchases:create', async (_event, data: any) => {
    try {
      const { data: purchase, error } = await supabase
        .rpc('create_purchase', { payload: data })
        .single();

      if (error) throw new Error(error.message);

      logger.info(`Purchase created: ${(purchase as any).id}`);
      return { success: true, data: purchase };
    } catch (error) {
      logger.error('Create purchase handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create purchase',
      };
    }
  });

  // purchases:recordPayment - pay (partial or full) balance on an individual purchase
  // Updates: purchase.paidAmount, purchase.balanceAmount, purchase.paymentStatus
  // Also deducts from supplier.balance
  ipcMain.handle('purchases:recordPayment', async (_event, params: any) => {
    try {
      const { purchaseId, amount } = params;

      if (!purchaseId) throw new Error('purchaseId is required');
      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) throw new Error('Payment amount must be greater than 0');

      // 1. Fetch the current purchase
      const { data: purchase, error: fetchError } = await supabase
        .from('purchases')
        .select('id, supplierId, totalAmount, paidAmount, balanceAmount, paymentStatus')
        .eq('id', purchaseId)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = Number((purchase as any).balanceAmount || 0);
      const currentPaid = Number((purchase as any).paidAmount || 0);
      const supplierId = (purchase as any).supplierId;

      if (currentBalance <= 0) throw new Error('This purchase has no outstanding balance');
      if (paymentAmount > currentBalance) throw new Error('Payment amount exceeds purchase balance due');

      const newPaidAmount = currentPaid + paymentAmount;
      const newBalanceAmount = currentBalance - paymentAmount;

      // Determine new payment status
      let newPaymentStatus: string;
      if (newBalanceAmount <= 0) {
        newPaymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        newPaymentStatus = 'partial';
      } else {
        newPaymentStatus = 'unpaid';
      }

      // 2. Update the purchase record
      const { error: purchaseUpdateError } = await supabase
        .from('purchases')
        .update({
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          paymentStatus: newPaymentStatus,
        })
        .eq('id', purchaseId);

      if (purchaseUpdateError) throw purchaseUpdateError;

      // 3. Deduct from supplier's outstanding balance
      if (supplierId) {
        const { data: supplier, error: supplierFetchError } = await supabase
          .from('suppliers')
          .select('balance')
          .eq('id', supplierId)
          .single();

        if (!supplierFetchError && supplier) {
          const supplierCurrentBalance = Number((supplier as any).balance || 0);
          const supplierNewBalance = Math.max(0, supplierCurrentBalance - paymentAmount);

          await supabase
            .from('suppliers')
            .update({ balance: supplierNewBalance })
            .eq('id', supplierId);
        }
      }

      return {
        success: true,
        data: {
          newPaidAmount,
          newBalanceAmount,
          newPaymentStatus,
        },
      };
    } catch (error) {
      logger.error('Record purchase payment handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record payment',
      };
    }
  });

  // purchases:getReturns - fetches all returns/refunds/exchanges for a purchase
  ipcMain.handle('purchases:getReturns', async (_event, purchaseId: string) => {
    try {
      const { data: returns, error } = await supabase
        .from('inventory_history')
        .select('*, product:products(name, sku)')
        .eq('referenceId', purchaseId)
        .in('reference', ['Purchase Return', 'Purchase Refund', 'Purchase Exchange']);

      if (error) throw error;
      return { success: true, data: returns };
    } catch (error) {
      logger.error('Get purchase returns handler error:', error);
      return { success: false, error: 'Failed to fetch returns' };
    }
  });

  // purchases:createReturn - records a return for a purchase item (damaged goods)
  ipcMain.handle('purchases:createReturn', async (_event, params: any) => {
    try {
      const { purchaseId, productId, quantity, notes, userId } = params;

      // 1. Decrement product stock atomically
      const { data: updatedProduct, error: rpcError } = await supabase
        .rpc('increment_product_stock', {
          p_product_id: productId,
          p_delta: -Number(quantity),
        })
        .single();

      if (rpcError) throw rpcError;

      // 2. Insert record into inventory_history
      const { error: insertError } = await supabase
        .from('inventory_history')
        .insert({
          productId,
          type: 'return',
          quantityChange: -Number(quantity),
          quantityBefore: (updatedProduct as any).stock + Number(quantity),
          quantityAfter: (updatedProduct as any).stock,
          reference: 'Purchase Return',
          referenceId: purchaseId,
          notes: notes || 'Damaged goods returned to supplier',
        });

      if (insertError) throw insertError;

      return { success: true };
    } catch (error) {
      logger.error('Create purchase return handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process return',
      };
    }
  });

  // purchases:createRefundOrExchange - records a refund or exchange for a purchase item
  ipcMain.handle('purchases:createRefundOrExchange', async (_event, params: any) => {
    try {
      const { purchaseId, productId, quantity, actionType, notes } = params; // actionType: 'refund' | 'exchange'
      const qtyNum = Number(quantity);

      // 1. Fetch current purchase & item to get unitPrice, etc.
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('*, items:purchase_items(*)')
        .eq('id', purchaseId)
        .single();
      if (purchaseError || !purchase) throw purchaseError || new Error('Purchase not found');

      // Find the specific item to get price
      const purchaseItem = (purchase.items || []).find((item: any) => item.productId === productId);
      if (!purchaseItem) throw new Error('Product not found in this purchase');

      const unitPrice = Number(purchaseItem.unitPrice || 0);
      const refundValue = unitPrice * qtyNum;

      if (actionType === 'refund') {
        // --- REFUND LOGIC ---
        // A. Decrement product stock atomically (returning to supplier)
        const { data: updatedProduct, error: stockError } = await supabase
          .rpc('increment_product_stock', {
            p_product_id: productId,
            p_delta: -qtyNum,
          })
          .single();
        if (stockError) throw stockError;

        // B. Insert into inventory_history
        const { error: insertHistoryError } = await supabase
          .from('inventory_history')
          .insert({
            productId,
            type: 'refund',
            quantityChange: -qtyNum,
            quantityBefore: (updatedProduct as any).stock + qtyNum,
            quantityAfter: (updatedProduct as any).stock,
            reference: 'Purchase Refund',
            referenceId: purchaseId,
            notes: notes || 'Refunded from supplier',
          });
        if (insertHistoryError) throw insertHistoryError;

        // C. Update purchase amount & balance
        const currentTotal = Number(purchase.totalAmount || 0);
        const currentPaid = Number(purchase.paidAmount || 0);
        const currentBalance = Number(purchase.balanceAmount || 0);

        const newTotal = Math.max(0, currentTotal - refundValue);
        // Decrease balance first
        const newBalance = Math.max(0, currentBalance - refundValue);
        // If refund value is larger than current balance, the rest is deducted from paid amount
        const remainingRefund = refundValue - (currentBalance - newBalance);
        const newPaid = Math.max(0, currentPaid - remainingRefund);

        let newPaymentStatus = 'unpaid';
        if (newBalance <= 0) {
          newPaymentStatus = 'paid';
        } else if (newPaid > 0) {
          newPaymentStatus = 'partial';
        }

        const { error: updatePurchaseErr } = await supabase
          .from('purchases')
          .update({
            totalAmount: newTotal,
            paidAmount: newPaid,
            balanceAmount: newBalance,
            paymentStatus: newPaymentStatus,
          })
          .eq('id', purchaseId);
        if (updatePurchaseErr) throw updatePurchaseErr;

        // D. Sync supplier outstanding balance (since we owe them less)
        if (purchase.supplierId) {
          const { data: supplier, error: supplierFetchError } = await supabase
            .from('suppliers')
            .select('balance')
            .eq('id', purchase.supplierId)
            .single();

          if (!supplierFetchError && supplier) {
            const supplierCurrentBalance = Number(supplier.balance || 0);
            const supplierNewBalance = Math.max(0, supplierCurrentBalance - refundValue);

            await supabase
              .from('suppliers')
              .update({ balance: supplierNewBalance })
              .eq('id', purchase.supplierId);
          }
        }

      } else if (actionType === 'exchange') {
        // --- EXCHANGE LOGIC ---
        // A. Decrement product stock (damaged item returned to supplier)
        const { data: decProduct, error: decStockError } = await supabase
          .rpc('increment_product_stock', {
            p_product_id: productId,
            p_delta: -qtyNum,
          })
          .single();
        if (decStockError) throw decStockError;

        // B. Insert exchange_out record in inventory_history
        const { error: insertHistoryOutError } = await supabase
          .from('inventory_history')
          .insert({
            productId,
            type: 'exchange_out',
            quantityChange: -qtyNum,
            quantityBefore: (decProduct as any).stock + qtyNum,
            quantityAfter: (decProduct as any).stock,
            reference: 'Purchase Exchange',
            referenceId: purchaseId,
            notes: notes || `Returned ${qtyNum} damaged unit(s) for exchange`,
          });
        if (insertHistoryOutError) throw insertHistoryOutError;

        // C. Increment product stock (new replacement item received)
        const { data: incProduct, error: incStockError } = await supabase
          .rpc('increment_product_stock', {
            p_product_id: productId,
            p_delta: qtyNum,
          })
          .single();
        if (incStockError) throw incStockError;

        // D. Insert exchange_in record in inventory_history
        const { error: insertHistoryInError } = await supabase
          .from('inventory_history')
          .insert({
            productId,
            type: 'exchange_in',
            quantityChange: qtyNum,
            quantityBefore: (incProduct as any).stock - qtyNum,
            quantityAfter: (incProduct as any).stock,
            reference: 'Purchase Exchange',
            referenceId: purchaseId,
            notes: notes || `Received ${qtyNum} replacement unit(s) from exchange`,
          });
        if (insertHistoryInError) throw insertHistoryInError;
      }

      return { success: true };
    } catch (error) {
      logger.error('Create purchase refund/exchange handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process refund/exchange',
      };
    }
  });
};
