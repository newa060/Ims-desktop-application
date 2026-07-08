# Quick Start Guide

Get up and running in 5 minutes!

## Prerequisites

✅ Node.js 18+ installed  
✅ npm or yarn installed

## Installation (5 steps)

### 1️⃣ Install Dependencies
```bash
npm install
```
⏱️ Takes 2-3 minutes

### 2️⃣ Setup Environment
```bash
copy .env.example .env
```

### 3️⃣ Generate Database
```bash
npm run prisma:generate
npm run prisma:migrate
```
When prompted for migration name: `init`

### 4️⃣ Seed Database
```bash
npx ts-node src/database/seed.ts
```

### 5️⃣ Start Application
```bash
npm run dev
```

🎉 Application opens automatically!

## Login Credentials

### 👨‍💼 Administrator
- Email: `admin@system.com`
- Password: `admin123`
- Access: Full system control

### 👔 Manager
- Email: `manager@system.com`
- Password: `manager123`
- Access: Operations & reports

### 💰 Cashier
- Email: `cashier@system.com`
- Password: `cashier123`
- Access: POS & sales only

## First Steps

1. **Explore Dashboard** - See overview and stats
2. **Add Categories** - Create product categories
3. **Add Products** - Add your first products
4. **Try POS** - Make a test sale
5. **View Reports** - Check sales reports

## Common Commands

### Development
```bash
npm run dev              # Start development mode
npm run prisma:studio    # Open database GUI
```

### Database
```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
```

### Production
```bash
npm run build            # Build application
npm run build:win        # Create Windows installer
```

## Troubleshooting

### Database Error?
```bash
del prisma\dev.db
npm run prisma:migrate
npx ts-node src/database/seed.ts
```

### Dependencies Error?
```bash
rmdir /s /q node_modules
npm install
```

### Port Busy?
Vite will automatically use next available port (5174, 5175, etc.)

## Need Help?

📚 Read [INSTALLATION.md](INSTALLATION.md) for detailed setup  
🏗️ Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design  
✨ See [FEATURES.md](FEATURES.md) for complete feature list  
📁 Review [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for code organization

## Next Steps

- Configure business settings in Settings page
- Add users and assign roles
- Import your existing product data
- Customize invoice templates
- Setup automatic backups

Happy selling! 🚀
