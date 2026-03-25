# Aviation Fuel Management System

## Overview

This is a comprehensive web application for managing aviation fuel operations, including wholesale trading, aircraft refueling, warehouse management, exchange transactions, and logistics. The system is designed for a company operating in the aviation fuel market, providing automated pricing, cost calculations, and role-based access control for various business processes.

The application serves as a single source of truth for all fuel-related transactions, inventory tracking, and financial operations, with automatic price calculations and integrated warehouse management.

### Refueling Abroad - Deal Chain

The "Заправка ВС Зарубеж" (Foreign Aircraft Refueling) module features a visual "Deal Chain" ("Цепочка сделки") as the central UI element. The chain shows the money flow from Buyer → [chain items] → Supplier.

**Chain item types:**
- **Посредник (Intermediary)** - existing intermediary entity with commission/cross-rate calculation
- **Курс (Exchange Rate)** - a currency exchange rate node (from справочник or manual entry)
- **Комиссия банка (Bank Commission)** - bank fee node (% of sum, or % but not less than minimum)

**How it works:**
- The chain displays nodes with "+" buttons between them (clicking opens a menu to choose the item type)
- Each item type saves to its own table: `refueling_abroad_intermediaries`, `refueling_abroad_exchange_rates`, `refueling_abroad_bank_commissions`
- Each item has a `chainPosition`/`orderIndex` that preserves its position in the visual chain
- On save, all three lists are sent to their respective PUT endpoints

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Technology Stack

**Frontend:**
- React with TypeScript
- Vite as build tool and dev server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- React Hook Form with Zod validation for form handling
- Shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with custom design system based on IBM Carbon

**Backend:**
- Express.js server with TypeScript
- Session-based authentication using express-session
- RESTful API architecture
- Server-side validation using Zod schemas

**Database:**
- PostgreSQL via Neon serverless (@neondatabase/serverless)
- Drizzle ORM for type-safe database operations
- Schema-first approach with shared types between client and server

### Project Structure

The application follows a monorepo pattern with shared code:

- `client/` - React frontend application
- `server/` - Express backend with API routes
- `shared/` - Shared TypeScript types and Zod schemas
- `migrations/` - Database migration files

### Authentication & Authorization

**Session Management:**
- Cookie-based sessions with express-session
- Session data stored server-side
- HTTP-only cookies for security
- 24-hour session duration

**Role-Based Access Control (RBAC):**
- Flexible permission system stored in database with automatic seeding of default roles on startup
- Permissions structured as "module.action" (e.g., "opt.view", "refueling.edit")
- 10 default roles seeded automatically: Ген.дир, Админ, Глав.бух, Коммерческий директор, Руководитель проекта, Ведущий менеджер, Руководитель подразделения, Менеджер, Операционист, Оператор подразделения
- Each role has predefined permissions based on job function
- First registered user gets Admin role; subsequent users get Менеджер role by default
- RBAC middleware (requirePermission) enforces access control on protected routes
- Administrators can create custom roles and assign granular permissions
- Admin module routes require admin.* permissions
- All roles have restricted access by default (principle of least privilege)

**Frontend Permission System:**
- AuthContext provides reactive hasPermission() and isAdmin using useMemo
- Sidebar conditionally displays admin menu based on admin.view permission
- RegisterUser type (separate from InsertUser) ensures only allowed fields are submitted during registration
- Auth endpoints return user with role object for frontend permission checks

### Data Model & Business Logic

**Core Business Entities:**

1. **OPT (Wholesale Trading)** - Records wholesale fuel sales with automatic price lookups and cost calculations for purchase, sale, and delivery
2. **Aircraft Refueling** - Tracks all refueling operations with automated pricing for kerosene, refueling services, agent fees, PVKJ (anti-icing fluid), and storage
3. **Exchange** - Manages exchange transactions with automatic warehouse updates
4. **Movement** - Tracks fuel and PVKJ deliveries to storage facilities and internal transfers between warehouses
5. **Warehouses** - Maintains inventory with averaged cost basis when volumes merge, daily transaction tracking
6. **Prices** - Central pricing repository for purchase/sale prices by counterparty, product, and date range
7. **Delivery Costs** - Rate tables for carriers, routes, and tariffs

**Calculation Features:**
- Dual input mode: liters or kilograms with automatic conversion using density
- Weighted average cost calculation when merging inventory
- Automatic price lookups based on date, counterparty, and product type
- Delivery cost auto-calculation from rate tables

### API Design

RESTful endpoints organized by module:

- `/api/auth/*` - Authentication (login, logout, user session)
- `/api/users/*` - User management (CRUD operations)
- `/api/roles/*` - Role and permission management
- `/api/prices/*` - Price management
- `/api/delivery-cost/*` - Delivery rate management
- `/api/warehouses/*` - Warehouse and inventory operations
- `/api/exchange/*` - Exchange transaction tracking
- `/api/movement/*` - Movement and transfer records
- `/api/opt/*` - Wholesale trading operations
- `/api/refueling/*` - Aircraft refueling records (domestic)
- `/api/refueling-abroad/*` - Aircraft refueling abroad (international operations with USD pricing)
- `/api/exchange-rates/*` - Currency exchange rates management
- `/api/storage-cards/*` - Foreign airport storage cards for fuel tracking

All endpoints require authentication via `requireAuth` middleware.

### Refueling Abroad Module

The system includes a specialized module for international fuel operations:

**Key Features:**
- Multi-currency support (USD primary, converted to RUB at end)
- Flexible intermediary commission calculation via formula input
- Foreign supplier/customer management with `isForeign` and `isIntermediary` flags
- Storage cards for tracking fuel inventory at foreign airports
- Dual pricing display (USD and RUB) with automatic exchange rate conversion

**Commission Formula System:**
- Supports arithmetic expressions with variables: `purchasePrice`, `salePrice`, `quantity`, `exchangeRate`
- Preset formulas available (% of sale, fixed per kg, % of margin)
- Manual override option for one-time adjustments

**Database Tables:**
- `refueling_abroad` - Core transaction records with USD/RUB pricing
- `exchange_rates` - Currency rates with date tracking
- `storage_cards` - Foreign airport fuel storage tracking

### Frontend Architecture

**Component Organization:**
- Page components in `client/src/pages/` for each major module
- Shared UI components from Shadcn in `client/src/components/ui/`
- Custom components in `client/src/components/`
- Sidebar navigation with role-based visibility

**State Management:**
- Server state managed by TanStack Query with optimistic updates
- Form state handled by React Hook Form
- Authentication state via AuthContext provider
- Theme state (light/dark mode) via ThemeContext

**Design System:**
- Based on IBM Carbon Design System principles
- IBM Plex Sans font family
- Custom Tailwind configuration with CSS variables for theming
- Consistent spacing, typography, and component patterns
- Focus on data-heavy enterprise workflows

### Build & Deployment

**Development:**
- Vite dev server with HMR for client
- tsx for running TypeScript server directly
- Concurrent client and server in development mode

**Production Build:**
- Client built to `dist/public` via Vite
- Server bundled to `dist/index.cjs` via esbuild
- Selected dependencies bundled to reduce cold start times
- Static file serving from Express in production

## External Dependencies

**Database:**
- Neon PostgreSQL (serverless)
- Connection via WebSocket constructor for serverless compatibility

**UI Component Library:**
- Radix UI primitives for accessible components
- Shadcn/ui as component architecture pattern

**Font Loading:**
- Google Fonts CDN for IBM Plex Sans and other typefaces

**Session Storage:**
- In-memory session store (development)
- Designed to support connect-pg-simple for production PostgreSQL session storage

**Development Tools:**
- Replit-specific plugins for runtime error overlay and dev banner
- Cartographer for debugging (Replit environment only)

**Form Validation:**
- Zod schemas shared between client and server
- @hookform/resolvers for React Hook Form integration

**Date Handling:**
- date-fns library with Russian locale support

## UX Improvements (March 25, 2026)

### 6 UX/Functionality Improvements

**1. Auto-date "До" (+1 day) in AddPriceDialog**
- Default dateTo is now set to currentDate + 1 day (was same as dateFrom)
- Applied in 3 places: initial form defaults, onSuccess reset, onOpenChange reset

**2. Carrier Validation in Movement Table**
- Missing carrier on non-draft SUPPLY movements shows red "Не указан" with AlertTriangle icon
- Implemented in `client/src/pages/movement/components/movement-table.tsx`

**3. Responsive Tables**
- All 5 data tables now have `overflow-x-auto` wrapper
- Actions column is `sticky right-0 bg-background z-10` in all tables:
  - opt-table, refueling-table, movement-table, transportation-table, equipment-movement-table

**4. Auto-fill Inline Price Forms**
- New `inlineDefaults?: Partial<PriceFormData>` prop added to `PriceDialogProps` in `types.ts`
- `AddPriceDialog` applies defaults when inline dialog opens (useEffect on inlineOpen)
- `OptPricingSection`: purchase dialog gets supplier/basis/WHOLESALE/SUPPLIER, sale gets buyer/BUYER
- `RefuelingPricingSection`: similar auto-fill with REFUELING counterparty type

**5. Centralized Error Modal**
- New `useErrorModal` hook at `client/src/hooks/use-error-modal.tsx`
- Intelligent error message matching with helpful hints for: prices, carriers, balance, dates, suppliers, buyers, volumes, contracts
- Applied in: movement-dialog, opt-form, refueling-form, transportation-form, equipment-movement-dialog, add-price-dialog
- Modal stays visible until dismissed (unlike auto-dismissing toast)

**6. Collapsible Inline Price Form**
- Inline AddPriceDialog now renders as a fixed bottom-right floating panel
- Header bar with minimize/expand button (ChevronUp/Minus) and close button (X)
- Click on header toggles minimize state; preserves form data when minimized
- Auto-expands when panel is re-opened

## Recent Fixes (March 20, 2026)

### Transportation Module Improvements

**Issue 1: Sale Price Auto-selection**
- Fixed: Sale price now auto-selects the first available price when buyer is changed
- Fixed: When editing existing transportation records, the sale price is correctly pre-populated from saved data
- Implementation: Modified `useAutoPriceSelection` hook to handle both creation and editing scenarios
- The hook now checks if edited data exists and preserves previously selected prices instead of overwriting them

**Issue 2: Logistics Section Runtime Error**
- Fixed: Runtime error when switching from АвиаСервис carrier to other carriers
- Fixed: Delivery location field is now properly cleared when switching to АвиаСервис
- Fixed: Purchase price is cleared when switching away from АвиаСервис (since it's only applicable for АвиаСервис)
- Implementation: Added `useEffect` logic to manage field state during carrier transitions
- Ensures form remains consistent when toggling between АвиаСервис and other logistics providers

**Technical Details:**
- Modified: `client/src/pages/shared/hooks/use-auto-price-selection.ts`
- Modified: `client/src/pages/transportation/components/transportation-form.tsx`
- Carrier switching now properly triggers field cleanup and state synchronization
- Form validation works correctly across all carrier types