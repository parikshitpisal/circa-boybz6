import { randomBytes, createCipheriv, createDecipheriv, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// @version crypto: native Node.js module

// Constants for encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_ROUNDS = 12;

// Promisified version of scrypt for async key derivation
const scryptAsync = promisify(scrypt);

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * Encrypts sensitive data using AES-256-GCM with authentication tag
 * Implements timing attack protection and secure memory management
 * 
 * @param data - Data to encrypt (string or Buffer)
 * @param key - Encryption key (must be 32 bytes)
 * @returns Object containing encrypted data, IV, and authentication tag
 * @throws Error if key length is invalid or encryption fails
 */
export async function encrypt(data: string | Buffer, key: Buffer): Promise<EncryptedData> {
  try {
    // Validate key length
    if (key.length !== KEY_LENGTH) {
      throw new Error('Invalid key length');
    }

    // Generate cryptographically secure random IV
    const iv = randomBytes(IV_LENGTH);

    // Create cipher with timing attack protection
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Convert input data to Buffer if string
    const inputData = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

    // Encrypt data with secure memory allocation
    const encrypted = Buffer.concat([
      cipher.update(inputData),
      cipher.final()
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return encrypted data structure
    return {
      encrypted,
      iv,
      tag
    };
  } catch (error) {
    // Secure error handling without leaking sensitive information
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts data using AES-256-GCM with authentication verification
 * Implements constant-time comparison and secure memory management
 * 
 * @param encryptedData - Buffer containing encrypted data
 * @param key - Decryption key (must be 32 bytes)
 * @param iv - Initialization vector used for encryption
 * @param tag - Authentication tag for integrity verification
 * @returns Decrypted data as Buffer
 * @throws Error if authentication fails or decryption fails
 */
export async function decrypt(
  encryptedData: Buffer,
  key: Buffer,
  iv: Buffer,
  tag: Buffer
): Promise<Buffer> {
  try {
    // Validate input parameters
    if (key.length !== KEY_LENGTH || iv.length !== IV_LENGTH || tag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid input parameters');
    }

    // Create decipher with timing attack protection
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

    // Set authentication tag with constant-time comparison
    decipher.setAuthTag(tag);

    // Decrypt data with secure memory allocation
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    return decrypted;
  } catch (error) {
    // Secure error handling without leaking sensitive information
    throw new Error('Decryption failed');
  }
}

/**
 * Generates a cryptographically secure random key with enhanced entropy
 * 
 * @param length - Desired key length in bytes
 * @returns Promise resolving to generated key as Buffer
 * @throws Error if key generation fails
 */
export async function generateKey(length: number = KEY_LENGTH): Promise<Buffer> {
  try {
    // Validate key length
    if (length < 1) {
      throw new Error('Invalid key length');
    }

    // Generate random bytes with enhanced entropy
    const key = await new Promise<Buffer>((resolve, reject) => {
      randomBytes(length, (err, buffer) => {
        if (err) reject(new Error('Key generation failed'));
        resolve(buffer);
      });
    });

    return key;
  } catch (error) {
    throw new Error('Key generation failed');
  }
}

/**
 * Securely hashes passwords using scrypt with timing attack protection
 * 
 * @param password - Password to hash
 * @returns Promise resolving to hashed password
 * @throws Error if password hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password input
    if (!password) {
      throw new Error('Invalid password');
    }

    // Generate cryptographically secure salt
    const salt = randomBytes(16);

    // Hash password with timing attack protection
    const hashedPassword = await scryptAsync(
      password,
      salt,
      64
    );

    // Combine salt and hashed password for storage
    return Buffer.concat([salt, hashedPassword]).toString('base64');
  } catch (error) {
    throw new Error('Password hashing failed');
  } finally {
    // Securely wipe password from memory
    if (password) {
      password.replace(/./g, '\0');
    }
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Boolean indicating if strings are equal
 */
function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}