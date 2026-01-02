import { DurableObject } from "cloudflare:workers";

/**
 * UserDurableObject - Per-user SQLite-backed Durable Object
 *
 * Each payer address gets their own DO instance with isolated SQLite storage.
 * Provides counters, custom SQL queries, and other stateful operations.
 *
 * Design principles (per Cloudflare best practices):
 * - Use SQLite for structured data (recommended over KV)
 * - Use RPC methods for clean interface
 * - Initialize tables lazily on first use
 * - Each user's data is completely isolated
 */
export class UserDurableObject extends DurableObject<Env> {
  private sql: SqlStorage;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
  }

  /**
   * Initialize the database schema (called lazily)
   */
  private initializeSchema(): void {
    if (this.initialized) return;

    // Counters table
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS counters (
        name TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0,
        min_value INTEGER,
        max_value INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Generic key-value table for future use
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS user_data (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.initialized = true;
  }

  // ===========================================================================
  // Counter Operations
  // ===========================================================================

  /**
   * Increment a counter by a given step
   */
  async counterIncrement(
    name: string,
    step: number = 1,
    options?: { min?: number; max?: number }
  ): Promise<{ name: string; value: number; previousValue: number; capped: boolean }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    // Get or create counter
    const existing = this.sql
      .exec("SELECT value, min_value, max_value FROM counters WHERE name = ?", name)
      .toArray();

    let previousValue: number;
    let minValue = options?.min ?? null;
    let maxValue = options?.max ?? null;

    if (existing.length === 0) {
      // Create new counter
      previousValue = 0;
      this.sql.exec(
        `INSERT INTO counters (name, value, min_value, max_value, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        name,
        step,
        minValue,
        maxValue,
        now,
        now
      );
    } else {
      previousValue = existing[0].value as number;
      // Use stored bounds if not overridden
      if (minValue === null) minValue = existing[0].min_value as number | null;
      if (maxValue === null) maxValue = existing[0].max_value as number | null;
    }

    let newValue = previousValue + step;
    let capped = false;

    // Apply bounds
    if (maxValue !== null && newValue > maxValue) {
      newValue = maxValue;
      capped = true;
    }
    if (minValue !== null && newValue < minValue) {
      newValue = minValue;
      capped = true;
    }

    if (existing.length > 0) {
      this.sql.exec(
        `UPDATE counters SET value = ?, min_value = ?, max_value = ?, updated_at = ? WHERE name = ?`,
        newValue,
        minValue,
        maxValue,
        now,
        name
      );
    }

    return { name, value: newValue, previousValue, capped };
  }

  /**
   * Decrement a counter by a given step
   */
  async counterDecrement(
    name: string,
    step: number = 1,
    options?: { min?: number; max?: number }
  ): Promise<{ name: string; value: number; previousValue: number; capped: boolean }> {
    return this.counterIncrement(name, -step, options);
  }

  /**
   * Get the current value of a counter
   */
  async counterGet(name: string): Promise<{
    name: string;
    value: number;
    min: number | null;
    max: number | null;
    createdAt: string;
    updatedAt: string;
  } | null> {
    this.initializeSchema();

    const result = this.sql
      .exec(
        "SELECT value, min_value, max_value, created_at, updated_at FROM counters WHERE name = ?",
        name
      )
      .toArray();

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      name,
      value: row.value as number,
      min: row.min_value as number | null,
      max: row.max_value as number | null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  /**
   * Reset a counter to zero (or a specified value)
   */
  async counterReset(
    name: string,
    resetTo: number = 0
  ): Promise<{ name: string; value: number; previousValue: number }> {
    this.initializeSchema();
    const now = new Date().toISOString();

    const existing = this.sql
      .exec("SELECT value FROM counters WHERE name = ?", name)
      .toArray();

    const previousValue = existing.length > 0 ? (existing[0].value as number) : 0;

    if (existing.length === 0) {
      // Create counter at reset value
      this.sql.exec(
        `INSERT INTO counters (name, value, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        name,
        resetTo,
        now,
        now
      );
    } else {
      this.sql.exec(
        `UPDATE counters SET value = ?, updated_at = ? WHERE name = ?`,
        resetTo,
        now,
        name
      );
    }

    return { name, value: resetTo, previousValue };
  }

  /**
   * List all counters
   */
  async counterList(): Promise<
    Array<{
      name: string;
      value: number;
      min: number | null;
      max: number | null;
      updatedAt: string;
    }>
  > {
    this.initializeSchema();

    const results = this.sql
      .exec("SELECT name, value, min_value, max_value, updated_at FROM counters ORDER BY name")
      .toArray();

    return results.map((row) => ({
      name: row.name as string,
      value: row.value as number,
      min: row.min_value as number | null,
      max: row.max_value as number | null,
      updatedAt: row.updated_at as string,
    }));
  }

  /**
   * Delete a counter
   */
  async counterDelete(name: string): Promise<{ deleted: boolean; name: string }> {
    this.initializeSchema();

    const existing = this.sql
      .exec("SELECT 1 FROM counters WHERE name = ?", name)
      .toArray();

    if (existing.length === 0) {
      return { deleted: false, name };
    }

    this.sql.exec("DELETE FROM counters WHERE name = ?", name);
    return { deleted: true, name };
  }

  // ===========================================================================
  // SQL Query Operations
  // ===========================================================================

  /**
   * Execute a read-only SQL query against the user's database
   * Only SELECT queries are allowed for security
   */
  async sqlQuery(
    query: string,
    params: unknown[] = []
  ): Promise<{
    rows: unknown[];
    rowCount: number;
    columns: string[];
  }> {
    this.initializeSchema();

    // Security: Only allow SELECT queries
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed. Use dedicated endpoints for mutations.");
    }

    // Prevent dangerous patterns
    const dangerous = ["DROP", "DELETE", "INSERT", "UPDATE", "CREATE", "ALTER", "PRAGMA"];
    for (const keyword of dangerous) {
      if (normalizedQuery.includes(keyword)) {
        throw new Error(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    const cursor = this.sql.exec(query, ...params);
    const rows = cursor.toArray();

    // Extract column names from first row
    const columns = rows.length > 0 ? Object.keys(rows[0] as object) : [];

    return {
      rows,
      rowCount: rows.length,
      columns,
    };
  }

  /**
   * Execute a write SQL query (CREATE TABLE, INSERT, UPDATE, DELETE)
   * Limited to user's own tables (not system tables)
   */
  async sqlExecute(
    query: string,
    params: unknown[] = []
  ): Promise<{
    success: boolean;
    rowsAffected: number;
  }> {
    this.initializeSchema();

    // Security: Prevent modification of system tables
    const normalizedQuery = query.trim().toUpperCase();
    const systemTables = ["COUNTERS", "USER_DATA"];

    for (const table of systemTables) {
      // Check if trying to DROP or ALTER system tables
      if (
        (normalizedQuery.includes("DROP") || normalizedQuery.includes("ALTER")) &&
        normalizedQuery.includes(table)
      ) {
        throw new Error(`Cannot modify system table: ${table.toLowerCase()}`);
      }
    }

    // Prevent PRAGMA modifications
    if (normalizedQuery.startsWith("PRAGMA") && normalizedQuery.includes("=")) {
      throw new Error("Cannot modify PRAGMA settings");
    }

    const cursor = this.sql.exec(query, ...params);

    return {
      success: true,
      rowsAffected: cursor.rowsWritten,
    };
  }

  /**
   * Get database schema information
   */
  async sqlSchema(): Promise<{
    tables: Array<{
      name: string;
      sql: string;
    }>;
  }> {
    this.initializeSchema();

    const tables = this.sql
      .exec("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .toArray();

    return {
      tables: tables.map((row) => ({
        name: row.name as string,
        sql: row.sql as string,
      })),
    };
  }
}
