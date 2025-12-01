# Design Guidelines: Aviation Fuel Management System

## Design Approach
**Selected System**: Carbon Design System (IBM)
**Rationale**: Purpose-built for data-heavy enterprise applications with complex workflows, extensive form handling, and structured data displays. Provides robust component patterns for tables, multi-step forms, and role-based interfaces.

## Core Design Principles
1. **Data Clarity First**: Information hierarchy prioritizes readability of numerical data, calculations, and validation states
2. **Efficiency Over Aesthetics**: Minimize clicks, optimize form flows, support keyboard navigation
3. **Consistent Patterns**: Reuse component structures across all modules (ОПТ, Заправка ВС, Склады, etc.)
4. **Progressive Disclosure**: Show critical data first, hide complexity behind expandable sections

---

## Typography System

**Font Family**: IBM Plex Sans (via Google Fonts CDN)

**Scale & Hierarchy**:
- Page Headers: 28px/semibold (text-2xl font-semibold)
- Section Headers: 20px/semibold (text-xl font-semibold)
- Form Labels: 14px/medium (text-sm font-medium)
- Input Text: 16px/regular (text-base)
- Table Headers: 12px/semibold uppercase (text-xs font-semibold uppercase tracking-wide)
- Table Data: 14px/regular (text-sm)
- Helper Text: 12px/regular (text-xs)

---

## Layout System

**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: mb-8 to mb-12
- Form field gaps: gap-4
- Card padding: p-6

**Grid Structure**:
- Sidebar navigation: Fixed 256px width (w-64)
- Main content: Fluid with max-w-7xl container
- Form layouts: Two-column grid (grid-cols-1 md:grid-cols-2) for field pairs
- Data tables: Full-width with horizontal scroll on mobile

---

## Component Library

### Navigation & Layout
**Top Bar**: Fixed header (h-16) with logo, breadcrumbs, user profile dropdown
**Sidebar**: Collapsible navigation tree with role-based visibility, icon + label pattern
**Breadcrumbs**: Show current location in module hierarchy

### Forms (Critical for ОПТ, Заправка ВС, etc.)
**Input Fields**: 
- Standard height h-10, full-width on mobile
- Labels above inputs with required asterisk indicators
- Inline validation messages below fields
- Disabled state for auto-calculated fields (Покупка, Продажа, Доставка)

**Calculated Fields Display**:
- Read-only styled inputs with subtle background differentiation
- Label + Value pattern with clear visual separation
- Currency/unit formatting (e.g., "123,456.78 руб" or "1,234 кг")

**Dropdown Selects**:
- Searchable with typeahead for long lists (контрагенты, базисы)
- Multi-select for scenarios requiring multiple values
- Empty state with "Нет данных" messaging

**Date Pickers**: Calendar popup with manual input fallback, localized to Russian format (DD.MM.YYYY)

**Toggle/Switch**: For Литры/Плотность vs КГ input mode switching

**Action Buttons**:
- Primary: Full (e.g., "Сохранить", "Добавить")
- Secondary: Outlined (e.g., "Отмена")
- Danger: For deletions (e.g., "Удалить")
- Size: h-10 px-6, icons 20px when included

### Data Tables (for Склады, Цены, etc.)
**Structure**:
- Sticky headers on scroll
- Alternating row backgrounds for readability
- Row height: h-12 to h-14
- Right-align numerical columns
- Action column (icons: edit, delete) on right edge
- Sortable headers with arrow indicators
- Pagination: 20/50/100 rows per page options

**Inline Editing**: Click-to-edit cells for quick updates where appropriate

**Filters Panel**: Collapsible sidebar or top bar with date ranges, dropdown filters, search

### Cards & Panels
**Module Cards**: Rounded corners (rounded-lg), shadow (shadow-sm), padding p-6
**Summary Cards**: For dashboard metrics - large number display with label and trend indicator
**Warning/Alert Cards**: For "Объем на складе" insufficient warnings - prominent border treatment

### Admin Panel Components
**Role Management Table**: Checkbox matrix for role-permission mapping
**User Management**: Searchable table with inline role assignment dropdowns
**Access Control UI**: Toggle switches for module visibility per role

---

## Page Layouts

### Login Page
Centered card (max-w-md) with email/password fields, "Войти" button, password recovery link

### Main Application Shell
Fixed sidebar + top bar, scrollable content area

### Form Pages (ОПТ, Заправка ВС, Перемещение)
- Full-width header with module name + action buttons
- Two-column form grid (3 columns on xl screens for dense data entry)
- Sticky action bar at bottom with Save/Cancel
- Auto-calculated fields grouped together visually

### Table Pages (Склады, Цены, Справочники)
- Filter panel above table
- Table with sorting, pagination
- Bulk action toolbar when rows selected
- Add new record button (floating action button or top-right)

### Admin Dashboard
- Grid of metric cards (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Recent activity table
- Quick access to role/user management

---

## Accessibility
- All form inputs have associated labels (for screen readers)
- Focus visible states on all interactive elements (ring-2 ring-offset-2)
- Keyboard navigation: Tab through forms, Enter to submit, Esc to cancel
- ARIA labels on icon-only buttons
- Error messages linked to invalid fields

---

## Animation
**Minimal Motion**:
- Dropdown menus: 150ms ease-out
- Modal overlays: 200ms fade-in
- Table row hover: No animation, instant background change
- NO scroll-triggered or decorative animations

---

## Special Patterns

**Auto-Calculation Indicators**: 
Small "auto" badge or calculator icon next to fields populated by backend logic

**Validation States**:
- Success: Subtle left border accent
- Error: Border accent + message below field
- Warning: For "Объем на складе" insufficient alerts

**Multi-Price Selection UI** (for multiple same-day prices):
Radio button list or segmented control to choose from available prices, showing contract number and amount

**Базис Auto-Fill Notification**: 
Toast notification or inline message when базис auto-populates from поставщик selection

---

## Images
**Not Applicable**: This is a data-centric enterprise application without marketing content. No hero images or decorative photography. Use icons from **Heroicons** (outline style) for navigation, actions, and status indicators via CDN.