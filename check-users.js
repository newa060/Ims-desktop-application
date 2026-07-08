const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true
      }
    });
    
    console.log('Found users:', users.length);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role.name})`);
    });
    
    if (users.length === 0) {
      console.log('\n❌ No users found! Database needs to be seeded.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
