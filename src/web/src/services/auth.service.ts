import { ApiService } from './api.service';
import { 
  LoginCredentials, 
  MFACredentials, 
  AuthTokens, 
  AuthUser, 
  UserRole 
} from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';
import { ERROR_CODES } from '../constants/api.constants';

/**
 * Enhanced authentication service implementing OAuth 2.0 with JWT tokens
 * Provides comprehensive security features including MFA, session monitoring,
 * and role-based access control as specified in Section 7.1
 * @version 1.0.0
 */
export class AuthService {
  private readonly tokenKey = authConfig.tokenConfig.storageKey;
  private readonly sessionTimeout: number = authConfig.securityConfig.sessionTimeout;
  private sessionTimer: NodeJS.Timeout | null = null;
  private failedAttempts: number = 0;

  constructor(private readonly apiService: ApiService) {
    this.setupSessionMonitoring();
  }

  /**
   * Authenticate user with enhanced security measures
   * @param credentials - User login credentials
   * @returns Promise with authentication tokens
   * @throws ApiError for authentication failures
   */
  public async login(credentials: LoginCredentials): Promise<AuthTokens> {
    try {
      // Check for account lockout
      if (this.isAccountLocked()) {
        throw new Error('Account temporarily locked. Please try again later.');
      }

      const response = await this.apiService.post<AuthTokens>(
        authConfig.authEndpoints.login,
        credentials
      );

      // Reset failed attempts on successful login
      this.failedAttempts = 0;
      
      // Store tokens securely
      this.setTokens(response);
      
      // Initialize session monitoring
      this.startSessionTimer();

      return response;
    } catch (error) {
      this.handleLoginFailure();
      throw error;
    }
  }

  /**
   * Verify MFA credentials with multiple method support
   * @param mfaCredentials - MFA verification credentials
   * @returns Promise with final authentication tokens
   */
  public async verifyMFA(mfaCredentials: MFACredentials): Promise<AuthTokens> {
    try {
      const response = await this.apiService.post<AuthTokens>(
        authConfig.authEndpoints.mfa.verify,
        mfaCredentials
      );

      // Update tokens after MFA verification
      this.setTokens(response);
      
      return response;
    } catch (error) {
      this.logSecurityEvent('MFA_FAILURE', error);
      throw error;
    }
  }

  /**
   * Secure logout with token revocation
   */
  public async logout(): Promise<void> {
    try {
      await this.apiService.post(authConfig.authEndpoints.logout, {});
      this.clearSession();
    } catch (error) {
      this.logSecurityEvent('LOGOUT_FAILURE', error);
      throw error;
    }
  }

  /**
   * Refresh authentication tokens
   * @returns Promise with new authentication tokens
   */
  public async refreshToken(): Promise<AuthTokens> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.apiService.post<AuthTokens>(
        authConfig.authEndpoints.refresh,
        { refreshToken }
      );

      this.setTokens(response);
      return response;
    } catch (error) {
      this.clearSession();
      throw error;
    }
  }

  /**
   * Validate current session status
   * @returns Promise indicating session validity
   */
  public async validateSession(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch {
      return false;
    }
  }

  /**
   * Get current authenticated user details
   * @returns Promise with user details
   */
  public async getCurrentUser(): Promise<AuthUser> {
    return this.apiService.get<AuthUser>(authConfig.authEndpoints.user);
  }

  /**
   * Check if user has required role
   * @param requiredRole - Required user role
   * @returns Promise indicating authorization status
   */
  public async hasRole(requiredRole: UserRole): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return user.role === requiredRole;
    } catch {
      return false;
    }
  }

  /**
   * Setup MFA for current user
   * @returns Promise with MFA setup details
   */
  public async setupMFA(): Promise<{ secret: string; qrCode: string }> {
    return this.apiService.post(authConfig.authEndpoints.mfa.setup, {});
  }

  private setTokens(tokens: AuthTokens): void {
    localStorage.setItem(this.tokenKey, JSON.stringify({
      ...tokens,
      timestamp: Date.now()
    }));
  }

  private getRefreshToken(): string | null {
    const tokens = localStorage.getItem(this.tokenKey);
    if (!tokens) return null;
    return JSON.parse(tokens).refreshToken;
  }

  private clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
  }

  private setupSessionMonitoring(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === this.tokenKey && !event.newValue) {
        this.clearSession();
      }
    });
  }

  private startSessionTimer(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(() => {
      this.checkSessionExpiry();
    }, 60000); // Check every minute
  }

  private async checkSessionExpiry(): Promise<void> {
    const tokens = localStorage.getItem(this.tokenKey);
    if (!tokens) return;

    const { timestamp } = JSON.parse(tokens);
    const elapsed = (Date.now() - timestamp) / 1000;

    if (elapsed >= this.sessionTimeout) {
      await this.logout();
    }
  }

  private handleLoginFailure(): void {
    this.failedAttempts++;
    
    if (this.failedAttempts >= authConfig.securityConfig.maxLoginAttempts) {
      this.lockAccount();
    }

    this.logSecurityEvent('LOGIN_FAILURE', {
      attempts: this.failedAttempts,
      timestamp: new Date()
    });
  }

  private isAccountLocked(): boolean {
    const lockoutEnd = localStorage.getItem('auth_lockout');
    if (!lockoutEnd) return false;

    const now = Date.now();
    const lockoutEndTime = parseInt(lockoutEnd, 10);

    return now < lockoutEndTime;
  }

  private lockAccount(): void {
    const lockoutEnd = Date.now() + (authConfig.securityConfig.lockoutDuration * 1000);
    localStorage.setItem('auth_lockout', lockoutEnd.toString());
  }

  private logSecurityEvent(event: string, details: any): void {
    if (authConfig.securityConfig.monitoring.logFailedAttempts) {
      console.error('Security Event:', {
        event,
        details,
        timestamp: new Date(),
        userId: this.getCurrentUser()
          .then(user => user.id)
          .catch(() => null)
      });
    }
  }
}

// Export singleton instance
export default new AuthService(new ApiService());