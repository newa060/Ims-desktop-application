import { ipcMain } from 'electron';
import AuthService from '../../src/services/AuthService';
import logger from '../../src/utils/logger';

let currentUser: any = null;

export const setupAuthHandlers = () => {
  ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
    try {
      console.log('=== AUTH LOGIN ATTEMPT ===');
      console.log('Email:', email);
      console.log('Password length:', password?.length);
      console.log('DATABASE_URL:', process.env.DATABASE_URL);
      
      const user = await AuthService.login(email, password);

      console.log('Login result:', user ? 'SUCCESS' : 'FAILED');

      if (user) {
        currentUser = user;
        return { success: true, data: user };
      }

      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      console.error('Login handler error:', error);
      logger.error('Login handler error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      currentUser = null;
      return { success: true };
    } catch (error) {
      logger.error('Logout handler error:', error);
      return { success: false, error: 'Logout failed' };
    }
  });

  ipcMain.handle('auth:getCurrentUser', async () => {
    try {
      if (!currentUser) {
        return { success: false, error: 'No user logged in' };
      }

      return { success: true, data: currentUser };
    } catch (error) {
      logger.error('Get current user handler error:', error);
      return { success: false, error: 'Failed to get current user' };
    }
  });
};

export const getCurrentUser = () => currentUser;
