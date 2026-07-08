// Run this to debug authentication
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function debugAuth() {
  try {
    console.log('\n=== Testing Authentication ===\n');
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: 'admin@system.com' },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    if (!user) {
      console.log('❌ User admin@system.com not found!');
      console.log('\nRun this to create user:');
      console.log('node seed.js');
      return;
    }
    
    console.log('✅ User found:');
    console.log('  Email:', user.email);
    console.log('  Name:', user.firstName, user.lastName);
    console.log('  Role:', user.role.name);
    console.log('  Active:', user.isActive);
    console.log('  Has password hash:', user.password ? 'Yes' : 'No');
    
    // Test password
    const testPassword = 'admin123';
    console.log('\nTesting password:', testPassword);
    
    const isValid = await bcrypt.compare(testPassword, user.password);
    console.log('Password valid:', isValid ? '✅ YES' : '❌ NO');
    
    if (!isValid) {
      console.log('\n⚠️  Password is invalid. Resetting to: admin123');
      const newHash = await bcrypt.hash('admin123', 10);
      await prisma.user.update({
        where: { email: 'admin@system.com' },
        data: { password: newHash }
      });
      console.log('✅ Password reset complete!');
    }
    
    // Simulate login process
    console.log('\n=== Simulating Login Process ===\n');
    
    const loginUser = await prisma.user.findUnique({
      where: { email: 'admin@system.com' },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });
    
    if (!loginUser) {
      console.log('❌ User not found during login simulation');
      return;
    }
    
    if (!loginUser.isActive) {
      console.log('❌ User is not active');
      return;
    }
    
    const passwordMatch = await bcrypt.compare('admin123', loginUser.password);
    if (!passwordMatch) {
      console.log('❌ Password does not match');
      return;
    }
    
    console.log('✅ Login simulation successful!');
    console.log('\nUser data that would be returned:');
    const { password, ...userWithoutPassword } = loginUser;
    console.log(JSON.stringify(userWithoutPassword, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuth();
