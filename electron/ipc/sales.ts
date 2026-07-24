import { ipcMain } from 'electron';
import SaleService from '../../src/services/SaleService';
import logger from '../../src/utils/logger';
import supabase from '../../src/database/supabaseClient';

export const setupSaleHandlers = () => {
  ipcMain.handle('sales:getAll', async (_event, params) => {
    try {
      const sales = await SaleService.getSales(params);
      return { success: true, data: sales };
    } catch (error) {
      logger.error('Get sales handler error:', error);
      return { success: false, error: 'Failed to fetch sales' };
    }
  });

  ipcMain.handle('sales:getById', async (_event, id: string) => {
    try {
      const sale = await SaleService.getSaleById(id);
      return { success: true, data: sale };
    } catch (error) {
      logger.error('Get sale by ID handler error:', error);
      return { success: false, error: 'Failed to fetch sale' };
    }
  });

  // Uses create_sale_v2 which deducts from product_variants.stock.
  // Each item in data.items MUST include variantId.
  ipcMain.handle('sales:create', async (_event, data) => {
    try {
      const sale = await SaleService.createSale(data);
      return { success: true, data: sale };
    } catch (error) {
      logger.error('Create sale handler error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sale',
      };
    }
  });

  // ── sales:processReturnOrExchange ─────────────────────────────────────────
  ipcMain.handle('sales:processReturnOrExchange', async (_event, params: any) => {
    try {
      const {
        saleId,
        customerId,
        returnItems = [],
        exchangeItems = [],
        settlementType = 'cash', // 'cash' | 'card' | 'store_credit'
        refundAmount = 0,
        additionalAmountPaid = 0,
        notes = '',
      } = params;

      if (!saleId) throw new Error('saleId is required');
      if (returnItems.length === 0 && exchangeItems.length === 0) {
        throw new Error('At least one return or exchange item is required');
      }

      // 1. Process Returned Items
      for (const item of returnItems) {
        const { variantId, productFlatId, quantity, condition, reason } = item;
        const qty = Number(quantity);
        if (!variantId || qty <= 0) continue;

        if (condition === 'resellable') {
          // Restore stock for sellable return
          const { data: updatedVariant, error: stockErr } = await supabase
            .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: qty })
            .single();

          if (!stockErr) {
            await supabase.from('inventory_history').insert({
              productId: productFlatId,
              variant_id: variantId,
              type: 'sale_return',
              quantityChange: qty,
              quantityBefore: (updatedVariant as any)?.stock ? (updatedVariant as any).stock - qty : 0,
              quantityAfter: (updatedVariant as any)?.stock || 0,
              reference: 'Customer Return',
              referenceId: saleId,
              notes: reason || 'Customer Return (Resellable)',
            });
          }
        } else {
          // Log damaged return without adding to sellable stock
          await supabase.from('inventory_history').insert({
            productId: productFlatId,
            variant_id: variantId,
            type: 'sale_return_damaged',
            quantityChange: 0,
            quantityBefore: 0,
            quantityAfter: 0,
            reference: 'Customer Return (Damaged)',
            referenceId: saleId,
            notes: reason || 'Customer Return (Damaged)',
          });
        }
      }

      // 2. Process Exchanged Replacement Items
      for (const exItem of exchangeItems) {
        const { variantId, productFlatId, quantity, unitPrice } = exItem;
        const qty = Number(quantity);
        if (!variantId || qty <= 0) continue;

        // Deduct replacement variant stock
        const { data: decVariant, error: decErr } = await supabase
          .rpc('increment_variant_stock', { p_variant_id: variantId, p_delta: -qty })
          .single();

        if (!decErr) {
          const priceNote = unitPrice ? ` [Price: NRs ${unitPrice}]` : '';
          await supabase.from('inventory_history').insert({
            productId: productFlatId,
            variant_id: variantId,
            type: 'sale_exchange',
            quantityChange: -qty,
            quantityBefore: (decVariant as any)?.stock ? (decVariant as any).stock + qty : 0,
            quantityAfter: (decVariant as any)?.stock || 0,
            reference: 'Customer Exchange',
            referenceId: saleId,
            notes: (notes || 'Given in customer exchange') + priceNote,
          });
        }
      }

      // 3. Process Store Credit if applicable
      if (settlementType === 'store_credit' && customerId && refundAmount > 0) {
        const { data: cust } = await supabase
          .from('customers')
          .select('creditBalance')
          .eq('id', customerId)
          .single();

        if (cust) {
          const currentCredit = Number((cust as any).creditBalance || 0);
          await supabase
            .from('customers')
            .update({ creditBalance: currentCredit + Number(refundAmount) })
            .eq('id', customerId);
        }
      }

      // 4. Update Original Sale Note / Status reference
      const { data: currentSale } = await supabase
        .from('sales')
        .select('notes, status')
        .eq('id', saleId)
        .single();

      if (currentSale) {
        const returnSummary = `[Return/Exchange: Refund ${settlementType.toUpperCase()} ${refundAmount}${additionalAmountPaid > 0 ? `, Additional Paid ${additionalAmountPaid}` : ''}]`;
        const updatedNotes = currentSale.notes
          ? `${currentSale.notes}\n${returnSummary}`
          : returnSummary;

        await supabase
          .from('sales')
          .update({ notes: updatedNotes })
          .eq('id', saleId);
      }

      return { success: true };
    } catch (error) {
      logger.error('processReturnOrExchange error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process return/exchange',
      };
    }
  });

  // ── sales:getReturnsBatch ──────────────────────────────────────────────────
  ipcMain.handle('sales:getReturnsBatch', async (_event, saleIds: string[]) => {
    try {
      if (!saleIds || saleIds.length === 0) return { success: true, data: {} };

      let rawItems: any[] = [];
      try {
        const { data } = await supabase
          .from('inventory_history')
          .select(
            '*, ' +
            'product:product_variant_flat(*), ' +
            'variant:product_variant(*, parent:product_variant_flat(*))'
          )
          .in('referenceId', saleIds);
        rawItems = data || [];
      } catch {}

      if (!rawItems || rawItems.length === 0) {
        const { data: raw } = await supabase
          .from('inventory_history')
          .select('*')
          .in('referenceId', saleIds);
        rawItems = (raw as any[]) || [];
      }

      // Filter relevant exchange / return references
      rawItems = (rawItems || []).filter((i: any) =>
        ['Customer Return', 'Customer Return (Damaged)', 'Customer Exchange'].includes(i.reference)
      );

      // Collect IDs for manual fallback maps
      const variantIds = Array.from(
        new Set(rawItems.map((i: any) => i.variant_id || i.variantId).filter(Boolean))
      );
      const productFlatIds = Array.from(
        new Set(rawItems.map((i: any) => i.productId || i.product_id || i.product_flat_id).filter(Boolean))
      );

      const variantMap: Record<string, any> = {};
      const productFlatMap: Record<string, any> = {};

      if (productFlatIds.length > 0) {
        const { data: flats } = await supabase
          .from('product_variant_flat')
          .select('*')
          .in('id', productFlatIds as string[]);
        (flats || []).forEach((f: any) => { productFlatMap[f.id] = f; });
      }

      if (variantIds.length > 0) {
        const { data: vars } = await supabase
          .from('product_variant')
          .select('*')
          .in('id', variantIds as string[]);

        if (vars && vars.length > 0) {
          const parentIds = Array.from(
            new Set(vars.map((v: any) => v.product_flat_id || v.productId || v.product_id).filter(Boolean))
          );
          if (parentIds.length > 0) {
            const missingParentIds = parentIds.filter(id => !productFlatMap[id]);
            if (missingParentIds.length > 0) {
              const { data: parents } = await supabase
                .from('product_variant_flat')
                .select('*')
                .in('id', missingParentIds as string[]);
              (parents || []).forEach((p: any) => { productFlatMap[p.id] = p; });
            }
          }
          vars.forEach((v: any) => {
            const parentId = v.product_flat_id || v.productId || v.product_id;
            variantMap[v.id] = {
              ...v,
              parent: productFlatMap[parentId] || null,
            };
          });
        }
      }

      // Group enriched items by saleId (referenceId)
      const returnsMap: Record<string, any[]> = {};
      for (const id of saleIds) returnsMap[id] = [];

      for (const item of rawItems) {
        const vId = item.variant_id || item.variantId;
        const pId = item.productId || item.product_id || item.product_flat_id;

        // Try embedded variant first, then manual variantMap, then productFlatMap
        let finalVariant = item.variant;
        if (!finalVariant || !finalVariant.parent) {
          if (vId && variantMap[vId]) {
            finalVariant = variantMap[vId];
          } else if (pId && productFlatMap[pId]) {
            finalVariant = {
              id: vId || pId,
              variant_name: 'Default',
              parent: productFlatMap[pId],
            };
          } else if (item.product) {
            finalVariant = {
              id: vId || pId,
              variant_name: 'Default',
              parent: item.product,
            };
          }
        }

        const enriched = {
          ...item,
          variant: finalVariant || null,
        };

        const refId = item.referenceId || item.reference_id;
        if (refId && returnsMap[refId]) {
          returnsMap[refId].push(enriched);
        }
      }

      return { success: true, data: returnsMap };
    } catch (error) {
      logger.error('getReturnsBatch error:', error);
      return { success: false, error: 'Failed to fetch returns batch' };
    }
  });
};
