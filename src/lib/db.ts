import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

/**
 * The session pooler (port 5432) is only good for schema work: it hands out 15
 * clients per project in total, so serving pages through it dies with
 * `EMAXCONNSESSION` as soon as a couple of users tap around. Move runtime
 * traffic to the transaction pooler on 6543 even when the deployment points at
 * 5432, and drop the pooling hints that only mean something to Prisma's own
 * query engine (`pgbouncer`, `connection_limit`) — node-postgres would forward
 * them to the server as startup parameters.
 */
function runtimeDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return undefined;
  const parsed = new URL(url);
  const sessionPooler = parsed.port === "5432" && parsed.hostname.endsWith(".pooler.supabase.com");
  if (sessionPooler) parsed.port = "6543";
  else if (parsed.port !== "6543") return undefined;
  for (const key of ["pgbouncer", "connection_limit", "pool_timeout", "sslmode"]) {
    parsed.searchParams.delete(key);
  }
  return parsed.toString();
}

/**
 * Postgres goes through the node-postgres driver adapter rather than Prisma's
 * own engine-side pool. Talking to PgBouncer, the engine wraps every statement
 * in `BEGIN` / `DEALLOCATE ALL` / … / `COMMIT`, which is five network round
 * trips per query; the adapter sends one unnamed extended-protocol query, so a
 * read costs a single round trip. On a cross-region deployment (~175ms RTT)
 * that is the difference between 870ms and 175ms for the very same query.
 */
function createPrismaClient(): PrismaClient {
  const connectionString = runtimeDatabaseUrl();
  if (!connectionString) return new PrismaClient();

  const pool =
    globalForPrisma.pool ??
    new Pool({
      connectionString,
      // Pages fan out ~10 queries at once; the transaction pooler multiplexes
      // them, so a handful of real connections per instance is plenty.
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: false },
    });
  if (process.env.NODE_ENV !== "production") globalForPrisma.pool = pool;

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
