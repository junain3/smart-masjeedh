# Families & Members Data Collection Enhancement Report

## 1. Existing Families Columns

Based on current code inspection:
```typescript
type Family = {
  id: string;
  family_code: string;          // Auto-generated family code
  head_name: string;            // Head of family name
  address: string;              // Physical address
  phone: string;                // Contact phone
  subscription_amount?: number;  // Annual subscription amount
  opening_balance?: number;     // Opening balance (static)
  is_widow_head?: boolean;     // Widow head indicator
};
```

## 2. Existing Members Columns

Based on current code inspection:
```typescript
type Member = {
  id: string;
  family_id: string;
  member_code: string;          // Auto-generated member code
  name: string;                 // Full name
  relationship: string;         // Family relationship
  age: number;                  // Calculated from DOB
  gender: string;              // Male/Female/Other
  dob: string;                  // Date of birth
  nic: string;                  // National ID
  phone: string;                // Contact phone
  civil_status: string;        // Single/Married/Divorced/Widowed/Other
  status: string;              // Active/Inactive
};
```

## 3. Proposed SQL Migration

```sql
-- Add new columns to families table
ALTER TABLE families 
ADD COLUMN IF NOT EXISTS house_type VARCHAR(20) CHECK (house_type IN ('own', 'rent')),
ADD COLUMN IF NOT EXISTS has_toilet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS special_needs_details TEXT,
ADD COLUMN IF NOT EXISTS foreign_members_details TEXT,
ADD COLUMN IF NOT EXISTS health_details TEXT,
ADD COLUMN IF NOT EXISTS has_car BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_three_wheeler BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_van BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_lorry BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_tractor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extra_notes TEXT;

-- Add new columns to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS education VARCHAR(100),
ADD COLUMN IF NOT EXISTS occupation VARCHAR(100),
ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
ADD COLUMN IF NOT EXISTS is_moulavi BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_new_muslim BOOLEAN DEFAULT FALSE;
```

## 4. Exact Files to Edit

### Primary Files:
1. **app/families/page.tsx** - Add Family form enhancement
2. **app/families/[id]/page.tsx** - Add Member form enhancement

### Supporting Files:
3. **lib/i18n/translations.ts** - Add new translation keys
4. **Types may need updates** in both files for new fields

## 5. UI Plan

### Add Family Enhancement (Step-by-Step):

**Current Form Structure:**
- Single form with basic fields
- family_code, head_name, address, phone, subscription_amount, opening_balance, is_widow_head

**Proposed 3-Step Structure:**

**Step 1: Basic Family Details**
- family_code (auto-generated)
- head_name
- address
- phone
- is_widow_head (checkbox)

**Step 2: House & Finance**
- house_type (dropdown: own/rent)
- has_toilet (checkbox)
- subscription_amount
- opening_balance

**Step 3: Extra Details**
- special_needs_details (textarea)
- foreign_members_details (textarea)
- health_details (textarea)
- Vehicle checkboxes:
  - has_car
  - has_three_wheeler
  - has_van
  - has_lorry
  - has_tractor
- extra_notes (textarea, optional)

### Add Member Enhancement:

**Current Fields:**
- full_name
- relationship
- date_of_birth
- age (auto-calculated)
- NIC
- phone
- civil_status

**Proposed Additional Fields:**
- education (text input)
- occupation (text input)
- marital_status (dropdown: single/married/divorced/widowed)
- is_moulavi (checkbox)
- is_new_muslim (checkbox)

**Display Plan:**
- Keep current simple layout
- Add new fields in logical order
- Use checkboxes for Moulavi/New Muslim instead of name prefixes
- Later display badges: "Moulavi" or "New Muslim" next to member names

## 6. Implementation Notes

### Database Safety:
- All new columns are nullable/with defaults
- Existing records continue working
- No breaking changes to current functionality

### UI Design:
- Maintain current design style
- Use step indicators for Add Family
- Keep Add Member simple and clean
- Progressive disclosure to avoid overwhelming forms

### Data Validation:
- Add appropriate validation for new fields
- Maintain existing validation patterns
- Use dropdowns where appropriate for consistency

## 7. Next Steps

1. **Confirm SQL migration approach**
2. **Approve UI step-by-step design**
3. **Implement database changes**
4. **Update UI components**
5. **Add translations**
6. **Test with existing data**
