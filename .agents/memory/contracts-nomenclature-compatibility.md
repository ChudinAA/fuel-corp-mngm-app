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
