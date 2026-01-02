/**
 * Namespace utilities for KV storage
 *
 * Key format: {category}:{visibility}:{owner}:{key}
 * - category: "kv", "paste", "memo", etc.
 * - visibility: "private" or "public"
 * - owner: Stacks address of the payer
 * - key: User-provided key (max 256 chars)
 */

export type Visibility = "private" | "public";
export type StorageCategory = "kv" | "paste" | "memo" | "memory";

// Cloudflare KV limits
export const KV_LIMITS = {
  KEY_MAX_BYTES: 512,
  VALUE_MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  VALUE_RECOMMENDED_MAX: 1 * 1024 * 1024, // 1 MB for standard tier
  VALUE_LARGE_THRESHOLD: 100 * 1024, // 100 KB triggers large tier pricing
  TTL_MIN_SECONDS: 60,
  LIST_MAX_KEYS: 1000,
  USER_KEY_MAX_CHARS: 256,
};

/**
 * Build a namespaced storage key
 */
export function buildStorageKey(
  category: StorageCategory,
  visibility: Visibility,
  owner: string,
  key: string
): string {
  // Validate key length
  if (key.length > KV_LIMITS.USER_KEY_MAX_CHARS) {
    throw new Error(
      `Key exceeds maximum length of ${KV_LIMITS.USER_KEY_MAX_CHARS} characters`
    );
  }

  // Validate key doesn't contain delimiter
  if (key.includes(":")) {
    throw new Error("Key cannot contain colon (:) character");
  }

  const fullKey = `${category}:${visibility}:${owner}:${key}`;

  // Check total key size
  const keyBytes = new TextEncoder().encode(fullKey).length;
  if (keyBytes > KV_LIMITS.KEY_MAX_BYTES) {
    throw new Error(
      `Full key exceeds Cloudflare KV limit of ${KV_LIMITS.KEY_MAX_BYTES} bytes`
    );
  }

  return fullKey;
}

/**
 * Parse a namespaced storage key
 */
export function parseStorageKey(fullKey: string): {
  category: StorageCategory;
  visibility: Visibility;
  owner: string;
  key: string;
} {
  const parts = fullKey.split(":");
  if (parts.length < 4) {
    throw new Error("Invalid storage key format");
  }

  const [category, visibility, owner, ...keyParts] = parts;
  const key = keyParts.join(":"); // Rejoin in case key had colons (shouldn't happen with validation)

  return {
    category: category as StorageCategory,
    visibility: visibility as Visibility,
    owner,
    key,
  };
}

/**
 * Build a prefix for listing keys
 */
export function buildListPrefix(
  category: StorageCategory,
  owner: string,
  visibility?: Visibility,
  keyPrefix?: string
): string {
  let prefix = `${category}:`;

  if (visibility) {
    prefix += `${visibility}:${owner}:`;
    if (keyPrefix) {
      prefix += keyPrefix;
    }
  } else {
    // List both public and private for this owner
    // Note: This won't work with KV prefix - caller needs to do two queries
    prefix += `private:${owner}:`;
    if (keyPrefix) {
      prefix += keyPrefix;
    }
  }

  return prefix;
}

/**
 * Check if a value size triggers large tier pricing
 */
export function isLargeValue(value: string | object): boolean {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(serialized).length;
  return bytes > KV_LIMITS.VALUE_LARGE_THRESHOLD;
}

/**
 * Validate value size against limits
 */
export function validateValueSize(
  value: string | object,
  allowLarge: boolean = false
): { valid: boolean; bytes: number; error?: string } {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const bytes = new TextEncoder().encode(serialized).length;

  const maxBytes = allowLarge
    ? KV_LIMITS.VALUE_MAX_BYTES
    : KV_LIMITS.VALUE_RECOMMENDED_MAX;

  if (bytes > maxBytes) {
    return {
      valid: false,
      bytes,
      error: `Value size (${formatBytes(bytes)}) exceeds maximum (${formatBytes(maxBytes)})`,
    };
  }

  return { valid: true, bytes };
}

/**
 * Validate TTL value
 */
export function validateTtl(ttl?: number): {
  valid: boolean;
  ttl?: number;
  error?: string;
} {
  if (ttl === undefined) {
    return { valid: true, ttl: undefined };
  }

  if (ttl < KV_LIMITS.TTL_MIN_SECONDS) {
    return {
      valid: false,
      error: `TTL must be at least ${KV_LIMITS.TTL_MIN_SECONDS} seconds`,
    };
  }

  return { valid: true, ttl };
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if requester can access a key
 */
export function canAccess(
  fullKey: string,
  requesterAddress: string,
  targetOwner?: string
): boolean {
  const parsed = parseStorageKey(fullKey);

  // Owner can always access their own keys
  if (parsed.owner === requesterAddress) {
    return true;
  }

  // Public keys can be accessed by anyone (if they know the owner)
  if (parsed.visibility === "public" && targetOwner === parsed.owner) {
    return true;
  }

  return false;
}
