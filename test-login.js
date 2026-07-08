const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@system.com' },
      include: { role: true }
    });
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found:', user.email);
    console.log('Role:', user.role.name);
    console.log('Active:', user.isActive);
    
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    console.log('\nPassword test:');
    console.log('Test password:', testPassword);
    console.log('Match result:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (!isValid) {
      console.log('\n⚠️ Password mismatch! Rehashing...');
      const newHash = await bcrypt.hash(testPassword, 10);
      await prisma.user.update({
        where: { email: 'admin@system.com' },
        data: { password: newHash }
      });
      console.log('✅ Password updated. Try logging in again.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
