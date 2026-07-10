import { ipcMain } from 'electron';
import supabase from '../../src/database/supabaseClient';
import logger from '../../src/utils/logger';
import bcrypt from 'bcryptjs';

export const setupUserHandlers = () => {
  // users:getAll
  ipcMain.handle('users:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('users')
        .select('*, role:roles(id, name)', { count: 'exact' })
        .is('deletedAt', null);

      if (search) {
        query = query.or(
          `firstName.ilike.%${search}%,lastName.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const { data: users, error, count } = await query
        .order('createdAt', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        success: true,
        data: {
          data: users,
          pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
        },
      };
    } catch (error) {
      logger.error('Get users handler error:', error);
      return { success: false, error: 'Failed to fetch users' };
    }
  });

  // users:create
  ipcMain.handle('users:create', async (_event, data: any) => {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const { data: user, error } = await supabase
        .from('users')
        .insert({ ...data, password: hashedPassword })
        .select('id, firstName, lastName, email, phone, isActive, createdAt, role:roles(id, name)')
        .single();

      if (error) throw error;
      return { success: true, data: user };
    } catch (error) {
      logger.error('Create user handler error:', error);
      const msg = error instanceof Error && error.message.includes('duplicate key')
        ? 'Email already exists'
        : 'Failed to create user';
      return { success: false, error: msg };
    }
  });

  // users:update
  ipcMain.handle('users:update', async (_event, id: string, data: any) => {
    try {
      const updateData: any = { ...data };
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      } else {
        delete updateData.password;
      }

      const { data: user, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select('id, firstName, lastName, email, phone, isActive, createdAt, role:roles(id, name)')
        .single();

      if (error) throw error;
      return { success: true, data: user };
    } catch (error) {
      logger.error('Update user handler error:', error);
      return { success: false, error: 'Failed to update user' };
    }
  });

  // users:delete (soft delete)
  ipcMain.handle('users:delete', async (_event, id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ deletedAt: new Date().toISOString(), isActive: false })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      logger.error('Delete user handler error:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  });

  // roles:getAll
  ipcMain.handle('roles:getAll', async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .is('deletedAt', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      logger.error('Get roles handler error:', error);
      return { success: false, error: 'Failed to fetch roles' };
    }
  });
};
