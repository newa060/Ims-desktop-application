import { ipcMain } from 'electron';
import prisma from '../../src/database/client';
import logger from '../../src/utils/logger';
import bcrypt from 'bcryptjs';

export const setupUserHandlers = () => {
  // users:getAll
  ipcMain.handle('users:getAll', async (_event, params: any = {}) => {
    try {
      const { page = 1, limit = 20, search = '' } = params;
      const skip = (page - 1) * limit;
      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            role: { select: { id: true, name: true } },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        success: true,
        data: {
          data: users,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
      const user = await prisma.user.create({
        data: { ...data, password: hashedPassword },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, isActive: true, createdAt: true,
          role: { select: { id: true, name: true } },
        },
      });
      return { success: true, data: user };
    } catch (error) {
      logger.error('Create user handler error:', error);
      const msg = error instanceof Error && error.message.includes('Unique constraint')
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

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, isActive: true, createdAt: true,
          role: { select: { id: true, name: true } },
        },
      });
      return { success: true, data: user };
    } catch (error) {
      logger.error('Update user handler error:', error);
      return { success: false, error: 'Failed to update user' };
    }
  });

  // users:delete (soft delete)
  ipcMain.handle('users:delete', async (_event, id: string) => {
    try {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      return { success: true };
    } catch (error) {
      logger.error('Delete user handler error:', error);
      return { success: false, error: 'Failed to delete user' };
    }
  });

  // roles:getAll
  ipcMain.handle('roles:getAll', async () => {
    try {
      const roles = await prisma.role.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: roles };
    } catch (error) {
      logger.error('Get roles handler error:', error);
      return { success: false, error: 'Failed to fetch roles' };
    }
  });
};
