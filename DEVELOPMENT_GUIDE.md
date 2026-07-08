# Development Guide

## Development Workflow

### Starting Development

1. **Start the application:**
   ```bash
   npm run dev
   ```
   This starts both Vite dev server and Electron

2. **Access Prisma Studio (Database GUI):**
   ```bash
   npm run prisma:studio
   ```
   Opens at http://localhost:5555

### Code Style

- **TypeScript** - Strict mode enabled
- **ESLint** - Linting rules configured
- **Prettier** - Code formatting

Run linting:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

### Project Standards

#### Naming Conventions

**Files:**
- Components: PascalCase (e.g., `ProductCard.tsx`)
- Hooks: camelCase with 'use' prefix (e.g., `useAuth.ts`)
- Services: PascalCase with Service suffix (e.g., `ProductService.ts`)
- Utilities: camelCase (e.g., `helpers.ts`)

**Code:**
- Variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Types/Interfaces: PascalCase
- Functions: camelCase

#### Component Structure

```typescript
// Imports
import { useState } from 'react';
import { Button } from '../ui/button';

// Types/Interfaces
interface ProductCardProps {
  product: Product;
}

// Component
export const ProductCard = ({ product }: ProductCardProps) => {
  // State
  const [loading, setLoading] = useState(false);
  
  // Handlers
  const handleClick = () => {
    // logic
  };
  
  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

#### Service Pattern

```typescript
import Repository from '../repositories/Repository';
import logger from '../utils/logger';

export class MyService {
  async getItems() {
    try {
      return await Repository.findAll();
    } catch (error) {
      logger.error('Get items error:', error);
      throw new Error('Failed to fetch items');
    }
  }
}

export default new MyService();
```

### Database Changes

#### Creating a Migration

1. Update `prisma/schema.prisma`
2. Run migration:
   ```bash
   npm run prisma:migrate
   ```
3. Name the migration descriptively (e.g., `add_supplier_email`)

#### Seeding Data

Edit `src/database/seed.ts` and run:
```bash
npx ts-node src/database/seed.ts
```

### Adding New Features

#### 1. Add Database Model

Edit `prisma/schema.prisma`:
```prisma
model Product {
  id        String   @id @default(uuid())
  name      String
  price     Float
  createdAt DateTime @default(now())
}
```

Run migration:
```bash
npm run prisma:migrate
```

#### 2. Create Repository

Create `src/repositories/ProductRepository.ts`:
```typescript
import { BaseRepository } from './BaseRepository';

export class ProductRepository extends BaseRepository<Product> {
  protected getModelName(): string {
    return 'product';
  }
  
  // Custom queries
  async findByName(name: string) {
    return this.prisma.product.findFirst({ where: { name } });
  }
}

export default new ProductRepository();
```

#### 3. Create Service

Create `src/services/ProductService.ts`:
```typescript
import ProductRepository from '../repositories/ProductRepository';

export class ProductService {
  async getProducts() {
    return await ProductRepository.findAll();
  }
  
  async createProduct(data: any) {
    return await ProductRepository.create(data);
  }
}

export default new ProductService();
```

#### 4. Create IPC Handler

Create `electron/ipc/products.ts`:
```typescript
import { ipcMain } from 'electron';
import ProductService from '../../src/services/ProductService';

export const setupProductHandlers = () => {
  ipcMain.handle('products:getAll', async () => {
    try {
      const products = await ProductService.getProducts();
      return { success: true, data: products };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};
```

Register in `electron/ipc/index.ts`:
```typescript
import { setupProductHandlers } from './products';

export const setupIpcHandlers = () => {
  setupProductHandlers();
  // ... other handlers
};
```

#### 5. Add to Preload

Update `electron/preload.ts`:
```typescript
contextBridge.exposeInMainWorld('electron', {
  getProducts: () => ipcRenderer.invoke('products:getAll'),
  // ... other methods
});
```

#### 6. Create React Hook

Create `src/app/hooks/useProducts.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await window.electron.getProducts();
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error);
    },
  });
};
```

#### 7. Create Page Component

Create `src/app/pages/ProductsPage.tsx`:
```typescript
import { useProducts } from '../hooks/useProducts';

const ProductsPage = () => {
  const { data: products, isLoading } = useProducts();
  
  return (
    <div>
      {isLoading ? 'Loading...' : products.map(/* ... */)}
    </div>
  );
};

export default ProductsPage;
```

#### 8. Add Route

Update `src/App.tsx`:
```typescript
<Route path="/products" element={<ProductsPage />} />
```

### Testing

#### Manual Testing Checklist

- [ ] Test in development mode
- [ ] Test all CRUD operations
- [ ] Test validation
- [ ] Test error handling
- [ ] Test edge cases
- [ ] Test with different roles
- [ ] Check console for errors
- [ ] Check database changes

#### Database Testing

Use Prisma Studio to:
- Verify data is saved correctly
- Check relationships
- Validate constraints
- Inspect generated data

### Debugging

#### Frontend Debugging

1. Open DevTools in Electron window (Ctrl+Shift+I)
2. Check Console tab for errors
3. Use React DevTools for component inspection
4. Check Network tab for API calls

#### Backend Debugging

1. Check `logs/error.log` for errors
2. Check `logs/combined.log` for all logs
3. Add console.log or logger statements
4. Use Prisma Studio to inspect database

#### Common Issues

**Problem:** Prisma client not found  
**Solution:** 
```bash
npm run prisma:generate
```

**Problem:** Database locked  
**Solution:** Close all connections, restart app

**Problem:** IPC handler not responding  
**Solution:** Check handler registration in `electron/ipc/index.ts`

### Performance Optimization

#### Frontend
- Use React.memo for expensive components
- Implement virtualization for long lists
- Lazy load routes
- Optimize images

#### Backend
- Add database indexes
- Use pagination
- Implement caching
- Batch operations

#### Database
```prisma
model Product {
  id   String @id
  name String
  
  @@index([name]) // Add index for faster searches
}
```

### Security Best Practices

1. **Never store passwords in plain text**
   - Always use bcrypt
   
2. **Validate all inputs**
   - Use Zod schemas
   
3. **Sanitize database queries**
   - Prisma handles this automatically
   
4. **Check permissions**
   - In service layer
   
5. **Log security events**
   - Failed logins
   - Permission denials

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/product-images

# Make changes and commit
git add .
git commit -m "feat: add product image support"

# Push to remote
git push origin feature/product-images

# Create pull request on GitHub
```

### Commit Message Convention

```
feat: add new feature
fix: bug fix
docs: documentation changes
style: code style changes
refactor: code refactoring
test: add tests
chore: maintenance tasks
```

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] No console.logs in production code
- [ ] Error handling implemented
- [ ] Types properly defined
- [ ] No hardcoded values
- [ ] Comments for complex logic
- [ ] No unused imports/variables
- [ ] Proper logging
- [ ] Security considerations

### Deployment

#### Building for Production

```bash
# Build application
npm run build

# Create installer
npm run build:win
```

Output in `release/` directory.

#### Pre-deployment Checklist

- [ ] Update version in package.json
- [ ] Test all features
- [ ] Check for console errors
- [ ] Verify database migrations
- [ ] Test with production build
- [ ] Create backup
- [ ] Update documentation
- [ ] Tag release in git

### Documentation

When adding features, update:
- README.md (if user-facing)
- FEATURES.md (feature list)
- This file (if developer-facing)
- Code comments (complex logic)

### Getting Help

- Check existing documentation
- Review similar implementations
- Check error logs
- Search issues on GitHub
- Ask in project discussions

Happy coding! 🚀
