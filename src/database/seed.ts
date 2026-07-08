import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/crypto';
import { ROLES, RESOURCES } from '../constants/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: ROLES.ADMIN },
    update: {},
    create: {
      name: ROLES.ADMIN,
      description: 'Full system access',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: ROLES.MANAGER },
    update: {},
    create: {
      name: ROLES.MANAGER,
      description: 'Manage operations and view reports',
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { name: ROLES.CASHIER },
    update: {},
    create: {
      name: ROLES.CASHIER,
      description: 'Process sales and manage customers',
    },
  });

  console.log('✅ Roles created');

  // Create Permissions for Admin (full access)
  const resources = Object.values(RESOURCES);
  for (const resource of resources) {
    const existing = await prisma.permission.findFirst({
      where: {
        roleId: adminRole.id,
        resource,
      },
    });

    if (!existing) {
      await prisma.permission.create({
        data: {
          roleId: adminRole.id,
          resource,
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        },
      });
    }
  }

  // Create Permissions for Manager
  const managerResources = [
    RESOURCES.DASHBOARD,
    RESOURCES.PRODUCTS,
    RESOURCES.CATEGORIES,
    RESOURCES.BRANDS,
    RESOURCES.UNITS,
    RESOURCES.SUPPLIERS,
    RESOURCES.CUSTOMERS,
    RESOURCES.PURCHASES,
    RESOURCES.SALES,
    RESOURCES.INVENTORY,
    RESOURCES.EXPENSES,
    RESOURCES.REPORTS,
  ];

  for (const resource of managerResources) {
    const existing = await prisma.permission.findFirst({
      where: {
        roleId: managerRole.id,
        resource,
      },
    });

    if (!existing) {
      await prisma.permission.create({
        data: {
          roleId: managerRole.id,
          resource,
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: false,
        },
      });
    }
  }

  // Create Permissions for Cashier
  const cashierResources = [
    { resource: RESOURCES.DASHBOARD, canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: RESOURCES.PRODUCTS, canCreate: false, canRead: true, canUpdate: false, canDelete: false },
    { resource: RESOURCES.CUSTOMERS, canCreate: true, canRead: true, canUpdate: true, canDelete: false },
    { resource: RESOURCES.SALES, canCreate: true, canRead: true, canUpdate: false, canDelete: false },
  ];

  for (const { resource, canCreate, canRead, canUpdate, canDelete } of cashierResources) {
    const existing = await prisma.permission.findFirst({
      where: {
        roleId: cashierRole.id,
        resource,
      },
    });

    if (!existing) {
      await prisma.permission.create({
        data: {
          roleId: cashierRole.id,
          resource,
          canCreate,
          canRead,
          canUpdate,
          canDelete,
        },
      });
    }
  }

  console.log('✅ Permissions created');

  // Create Default Users
  const hashedAdminPassword = await hashPassword('admin123');
  const hashedManagerPassword = await hashPassword('manager123');
  const hashedCashierPassword = await hashPassword('cashier123');

  await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      email: 'admin@system.com',
      password: hashedAdminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+1234567890',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'manager@system.com' },
    update: {},
    create: {
      email: 'manager@system.com',
      password: hashedManagerPassword,
      firstName: 'Store',
      lastName: 'Manager',
      phone: '+1234567891',
      roleId: managerRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'cashier@system.com' },
    update: {},
    create: {
      email: 'cashier@system.com',
      password: hashedCashierPassword,
      firstName: 'John',
      lastName: 'Cashier',
      phone: '+1234567892',
      roleId: cashierRole.id,
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Create Default Categories
  const electronics = await prisma.category.upsert({
    where: { id: 'electronics' },
    update: {},
    create: {
      id: 'electronics',
      name: 'Electronics',
      description: 'Electronic devices and accessories',
    },
  });

  await prisma.category.upsert({
    where: { id: 'computers' },
    update: {},
    create: {
      id: 'computers',
      name: 'Computers',
      description: 'Laptops, desktops, and accessories',
      parentId: electronics.id,
    },
  });

  await prisma.category.upsert({
    where: { id: 'clothing' },
    update: {},
    create: {
      id: 'clothing',
      name: 'Clothing',
      description: 'Apparel and fashion items',
    },
  });

  console.log('✅ Categories created');

  // Create Default Units
  await prisma.unit.upsert({
    where: { name: 'Piece' },
    update: {},
    create: {
      name: 'Piece',
      shortName: 'pcs',
    },
  });

  await prisma.unit.upsert({
    where: { name: 'Kilogram' },
    update: {},
    create: {
      name: 'Kilogram',
      shortName: 'kg',
    },
  });

  await prisma.unit.upsert({
    where: { name: 'Liter' },
    update: {},
    create: {
      name: 'Liter',
      shortName: 'L',
    },
  });

  console.log('✅ Units created');

  // Create Default Expense Categories
  await prisma.expenseCategory.upsert({
    where: { name: 'Rent' },
    update: {},
    create: {
      name: 'Rent',
      description: 'Monthly rent payments',
    },
  });

  await prisma.expenseCategory.upsert({
    where: { name: 'Utilities' },
    update: {},
    create: {
      name: 'Utilities',
      description: 'Electricity, water, internet',
    },
  });

  await prisma.expenseCategory.upsert({
    where: { name: 'Salaries' },
    update: {},
    create: {
      name: 'Salaries',
      description: 'Employee salaries and wages',
    },
  });

  console.log('✅ Expense categories created');

  // Create Default Settings
  const defaultSettings = [
    { key: 'business_name', value: 'My Business', category: 'business' },
    { key: 'business_email', value: 'business@example.com', category: 'business' },
    { key: 'business_phone', value: '+1234567890', category: 'business' },
    { key: 'business_address', value: '123 Main St', category: 'business' },
    { key: 'currency', value: 'USD', category: 'general' },
    { key: 'currency_symbol', value: '$', category: 'general' },
    { key: 'tax_rate', value: '10', category: 'general' },
    { key: 'invoice_prefix', value: 'INV', category: 'invoice' },
    { key: 'invoice_footer', value: 'Thank you for your business!', category: 'invoice' },
    { key: 'theme', value: 'light', category: 'appearance' },
    { key: 'auto_backup', value: 'true', category: 'backup' },
    { key: 'backup_interval', value: '24', category: 'backup' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Settings created');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
