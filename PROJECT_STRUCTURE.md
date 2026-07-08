# Project Structure

## Root Directory

```
inventory-management-system/
├── electron/                 # Electron main process
├── prisma/                   # Database schema and migrations
├── src/                      # Application source code
├── logs/                     # Application logs
├── backups/                  # Database backups
├── assets/                   # Static assets
├── dist/                     # Build output
├── release/                  # Production builds
├── node_modules/             # Dependencies
├── .env                      # Environment variables
├── .env.example              # Environment template
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind CSS config
├── vite.config.ts           # Vite bundler config
├── README.md                # Project documentation
├── INSTALLATION.md          # Installation guide
├── FEATURES.md              # Feature documentation
├── ARCHITECTURE.md          # Architecture details
└── PROJECT_STRUCTURE.md     # This file
```

## Electron Directory

```
electron/
├── main.ts                  # Electron main process entry
├── preload.ts               # Preload scripts
└── ipc/                     # IPC handlers
    ├── index.ts             # Handler registration
    ├── auth.ts              # Authentication
    ├── products.ts          # Product operations
    ├── sales.ts             # Sales operations
    ├── purchases.ts         # Purchase operations
    ├── customers.ts         # Customer management
    ├── suppliers.ts         # Supplier management
    ├── categories.ts        # Category management
    ├── brands.ts            # Brand management
    ├── units.ts             # Unit management
    ├── dashboard.ts         # Dashboard data
    ├── print.ts             # Printing functionality
    ├── backup.ts            # Backup and restore
    └── settings.ts          # Application settings
```

## Source Directory

```
src/
├── app/                     # Frontend application
│   ├── components/          # React components
│   │   ├── ui/             # UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   ├── common/         # Common components
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── Loader.tsx
│   │   │   └── ...
│   │   └── features/       # Feature-specific components
│   │       ├── products/
│   │       ├── sales/
│   │       └── ...
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useProducts.ts
│   │   ├── useSales.ts
│   │   └── ...
│   ├── layouts/            # Page layouts
│   │   ├── DashboardLayout.tsx
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── LoginPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── POSPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── ...
│   └── styles/             # Global styles
│       └── globals.css
│
├── services/               # Business logic layer
│   ├── AuthService.ts
│   ├── ProductService.ts
│   ├── SaleService.ts
│   ├── PurchaseService.ts
│   ├── DashboardService.ts
│   └── ...
│
├── repositories/           # Data access layer
│   ├── BaseRepository.ts
│   ├── ProductRepository.ts
│   ├── SaleRepository.ts
│   ├── PurchaseRepository.ts
│   ├── UserRepository.ts
│   └── ...
│
├── database/              # Database configuration
│   ├── client.ts          # Prisma client singleton
│   └── seed.ts            # Database seeding
│
├── types/                 # TypeScript type definitions
│   ├── index.ts           # Main types
│   └── electron.d.ts      # Electron API types
│
├── utils/                 # Utility functions
│   ├── helpers.ts         # General helpers
│   ├── date.ts            # Date utilities
│   ├── crypto.ts          # Encryption utilities
│   ├── logger.ts          # Logging configuration
│   └── validation.ts      # Validation schemas
│
├── constants/             # Application constants
│   ├── routes.ts          # Route definitions
│   ├── status.ts          # Status constants
│   └── permissions.ts     # Permission constants
│
├── config/                # Configuration files
│   └── ...
│
├── App.tsx                # Root React component
└── main.tsx               # React entry point
```

## Prisma Directory

```
prisma/
├── schema.prisma          # Database schema
├── migrations/            # Database migrations
│   └── ...
└── dev.db                 # SQLite database file (dev)
```

## Key File Purposes

### Configuration Files

- **package.json** - Project dependencies, scripts, and metadata
- **tsconfig.json** - TypeScript compiler configuration
- **tsconfig.node.json** - TypeScript config for Node.js files
- **tsconfig.electron.json** - TypeScript config for Electron
- **vite.config.ts** - Vite bundler configuration
- **tailwind.config.js** - Tailwind CSS customization
- **postcss.config.js** - PostCSS configuration
- **.eslintrc.cjs** - ESLint linting rules
- **.prettierrc** - Prettier code formatting
- **.env** - Environment variables (not in git)
- **.env.example** - Environment variable template
- **.gitignore** - Git ignore patterns

### Entry Points

- **index.html** - HTML entry point
- **src/main.tsx** - React application entry
- **src/App.tsx** - Root React component
- **electron/main.ts** - Electron main process entry
- **electron/preload.ts** - Electron preload scripts

### Core Files

- **src/database/client.ts** - Database connection singleton
- **src/database/seed.ts** - Database seeder
- **electron/ipc/index.ts** - IPC handler registration
- **src/app/hooks/useAuth.ts** - Authentication state management

## Component Organization

### UI Components (`src/app/components/ui/`)
Reusable, styled components from shadcn/ui library:
- Form elements (Button, Input, Label, etc.)
- Layout components (Card, Dialog, Tabs, etc.)
- Feedback components (Toast, Alert, etc.)

### Common Components (`src/app/components/common/`)
Application-wide shared components:
- ErrorBoundary - Error handling wrapper
- Loader - Loading indicators
- Header - Common header
- Footer - Common footer

### Feature Components (`src/app/components/features/`)
Feature-specific components grouped by module:
- `products/` - Product-related components
- `sales/` - Sales-related components
- `customers/` - Customer-related components

## Data Flow Architecture

```
UI Component
    ↓
Custom Hook (useProducts, useSales, etc.)
    ↓
Electron IPC Call (window.electron.*)
    ↓
IPC Handler (electron/ipc/*.ts)
    ↓
Service Layer (src/services/*.ts)
    ↓
Repository Layer (src/repositories/*.ts)
    ↓
Prisma ORM
    ↓
SQLite Database
```

## Module Dependencies

### Frontend Dependencies
- React - UI library
- React Router - Routing
- Tailwind CSS - Styling
- shadcn/ui - Component library
- Zustand - State management
- TanStack Query - Data fetching
- React Hook Form - Form handling
- Zod - Validation

### Backend Dependencies
- Electron - Desktop framework
- Prisma - ORM
- SQLite - Database
- bcryptjs - Password hashing
- Winston - Logging
- dotenv - Environment variables

### Development Dependencies
- TypeScript - Type safety
- Vite - Build tool
- ESLint - Linting
- Prettier - Code formatting
- Electron Builder - Packaging

## Build Output

### Development
- Vite dev server runs on port 5173
- Electron launches automatically
- Hot module replacement enabled

### Production Build
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── ...
└── electron/
    ├── main.js
    ├── preload.js
    └── ipc/
```

### Release Build
```
release/
├── win-unpacked/           # Unpacked Windows app
└── Setup.exe               # Windows installer
```

## Code Organization Best Practices

1. **Separation of Concerns** - Each layer has a single responsibility
2. **Modularity** - Features are self-contained modules
3. **Reusability** - Components and utilities are reusable
4. **Type Safety** - TypeScript types throughout
5. **Consistency** - Naming conventions and patterns
6. **Documentation** - Comments for complex logic
7. **Testing** - Each layer is testable independently

## Adding New Features

### To add a new module:

1. Create service in `src/services/`
2. Create repository in `src/repositories/`
3. Create IPC handler in `electron/ipc/`
4. Register handler in `electron/ipc/index.ts`
5. Add types to `src/types/index.ts`
6. Create page in `src/app/pages/`
7. Add route in `src/App.tsx`
8. Update navigation in `src/app/layouts/DashboardLayout.tsx`

This structure ensures maintainability, scalability, and ease of development.
