import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';

// `categories` here is a managed name list (with an optional parent/child
// hierarchy for organizing the admin UI) used to populate the product
// form's dropdown. products.category on the shared `products` table stays
// plain text either way — matching how the website already treats it —
// so this table's hierarchy is purely an IMS-side organizational aid.
export const setupCategoryHandlers = () => {
  ipcMain.handle('categories:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*, parent:categories!parentId(*)')
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get categories handler error:', error);
      return { success: false, error: 'Failed to fetch categories' };
    }
  });

  ipcMain.handle('categories:create', async (_event, data) => {
    try {
      const { data: category, error } = await supabase
        .from('categories')
        .insert({ name: data.name, description: data.description || null, parentId: data.parentId || null })
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: category };
    } catch (error) {
      logger.error('Create category handler error:', error);
      return { success: false, error: 'Failed to create category' };
    }
  });

  ipcMain.handle('categories:update', async (_event, id: string, data) => {
    try {
      const { data: category, error } = await supabase
        .from('categories')
        .update({ name: data.name, description: data.description || null, parentId: data.parentId || null })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      return { success: true, data: category };
    } catch (error) {
      logger.error('Update category handler error:', error);
      return { success: false, error: 'Failed to update category' };
    }
  });

  ipcMain.handle('categories:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete category handler error:', error);
      return { success: false, error: 'Failed to delete category' };
    }
  });
};
