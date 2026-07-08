# 📖 User Guide

## Welcome to Inventory Management System!

This guide will help you understand and use all features of the system.

---

## 🚀 Getting Started

### First Login

1. Launch the application
2. You'll see the login screen
3. Use default credentials:
   - **Admin**: admin@system.com / admin123
   - **Manager**: manager@system.com / manager123  
   - **Cashier**: cashier@system.com / cashier123
4. Click "Sign In"

### After Login

You'll see the **Dashboard** with:
- Business statistics
- Sales overview
- Stock alerts
- Quick actions

---

## 👥 User Roles & Permissions

### 🔑 Administrator
**Full system access**
- Manage all modules
- Configure settings
- Manage users and roles
- Access all reports
- Backup and restore

### 📊 Manager
**Operations and reporting**
- View dashboard
- Manage products
- Process purchases
- View all reports
- Manage customers/suppliers
- Cannot delete users or change roles

### 💰 Cashier
**Sales focused**
- Access POS system
- Process sales
- View products (read-only)
- Add/edit customers
- Cannot access settings or reports

---

## 🏠 Dashboard

### Overview Cards

**Total Products**
- Shows count of all active products
- Click to view product list

**Low Stock Items**
- Products below minimum stock level
- Yellow warning indicator
- Click to view list

**Out of Stock**
- Products with zero stock
- Red alert indicator
- Requires immediate attention

**Monthly Sales**
- Total sales revenue for current month
- Comparison with previous month

### Charts & Analytics

**Sales Trend**
- 7-day or 30-day sales chart
- Shows daily sales and profit
- Hover for detailed values

**Top Products**
- Best-selling products
- Quantity sold
- Revenue generated

**Recent Transactions**
- Latest sales and purchases
- Quick access to details

---

## 📦 Product Management

### Adding a Product

1. Click **"Products"** in sidebar
2. Click **"Add Product"** button
3. Fill in details:
   - **Name**: Product name
   - **SKU**: Auto-generated or manual
   - **Barcode**: Optional
   - **Category**: Select from dropdown
   - **Brand**: Select from dropdown
   - **Unit**: Piece, kg, liter, etc.
   - **Purchase Price**: Cost from supplier
   - **Selling Price**: Price to customer
   - **Wholesale Price**: Optional bulk price
   - **Tax Rate**: Percentage (e.g., 10%)
   - **Minimum Stock**: Low stock alert threshold
   - **Current Stock**: Initial quantity
   - **Status**: Active/Inactive/Discontinued
4. Click **"Save"**

### Editing a Product

1. Find product in list
2. Click on product row
3. Update information
4. Click **"Save Changes"**

### Searching Products

- Use search box at top
- Search by name, SKU, or barcode
- Results filter instantly

### Filtering Products

- Filter by category
- Filter by brand
- Filter by status
- Combine multiple filters

---

## 🏪 Point of Sale (POS)

### Processing a Sale

1. Click **"POS"** in sidebar
2. Search for products:
   - Type product name
   - Scan barcode
   - Select from list
3. Products add to cart
4. Adjust quantities if needed
5. Cart shows:
   - Subtotal
   - Tax
   - Grand Total
6. Click **"Complete Sale"**
7. Select payment method
8. Enter amount received
9. System calculates change
10. Print receipt

### Cart Management

**Add Item**
- Click product or scan barcode

**Update Quantity**
- Use +/- buttons
- Type quantity directly

**Remove Item**
- Click trash icon

**Apply Discount**
- Click discount button
- Enter amount or percentage

### Payment Methods

- Cash
- Credit Card
- Debit Card
- Bank Transfer
- Mobile Payment

---

## 📊 Inventory Management

### Stock Adjustment

When you need to correct stock manually:

1. Go to **Inventory > Adjustment**
2. Select product
3. Choose type:
   - **Add**: Increase stock
   - **Subtract**: Decrease stock
   - **Set**: Set exact amount
4. Enter quantity
5. Select reason:
   - Damage
   - Loss
   - Found
   - Correction
6. Add notes (optional)
7. Click **"Save"**

### Viewing Inventory

**Current Stock**
- View all products
- See current quantities
- Color-coded status
  - Green: Adequate stock
  - Yellow: Low stock
  - Red: Out of stock

**Stock History**
- View all stock movements
- Filter by product
- Filter by date
- See transaction reference

### Stock Alerts

**Low Stock Alert**
- Yellow warning badge
- Shows when stock ≤ minimum
- Desktop notification

**Out of Stock Alert**
- Red alert badge
- Shows when stock = 0
- Urgent attention needed

---

## 💰 Purchase Management

### Creating Purchase Order

1. Click **"Purchases"**
2. Click **"New Purchase"**
3. Select supplier
4. Add products to order
5. Enter quantities
6. Enter unit prices
7. System calculates totals
8. Add notes if needed
9. Click **"Save Purchase"**
10. Mark as "Received" when goods arrive
11. Stock automatically updates

### Purchase Details

Each purchase includes:
- Purchase number (auto-generated)
- Supplier information
- Purchase date
- Due date (optional)
- Items with quantities and prices
- Subtotal, tax, discount
- Total amount
- Payment status
- Notes

---

## 👤 Customer Management

### Adding a Customer

1. Click **"Customers"**
2. Click **"Add Customer"**
3. Fill in information:
   - Name (required)
   - Email
   - Phone (required)
   - Address
   - City
   - Country
   - Tax Number
   - Credit Limit
4. Click **"Save"**

### Customer Features

**Purchase History**
- View all customer orders
- Total spent
- Last purchase date

**Credit Balance**
- Track outstanding payments
- Set credit limits
- Payment reminders

**Loyalty Points**
- Automatic point accumulation
- Reward programs
- Redemption tracking

---

## 🏭 Supplier Management

### Adding a Supplier

Similar to customers, but includes:
- Company name
- Contact person
- Payment terms
- Tax registration
- Credit limit

### Supplier Features

**Purchase History**
- All purchases from supplier
- Total spent
- Payment status

**Outstanding Balance**
- Track pending payments
- Payment schedules
- Credit tracking

---

## 📈 Reports

### Sales Reports

**Daily Sales**
- Today's sales summary
- Product-wise breakdown
- Payment method summary

**Monthly Sales**
- Month-to-date sales
- Comparison with previous month
- Trend analysis

**Sales by Product**
- Best sellers
- Slow-moving items
- Profitability analysis

**Sales by Customer**
- Top customers
- Purchase frequency
- Total spending

### Inventory Reports

**Current Stock**
- All products and quantities
- Stock valuation
- Category-wise summary

**Low Stock**
- Products needing reorder
- Reorder quantity suggestions
- Priority listing

**Out of Stock**
- Unavailable products
- Sales impact
- Urgent reorders

**Stock Movement**
- Inward and outward movement
- Period-wise analysis
- Product-wise history

### Financial Reports

**Profit & Loss**
- Revenue summary
- Cost of goods sold
- Operating expenses
- Net profit

**Purchase Report**
- Total purchases
- Supplier-wise summary
- Payment status
- Outstanding amounts

**Expense Report**
- Category-wise expenses
- Period comparison
- Budget vs actual

### Exporting Reports

1. Generate desired report
2. Click **"Export"** button
3. Choose format:
   - PDF (for printing/sharing)
   - Excel (for analysis)
   - CSV (for import elsewhere)

---

## ⚙️ Settings

### Business Information

Configure your business details:
- Business name
- Email address
- Phone number
- Physical address
- Tax registration number
- Logo (optional)

### General Settings

**Currency**
- Currency code (USD, EUR, etc.)
- Currency symbol ($, €, etc.)
- Decimal places

**Tax**
- Default tax rate
- Tax registration number
- Tax calculation method

**Date & Time**
- Date format
- Time format
- Timezone

### Invoice Settings

**Numbering**
- Invoice prefix (INV, SALE, etc.)
- Starting number
- Number format

**Template**
- Company logo
- Header text
- Footer text
- Terms and conditions

**Layout**
- Invoice template design
- Print size (A4, Letter, Thermal)

### Backup Settings

**Automatic Backup**
- Enable/disable
- Frequency (daily, weekly)
- Time of day
- Retention period

**Manual Backup**
- Create backup now
- View backup history
- Restore from backup

---

## 🖨️ Printing

### Invoice Printing

1. Complete a sale
2. Click **"Print Invoice"**
3. Preview appears
4. Adjust print settings if needed
5. Click **"Print"**

### Receipt Printing

For thermal printers:
- Compact format
- Essential details only
- Fast printing
- Customer copy

### Barcode Printing

(Feature structure ready, implementation pending)
- Generate product barcodes
- Print labels
- Batch printing

---

## 💾 Backup & Restore

### Creating a Backup

**Manual Backup:**
1. Go to **Settings > Backup**
2. Click **"Create Backup Now"**
3. Backup saved to `backups/` folder
4. Note the filename for future reference

**Automatic Backup:**
1. Go to **Settings > Backup**
2. Enable **"Automatic Backup"**
3. Set frequency (24 hours recommended)
4. System creates backups automatically

### Restoring from Backup

⚠️ **Warning**: This will replace current data!

1. Go to **Settings > Backup**
2. Click **"Restore Backup"**
3. Select backup file
4. Confirm restoration
5. Application restarts automatically
6. Data restored successfully

### Backup Best Practices

- Create backup before major changes
- Keep multiple backup copies
- Store backups in safe location
- Test restore process periodically
- Export important data regularly

---

## 🔔 Notifications

### Types of Notifications

**Low Stock Alert**
- When product reaches minimum level
- Shows product name and current stock
- Action: Reorder product

**Out of Stock Alert**
- When product stock reaches zero
- Urgent notification
- Action: Immediate reorder

**Backup Reminder**
- Reminds to create backup
- Configurable frequency
- Action: Create backup

**System Messages**
- Updates and announcements
- Maintenance notices
- Error alerts

### Managing Notifications

- View all notifications in notification panel
- Mark as read/unread
- Clear old notifications
- Configure notification preferences

---

## 🔍 Search & Filters

### Global Search

- Available in most modules
- Searches multiple fields
- Instant results
- Highlights matches

### Advanced Filters

**Products**
- By category
- By brand
- By status
- By stock level
- By price range

**Sales**
- By date range
- By customer
- By payment method
- By status

**Customers**
- By location
- By total spending
- By last purchase date

---

## ⌨️ Keyboard Shortcuts

### Global Shortcuts

- `Ctrl + S` - Save current form
- `Ctrl + F` - Focus search box
- `Esc` - Close dialog/modal
- `F5` - Refresh current page

### POS Shortcuts

- `F2` - New sale
- `F4` - Search product
- `F12` - Complete sale
- `Del` - Remove selected item

*(Configure more shortcuts in Settings)*

---

## 🆘 Troubleshooting

### Common Issues

**Can't Login**
- Verify credentials
- Check internet connection
- Contact administrator

**Product Not Found in POS**
- Check product is active
- Verify barcode is correct
- Try searching by name

**Report Not Loading**
- Wait for large data to load
- Check date range is reasonable
- Refresh the page

**Backup Failed**
- Check disk space
- Verify backup folder exists
- Check file permissions

### Getting Help

1. Check this User Guide
2. Review other documentation
3. Check error logs
4. Contact support
5. Report bug on GitHub

---

## 💡 Tips & Best Practices

### Product Management

✅ Use clear, descriptive product names  
✅ Always set minimum stock levels  
✅ Keep product images updated  
✅ Use consistent SKU format  
✅ Regular stock audits  

### POS Operations

✅ Train staff on barcode scanning  
✅ Keep most-sold items easily accessible  
✅ Count cash drawer at shift start/end  
✅ Print receipts for all transactions  
✅ Handle returns properly  

### Inventory Control

✅ Conduct regular physical counts  
✅ Investigate discrepancies immediately  
✅ Set realistic minimum stock levels  
✅ Track seasonal variations  
✅ Maintain proper stock rotation  

### Data Security

✅ Create daily backups  
✅ Use strong passwords  
✅ Change passwords regularly  
✅ Restrict access by role  
✅ Monitor activity logs  

### Reporting

✅ Generate reports regularly  
✅ Compare with previous periods  
✅ Act on insights promptly  
✅ Share reports with stakeholders  
✅ Keep report archive  

---

## 📞 Support

### Need Help?

**Documentation**
- User Guide (this file)
- Installation Guide
- Quick Start Guide
- Feature Documentation

**Technical Support**
- Check logs in `logs/` folder
- Review error messages
- Contact system administrator

**Community**
- GitHub Discussions
- Issue Tracker
- FAQ Section

---

## 🎓 Training Resources

### For New Users

1. Read Quick Start Guide
2. Watch demo videos (if available)
3. Practice with sample data
4. Follow this User Guide
5. Ask questions

### For Administrators

1. Read all documentation
2. Understand architecture
3. Review security settings
4. Test backup/restore
5. Train other users

---

## 🎉 You're Ready!

You now know how to use all major features of the Inventory Management System!

**Remember:**
- Start with sample data
- Explore at your own pace
- Use help when needed
- Backup regularly
- Report issues promptly

**Happy managing!** 🚀📦

---

*For more detailed technical information, see DEVELOPMENT_GUIDE.md*
