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
  if (parsed.port !== TRANSACTION_POOLER_PORT) return url;
  parsed.port = SESSION_POOLER_PORT;
  parsed.searchParams.delete("pgbouncer");
  parsed.searchParams.delete("connection_limit");
  return parsed.toString();
}
