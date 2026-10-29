import { sql } from "drizzle-orm";
import { opt } from "./entities/opt";

/** Read OPT mass from its authoritative tonne column. */
export function optMassTonnesSql() {
  return sql`${opt.quantityTonnes}`;
}
