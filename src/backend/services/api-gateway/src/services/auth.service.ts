import { injectable } from 'inversify';
import jwt from 'jsonwebtoken'; // ^9.0.0
import bcrypt from 'bcryptjs'; // ^2.4.3
import speakeasy from 'speakeasy'; // ^2.0.0
import { CacheService } from './cache.service';
import { config } from '../config';
import { SECURITY_CONFIG } from '../../../../shared/constants';

interface UserPayload {
  id: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  permissions: string[];
  lastLogin: number;
  ipAddress: string;
}

interface MFASetup {
  secret: string;
  qrCode: string;
  recoveryCode: string;
  setupTimestamp: number;
  verified: boolean;
}

interface SecurityMetrics {
  failedLogins: number;
  lastAttempt: number;
  ipAddress: string;
}

@injectable()
export class AuthService {
  private readonly cacheService: CacheService;
  private readonly jwtSecret: string;
  private readonly tokenExpiry: number;
  private readonly mfaWindow: number;
  private readonly maxLoginAttempts: number;
  private readonly tokenBlacklistPrefix: string = 'blacklist:';
  private readonly securityMetricsPrefix: string = 'security:';

  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
    this.jwtSecret = config.security.jwtSecret;
    this.tokenExpiry = SECURITY_CONFIG.TOKEN_EXPIRY;
    this.mfaWindow = 30; // 30-second window for MFA token validation
    this.maxLoginAttempts = SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Generates a JWT token with enhanced security checks
   * @param payload User payload for token generation
   * @returns Promise<string> Generated JWT token
   */
  public async generateToken(payload: UserPayload): Promise<string> {
    try {
      // Check for account lockout
      const metrics = await this.getSecurityMetrics(payload.id);
      if (metrics && metrics.failedLogins >= this.maxLoginAttempts) {
        const lockoutTime = metrics.lastAttempt + (15 * 60 * 1000); // 15 minutes lockout
        if (Date.now() < lockoutTime) {
          throw new Error('Account locked due to too many failed attempts');
        }
        await this.resetSecurityMetrics(payload.id);
      }

      // Generate token with enhanced payload
      const token = jwt.sign(
        {
          ...payload,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + this.tokenExpiry
        },
        this.jwtSecret,
        {
          algorithm: 'HS512',
          issuer: 'api-gateway',
          audience: 'application-intake'
        }
      );

      // Cache token metadata for additional security checks
      await this.cacheService.set(
        `token:${payload.id}`,
        {
          token,
          createdAt: Date.now(),
          ipAddress: payload.ipAddress
        },
        {
          ttl: this.tokenExpiry,
          encryption: true,
          namespace: 'auth'
        }
      );

      return token;
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Verifies JWT token with enhanced security monitoring
   * @param token JWT token to verify
   * @returns Promise<UserPayload> Verified user payload
   */
  public async verifyToken(token: string): Promise<UserPayload> {
    try {
      // Check token blacklist
      const isBlacklisted = await this.cacheService.get(
        `${this.tokenBlacklistPrefix}${token}`,
        { namespace: 'auth' }
      );
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Verify token signature and expiration
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS512'],
        issuer: 'api-gateway',
        audience: 'application-intake'
      }) as UserPayload;

      // Additional security checks
      const tokenMetadata = await this.cacheService.get(
        `token:${decoded.id}`,
        { namespace: 'auth', encryption: true }
      );

      if (!tokenMetadata || tokenMetadata.token !== token) {
        throw new Error('Token not found in active sessions');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        await this.blacklistToken(token);
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Generates MFA configuration with recovery options
   * @param userId User ID for MFA setup
   * @returns Promise<MFASetup> Complete MFA setup
   */
  public async generateMFAToken(userId: string): Promise<MFASetup> {
    try {
      const secret = speakeasy.generateSecret({
        length: 32,
        name: `ApplicationIntake:${userId}`
      });

      const recoveryCode = crypto.randomBytes(32).toString('hex');
      const mfaSetup: MFASetup = {
        secret: secret.base32,
        qrCode: secret.otpauth_url!,
        recoveryCode: await bcrypt.hash(recoveryCode, SECURITY_CONFIG.SALT_ROUNDS),
        setupTimestamp: Date.now(),
        verified: false
      };

      // Cache MFA setup with encryption
      await this.cacheService.set(
        `mfa:${userId}`,
        mfaSetup,
        {
          ttl: 3600, // 1 hour to complete setup
          encryption: true,
          namespace: 'auth'
        }
      );

      return {
        ...mfaSetup,
        recoveryCode // Return plain recovery code only during setup
      };
    } catch (error) {
      throw new Error(`MFA setup failed: ${error.message}`);
    }
  }

  /**
   * Validates MFA token with enhanced security
   * @param userId User ID for MFA verification
   * @param token MFA token to verify
   * @returns Promise<boolean> Verification result
   */
  public async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    try {
      const mfaSetup = await this.cacheService.get(
        `mfa:${userId}`,
        { namespace: 'auth', encryption: true }
      );

      if (!mfaSetup) {
        throw new Error('MFA not configured for user');
      }

      const verified = speakeasy.totp.verify({
        secret: mfaSetup.secret,
        encoding: 'base32',
        token,
        window: this.mfaWindow
      });

      if (verified) {
        mfaSetup.verified = true;
        await this.cacheService.set(
          `mfa:${userId}`,
          mfaSetup,
          {
            ttl: 0, // Permanent storage
            encryption: true,
            namespace: 'auth'
          }
        );
      }

      return verified;
    } catch (error) {
      throw new Error(`MFA verification failed: ${error.message}`);
    }
  }

  /**
   * Blacklists a token for security purposes
   * @param token Token to blacklist
   */
  private async blacklistToken(token: string): Promise<void> {
    await this.cacheService.set(
      `${this.tokenBlacklistPrefix}${token}`,
      true,
      {
        ttl: this.tokenExpiry,
        namespace: 'auth'
      }
    );
  }

  /**
   * Retrieves security metrics for a user
   * @param userId User ID to get metrics for
   */
  private async getSecurityMetrics(userId: string): Promise<SecurityMetrics | null> {
    return this.cacheService.get(
      `${this.securityMetricsPrefix}${userId}`,
      { namespace: 'auth', encryption: true }
    );
  }

  /**
   * Resets security metrics for a user
   * @param userId User ID to reset metrics for
   */
  private async resetSecurityMetrics(userId: string): Promise<void> {
    await this.cacheService.del(
      `${this.securityMetricsPrefix}${userId}`,
      { namespace: 'auth' }
    );
  }
}

export default AuthService;