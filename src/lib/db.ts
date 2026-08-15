import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * A Supabase transaction pooler (port 6543) multiplexes connections, so Prisma
 * has to be told to stop relying on server-side prepared statements. The widely
 * copy-pasted `connection_limit=1` is dropped: pages fan out ~20 queries at
 * once and would spend their whole render waiting on a single connection.
 *
 * The session pooler on the same host (port 5432) is only good for schema work:
 * it hands out 15 clients per project in total, so serving pages through it
 * dies with `EMAXCONNSESSION` as soon as a couple of users tap around. Move
 * runtime traffic to 6543 even when the deployment points at 5432.
 */
function runtimeDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return undefined;
  const parsed = new URL(url);
  const sessionPooler = parsed.port === "5432" && parsed.hostname.endsWith(".pooler.supabase.com");
  if (sessionPooler) parsed.port = "6543";
  else if (parsed.port !== "6543") return undefined;
  parsed.searchParams.set("pgbouncer", "true");
  if (parsed.searchParams.get("connection_limit") === "1") {
    parsed.searchParams.delete("connection_limit");
  }
  return parsed.toString();
}

function createPrismaClient(): PrismaClient {
  const url = runtimeDatabaseUrl();
  return url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
