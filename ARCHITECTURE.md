# System Architecture

## Overview

The Inventory Management System follows a clean, layered architecture pattern that separates concerns and promotes maintainability, testability, and scalability.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│         Presentation Layer (React)              │
│  - Components, Pages, Layouts                   │
│  - User Interface Logic                         │
└─────────────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│      Application Layer (React Hooks)            │
│  - State Management (Zustand)                   │
│  - Data Fetching (TanStack Query)               │
│  - Form Handling (React Hook Form)              │
└─────────────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│         IPC Layer (Electron IPC)                │
│  - Inter-Process Communication                  │
│  - Request/Response Handling                    │
└─────────────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│       Business Logic Layer (Services)           │
│  - Business Rules                               │
│  - Data Validation                              │
│  - Transaction Management                       │
└─────────────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│      Data Access Layer (Repositories)           │
│  - Database Operations                          │
│  - Query Construction                           │
│  - Data Mapping                                 │
└─────────────────────────────────────────────────┘
                    ↓ ↑
┌─────────────────────────────────────────────────┐
│         Database Layer (SQLite + Prisma)        │
│  - Data Persistence                             │
│  - Schema Management                            │
└─────────────────────────────────────────────────┘
```

## Layer Details

### 1. Presentation Layer

**Location:** `src/app/`

**Responsibilities:**
- Render UI components
- Handle user interactions
- Display data
- Navigate between views

**Technology Stack:**
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components

**Key Components:**
- **Pages:** Full page views
- **Layouts:** Page structure and navigation
- **Components:** Reusable UI elements
- **Features:** Feature-specific component groups

### 2. Application Layer

**Location:** `src/app/hooks/`

**Responsibilities:**
- Manage application state
- Handle data fetching and caching
- Form validation and submission
- Side effects coordination

**Technology Stack:**
- Zustand (State Management)
- TanStack Query (Data Fetching)
- React Hook Form (Forms)
- Zod (Validation)

**Key Hooks:**
- `useAuth` - Authentication state
- `useProduct` - Product operations
- `useSale` - Sales operations
- `useDashboard` - Dashboard data

### 3. IPC Layer

**Location:** `electron/ipc/`

**Responsibilities:**
- Bridge renderer and main processes
- Handle async communications
- Error handling and response formatting
- Security validation

**Key Handlers:**
- `auth.ts` - Authentication operations
- `products.ts` - Product CRUD
- `sales.ts` - Sales processing
- `dashboard.ts` - Analytics data

### 4. Business Logic Layer

**Location:** `src/services/`

**Responsibilities:**
- Implement business rules
- Coordinate between repositories
- Transaction management
- Data transformation
- Complex calculations

**Key Services:**
- `AuthService` - Login, permissions
- `ProductService` - Product logic
- `SaleService` - Sales processing
- `DashboardService` - Analytics

**Design Principles:**
- Single Responsibility
- Dependency Injection
- Interface Segregation

### 5. Data Access Layer

**Location:** `src/repositories/`

**Responsibilities:**
- Database queries
- Data mapping
- Pagination
- Filtering and sorting

**Pattern:** Repository Pattern

**Key Repositories:**
- `BaseRepository` - Common operations
- `ProductRepository` - Product queries
- `SaleRepository` - Sale queries
- `UserRepository` - User queries

### 6. Database Layer

**Location:** `prisma/`

**Responsibilities:**
- Data persistence
- Schema management
- Migrations
- Data integrity

**Technology:**
- SQLite (Local database)
- Prisma ORM (Type-safe queries)

## Data Flow

### Read Operation Example (Product List)

```
User clicks "Products" page
         ↓
ProductsPage component loads
         ↓
useProducts hook fetches data
         ↓
window.electron.getProducts() IPC call
         ↓
products.ts IPC handler receives request
         ↓
ProductService.getProducts() called
         ↓
ProductRepository.findAllWithPagination() queries DB
         ↓
Prisma executes SQL query
         ↓
Data flows back up through layers
         ↓
UI updates with product list
```

### Write Operation Example (Create Sale)

```
User fills POS form and clicks "Complete Sale"
         ↓
Form validation (Zod schema)
         ↓
POSPage calls window.electron.createSale()
         ↓
sales.ts IPC handler receives request
         ↓
SaleService.createSale() validates business rules
         ↓
Prisma transaction begins
         ↓
Sale record created
Sale items created
Product stock updated
Inventory history logged
         ↓
Transaction committed
         ↓
Success response flows back
         ↓
UI shows confirmation
```

## Design Patterns

### 1. Repository Pattern
Abstracts data access logic, making it easy to switch databases or add caching.

### 2. Service Layer Pattern
Encapsulates business logic, keeping it separate from UI and data access.

### 3. Dependency Injection
Services and repositories are injected as dependencies, not tightly coupled.

### 4. Observer Pattern
React hooks observe state changes and re-render components.

### 5. Factory Pattern
Used in generating SKUs, invoice numbers, and other identifiers.

## Security Architecture

### Authentication Flow
1. User enters credentials
2. Password hashed and compared
3. Session token generated
4. User data stored in Zustand
5. Token persisted to localStorage
6. All requests include authentication check

### Authorization
- Role-based access control (RBAC)
- Permission checking in service layer
- UI elements hidden based on permissions
- API endpoints validate permissions

### Data Security
- Passwords hashed with bcrypt
- SQL injection prevented by Prisma
- Input validation with Zod
- XSS protection via React

## Error Handling

### Error Flow
```
Error occurs in any layer
         ↓
Error caught and logged
         ↓
User-friendly message generated
         ↓
Error propagated to presentation layer
         ↓
Toast notification shown
```

### Error Types
- Validation errors (400-level)
- Business logic errors (custom)
- Database errors (500-level)
- Network errors (connectivity)

## Logging Strategy

### Log Levels
- **Error:** System failures, exceptions
- **Warn:** Deprecations, suspicious activity
- **Info:** Important events, state changes
- **Debug:** Detailed diagnostic information

### Log Locations
- Console (development)
- File system (`logs/` directory)
- Error log: `logs/error.log`
- Combined log: `logs/combined.log`

## Future Architecture Enhancements

### Microservices Preparation
The layered architecture allows easy extraction of services into microservices.

### API Layer
Add RESTful API layer above service layer for external integrations.

### Caching Layer
Add Redis or similar between service and repository layers.

### Message Queue
Add message queue for asynchronous operations (email, reports, sync).

### Cloud Sync Layer
Add synchronization service to sync with cloud backend.

```
Local Database → Sync Queue → Cloud API → Cloud Database
```

## Performance Considerations

### Database
- Indexed frequently queried columns
- Soft deletes for data retention
- Pagination for large datasets

### Frontend
- Code splitting by route
- Lazy loading components
- React.memo for expensive renders
- Virtualization for long lists

### Backend
- Connection pooling (Prisma)
- Query optimization
- Batch operations where possible

## Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Validation schemas

### Integration Tests
- Repository layer
- IPC handlers
- Service + Repository

### E2E Tests
- Complete user workflows
- Multi-step processes
- Error scenarios

## Scalability

### Horizontal Scaling (Future)
- Add API gateway
- Load balance multiple instances
- Shared database or database sharding

### Vertical Scaling
- Optimize queries
- Add database indexes
- Implement caching

The current architecture supports both scaling strategies without major refactoring.
