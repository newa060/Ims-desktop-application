import UserRepository from '../repositories/UserRepository';
import { comparePassword } from '../utils/crypto';
import { User } from '../types';
import logger from '../utils/logger';

export class AuthService {
  async login(email: string, password: string): Promise<User | null> {
    try {
      console.log('AuthService.login called with email:', email);
      
      const user = await UserRepository.findByEmail(email);
      console.log('User found:', user ? 'YES' : 'NO');

      if (!user) {
        logger.warn(`Login attempt with non-existent email: ${email}`);
        console.log('User not found in database');
        return null;
      }

      console.log('User active:', user.isActive);
      if (!user.isActive) {
        logger.warn(`Login attempt with inactive user: ${email}`);
        return null;
      }

      console.log('Comparing passwords...');
      console.log('Password provided:', password);
      console.log('Hash in DB (first 20 chars):', user.password.substring(0, 20));
      
      const isPasswordValid = await comparePassword(password, user.password);
      console.log('Password valid:', isPasswordValid);

      if (!isPasswordValid) {
        logger.warn(`Invalid password attempt for user: ${email}`);
        return null;
      }

      await UserRepository.updateLastLogin(user.id);

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      logger.info(`Successful login for user: ${email}`);
      return userWithoutPassword as User;
    } catch (error) {
      console.error('Login error:', error);
      logger.error('Login error:', error);
      throw new Error('Authentication failed');
    }
  }

  async getCurrentUser(userId: string): Promise<User | null> {
    try {
      const user = await UserRepository.findById(userId);
      if (!user) return null;

      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as User;
    } catch (error) {
      logger.error('Get current user error:', error);
      throw error;
    }
  }

  checkPermission(
    user: User,
    resource: string,
    action: 'create' | 'read' | 'update' | 'delete'
  ): boolean {
    if (!user.role || !user.role.permissions) return false;

    const permission = user.role.permissions.find((p) => p.resource === resource);

    if (!permission) return false;

    switch (action) {
      case 'create':
        return permission.canCreate;
      case 'read':
        return permission.canRead;
      case 'update':
        return permission.canUpdate;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  }
}

export default new AuthService();
