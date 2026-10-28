import { sql } from "drizzle-orm";
import { opt } from "./entities/opt";

/** Resolve OPT mass from the authoritative tonne column, then the legacy mirror. */
export function optMassTonnesSql() {
  return sql`COALESCE(
    ${opt.quantityTonnes},
    CAST(${opt.quantityKg} AS NUMERIC) / 1000
  )`;
}
