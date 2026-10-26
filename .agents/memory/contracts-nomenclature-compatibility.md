---
name: Contracts and nomenclature compatibility
description: Why contracts use concrete party foreign keys and historical nomenclature is not inferred from defaults
---

Keep one contracts directory with concrete supplier, buyer and carrier foreign keys, exactly one owner per record. Appendices belong to a main contract of the same party.

**Why:** counterparties live in separate tables; an unchecked counterparty ID plus a type would lose database referential integrity.

**How to apply:** new counterparty categories require an explicit extension of the ownership constraint and validation, not arbitrary polymorphic IDs.

Do not automatically assign the default nomenclature item to historical prices or deals. Preserve legacy text contract information until the user explicitly maps a record to a directory entry.

**Why:** a default is a preference for new input, not evidence of which nomenclature was used historically. Guessing would silently relabel business records.

**How to apply:** a selected nomenclature must match prices strictly. A legacy record with no selection uses only legacy prices without nomenclature; never mix the two sets. Apply migrations additively and retain legacy columns until an explicit data migration is approved.

## Product terminology and conversions

Тип продукта means Керосин/ПВКЖ/Услуга and controls application defaults and price matching. Вид номенклатуры is a separate integration-only structure, not a product type. Unit conversion links one unit to another, e.g. 1 т = 1000 кг, never a unit to a nomenclature item.

**Why:** the user explicitly corrected the original conflation of these business concepts.

**How to apply:** hide integration IDs and technical codes. The user subsequently requested a visible, editable nomenclature-kind directory and kind selection (defaults «Товар»/«Услуга»); these are descriptive metadata only. Do not derive business behavior from integration kind codes.

## Directory interaction requirements

For contracts and nomenclature, use the application's state-preserving minimizable create/edit dialogs and per-row three-dot action menus, not inline CRUD forms. Nomenclature selection belongs immediately next to/after product selection in trade/price forms.

**Why:** the user requested consistency with established application mechanics and compact product-related grouping.

**How to apply:** preserve unsaved input while minimizing; allow direct autosaving of the default toggle by product type, with permission checks and visible error handling.

## Contract context in transaction forms

Price dropdowns display only amounts and units; show the selected price's contract compactly below the field. Show a delivery tariff's contract below the carrier, using the exact tariff selected by route calculation rather than a carrier-only lookup.

**Why:** the user requested uncluttered price choices and aligned controls; a carrier can have multiple contracts and route tariffs.

**How to apply:** reserve helper-line height even without contract text so selecting a contract does not shift neighboring fields. Preserve existing tariffs and historical movements with missing catalog links rather than guessing their identity.
