import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

let prisma: PrismaClient;

export const getPrismaClient = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });

    prisma.$on('warn' as never, (e: any) => {
      logger.warn('Prisma warning:', e);
    });

    prisma.$on('error' as never, (e: any) => {
      logger.error('Prisma error:', e);
    });
  }

  return prisma;
};

export const closeDatabaseConnection = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

export default getPrismaClient();
