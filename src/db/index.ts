import { env } from "@zen/utils/env";
import { createLogger } from "@zen/utils/logger";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const log = createLogger("db");

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	connectionTimeoutMillis: 10_000,
	idleTimeoutMillis: 30_000,
	max: env.NODE_ENV === "production" ? 20 : 10,
});

pool.on("error", (error) => {
	log.error({ error }, "Unexpected PostgreSQL pool error");
});

export const db = drizzle(pool, { schema });

export const checkDatabaseConnection = async (): Promise<void> => {
	await pool.query("select 1");
	log.info("PostgreSQL connection established");
};

export const closeDatabaseConnection = async (): Promise<void> => {
	await pool.end();
	log.info("PostgreSQL connection closed");
};
