/**
 * Supabase (and other PgBouncer setups) expose a transaction pooler on 6543 and
 * a session pooler on 5432. Prisma needs `pgbouncer=true` on the former, and
 * schema changes have to go through the latter.
 */
const TRANSACTION_POOLER_PORT = "6543";
const SESSION_POOLER_PORT = "5432";

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//.test(url ?? "");
}

export function schemaDatabaseUrl(url) {
  if (!isPostgresUrl(url)) return url;
  const parsed = new URL(url);
  const pooler =
    parsed.port === TRANSACTION_POOLER_PORT ||
    (parsed.port === SESSION_POOLER_PORT && parsed.hostname.endsWith(".pooler.supabase.com"));
  if (!pooler) return url;
  parsed.port = SESSION_POOLER_PORT;
  parsed.searchParams.delete("pgbouncer");
  // The schema engine works serially, and the session pooler hands out at most
  // 15 clients per project, so hold exactly one of them.
  parsed.searchParams.set("connection_limit", "1");
  return parsed.toString();
}
