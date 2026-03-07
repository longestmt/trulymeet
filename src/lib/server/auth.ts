import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Generate a URL-safe event slug (10 chars, ~60 bits of entropy)
 */
export function generateSlug(): string {
    return nanoid(10);
}

/**
 * Generate a cryptographically random admin token (32 chars, ~192 bits of entropy)
 */
export function generateAdminToken(): string {
    return nanoid(32);
}

/**
 * Hash a password or token with bcrypt
 */
export async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verify a password or token against a bcrypt hash
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

/**
 * Generate a simple access token for password-protected events
 */
export function generateAccessToken(): string {
    return nanoid(48);
}
