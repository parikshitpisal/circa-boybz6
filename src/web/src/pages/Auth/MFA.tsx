import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  FormHelperText,
  Select,
  MenuItem,
  Box
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { MFACredentials } from '../../interfaces/auth.interface';

/**
 * Enhanced MFA verification component implementing secure 2FA requirements
 * from Section 7.1.1 of Technical Specifications
 */
const MFA: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyMFA, loading } = useAuth();

  // Form state
  const [credentials, setCredentials] = useState<MFACredentials>({
    token: '',
    backupCode: '',
    verificationMethod: 'totp',
    deviceFingerprint: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState(3);
  const [tokenStrength, setTokenStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  /**
   * Initialize device fingerprint on component mount
   */
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const deviceData = {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(deviceData));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        setCredentials(prev => ({
          ...prev,
          deviceFingerprint: fingerprint
        }));
      } catch (error) {
        console.error('Failed to generate device fingerprint:', error);
        setError('Error initializing security features');
      }
    };

    generateFingerprint();
  }, []);

  /**
   * Validate token format and update strength indicator
   */
  const validateToken = useCallback((token: string): boolean => {
    if (!/^\d{6}$/.test(token)) {
      setTokenStrength('weak');
      return false;
    }

    const uniqueDigits = new Set(token.split('')).size;
    setTokenStrength(uniqueDigits >= 4 ? 'strong' : 'medium');
    return true;
  }, []);

  /**
   * Handle input changes with validation
   */
  const handleInputChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    const { name, value } = event.target;
    
    if (name === 'token' && typeof value === 'string') {
      const sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, 6);
      validateToken(sanitizedValue);
      setCredentials(prev => ({ ...prev, [name]: sanitizedValue }));
    } else {
      setCredentials(prev => ({ ...prev, [name as string]: value }));
    }
    
    setError(null);
  }, [validateToken]);

  /**
   * Handle MFA verification submission with rate limiting and security monitoring
   */
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (remainingAttempts <= 0) {
      setError('Too many failed attempts. Please try again later.');
      return;
    }

    if (!credentials.deviceFingerprint) {
      setError('Security verification failed. Please refresh the page.');
      return;
    }

    if (!validateToken(credentials.token)) {
      setError('Invalid token format. Please enter a 6-digit code.');
      return;
    }

    try {
      await verifyMFA(credentials);
      navigate(location.state?.from || '/dashboard');
    } catch (error) {
      setRemainingAttempts(prev => prev - 1);
      setError(error instanceof Error ? error.message : 'Verification failed');
    }
  }, [credentials, remainingAttempts, validateToken, verifyMFA, navigate, location.state?.from]);

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="background.default"
    >
      <Card sx={{ maxWidth: 400, width: '100%', m: 2 }}>
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Two-Factor Authentication
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <FormControl fullWidth margin="normal">
              <Select
                name="verificationMethod"
                value={credentials.verificationMethod}
                onChange={handleInputChange}
                disabled={loading}
              >
                <MenuItem value="totp">Authenticator App</MenuItem>
                <MenuItem value="backup">Backup Code</MenuItem>
              </Select>
              <FormHelperText>
                Select your verification method
              </FormHelperText>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <TextField
                name="token"
                label={credentials.verificationMethod === 'totp' ? 'Enter 6-digit code' : 'Enter backup code'}
                value={credentials.token}
                onChange={handleInputChange}
                autoComplete="one-time-code"
                inputMode="numeric"
                error={!!error}
                disabled={loading}
                inputProps={{
                  maxLength: 6,
                  pattern: '[0-9]*',
                  'aria-label': 'verification code'
                }}
              />
              <FormHelperText>
                {tokenStrength === 'strong' && 'Strong code'}
                {tokenStrength === 'medium' && 'Medium strength code'}
                {tokenStrength === 'weak' && 'Enter a valid 6-digit code'}
              </FormHelperText>
            </FormControl>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || remainingAttempts <= 0}
              sx={{ mt: 2 }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Verify'
              )}
            </Button>

            {remainingAttempts < 3 && (
              <Typography color="error" variant="caption" display="block" sx={{ mt: 1 }}>
                {remainingAttempts} attempts remaining
              </Typography>
            )}
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MFA;