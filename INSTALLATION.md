# Installation Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** (Download from https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Git** (optional, for version control)

## Step-by-Step Installation

### 1. Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install all required dependencies including:
- Electron
- React
- TypeScript
- Prisma
- Tailwind CSS
- And all other packages

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
copy .env.example .env
```

Open `.env` and configure as needed (default values should work for development).

### 3. Set Up the Database

Generate Prisma Client:

```bash
npm run prisma:generate
```

Create and migrate the database:

```bash
npm run prisma:migrate
```

When prompted for a migration name, you can use: `init`

Seed the database with default data:

```bash
node --loader ts-node/esm src/database/seed.ts
```

Or using ts-node directly:

```bash
npx ts-node src/database/seed.ts
```

### 4. Start Development Server

Run the application in development mode:

```bash
npm run dev
```

This will:
- Start the Vite development server (React frontend)
- Compile and run Electron

The application window should open automatically.

### 5. Login

Use one of the default credentials:

**Administrator:**
- Email: `admin@system.com`
- Password: `admin123`

**Manager:**
- Email: `manager@system.com`
- Password: `manager123`

**Cashier:**
- Email: `cashier@system.com`
- Password: `cashier123`

## Building for Production

### Build the Application

```bash
npm run build
```

### Create Windows Installer

```bash
npm run build:win
```

The installer will be created in the `release` directory.

## Troubleshooting

### Database Issues

If you encounter database errors:

1. Delete the database file:
   ```bash
   del prisma\dev.db
   ```

2. Re-run migrations:
   ```bash
   npm run prisma:migrate
   ```

3. Re-seed the database:
   ```bash
   npx ts-node src/database/seed.ts
   ```

### Prisma Client Not Found

If you get "Cannot find module '@prisma/client'":

```bash
npm run prisma:generate
```

### Port Already in Use

If port 5173 is already in use, the Vite dev server will automatically use the next available port.

### Electron Window Not Opening

1. Check the console for errors
2. Try deleting `node_modules` and reinstalling:
   ```bash
   rmdir /s /q node_modules
   npm install
   ```

## Development Tools

### Prisma Studio

To view and edit database contents visually:

```bash
npm run prisma:studio
```

This opens Prisma Studio in your browser at http://localhost:5555

### View Logs

Application logs are stored in the `logs` directory:
- `error.log` - Error logs only
- `combined.log` - All logs

## Next Steps

After successful installation:

1. Explore the Dashboard
2. Add your first product
3. Configure business settings
4. Set up users and roles
5. Start processing sales

## Support

For issues or questions:
- Check the logs in the `logs` directory
- Review the documentation in README.md
- Check existing issues on GitHub

## Updates

To update dependencies:

```bash
npm update
```

To check for outdated packages:

```bash
npm outdated
```
