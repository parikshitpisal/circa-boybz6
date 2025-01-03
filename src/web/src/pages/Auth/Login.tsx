import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import SecurityMonitor from '@security/monitor';
import useAuth from '../../hooks/useAuth';
import Input from '../../components/common/Input/Input';
import Button from '../../components/common/Button/Button';
import { styled } from '@mui/material/styles';
import { 
  Box, 
  Typography, 
  FormControlLabel, 
  Checkbox, 
  Alert, 
  Paper,
  CircularProgress
} from '@mui/material';

// Styled components for enhanced visual hierarchy
const LoginContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  maxWidth: '400px',
  width: '100%',
  margin: '40px auto',
  borderRadius: '8px',
  boxShadow: theme.shadows[3],
}));

const Form = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
});

// Interface for login form data
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Interface for component state
interface LoginState {
  isLoading: boolean;
  error: string | null;
  attemptCount: number;
  deviceFingerprint: string;
}

/**
 * Enhanced Login component with comprehensive security features
 * Implements OAuth 2.0 + JWT authentication with MFA support
 */
const Login: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { login, mfaRequired } = useAuth();
  const securityMonitor = new SecurityMonitor();
  
  // Form handling with validation
  const { handleSubmit, formState: { errors } } = useForm<LoginFormData>();

  // Component state
  const [state, setState] = useState<LoginState>({
    isLoading: false,
    error: null,
    attemptCount: 0,
    deviceFingerprint: ''
  });

  // Form field states with validation
  const [email, setEmail] = useState({ value: '', isValid: false });
  const [password, setPassword] = useState({ value: '', isValid: false });
  const [rememberMe, setRememberMe] = useState(false);

  // Generate device fingerprint on mount
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fingerprint = await securityMonitor.generateDeviceFingerprint();
        setState(prev => ({ ...prev, deviceFingerprint: fingerprint }));
      } catch (error) {
        console.error('Failed to generate device fingerprint:', error);
      }
    };
    generateFingerprint();
  }, []);

  // Handle form submission with security measures
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check rate limiting
      if (await securityMonitor.isRateLimited('login', state.attemptCount)) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Track login attempt
      securityMonitor.trackLoginAttempt({
        email: data.email,
        timestamp: new Date(),
        deviceFingerprint: state.deviceFingerprint
      });

      // Attempt login
      await login({
        email: data.email,
        password: data.password,
        deviceFingerprint: state.deviceFingerprint
      });

      // Handle MFA requirement
      if (mfaRequired) {
        navigate('/auth/mfa');
        return;
      }

      // Store session if remember me is checked
      if (data.rememberMe) {
        localStorage.setItem('rememberDevice', state.deviceFingerprint);
      }

      navigate('/dashboard');
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        attemptCount: prev.attemptCount + 1
      }));

      // Log security incident
      securityMonitor.logSecurityEvent('LOGIN_FAILURE', {
        email: data.email,
        attemptCount: state.attemptCount + 1,
        deviceFingerprint: state.deviceFingerprint
      });
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [login, navigate, mfaRequired, state.attemptCount, state.deviceFingerprint]);

  return (
    <LoginContainer>
      <Typography 
        variant="h4" 
        component="h1" 
        gutterBottom 
        align="center"
        aria-label="Login to your account"
      >
        Login
      </Typography>

      {state.error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          role="alert"
          aria-live="polite"
        >
          {state.error}
        </Alert>
      )}

      <Form 
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label="Login form"
      >
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          value={email.value}
          error={errors.email?.message}
          required
          ariaLabel="Email address"
          validationRules={{
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            minLength: 5,
            maxLength: 100
          }}
          onChange={(value, isValid) => setEmail({ value, isValid })}
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          value={password.value}
          error={errors.password?.message}
          required
          sensitive
          ariaLabel="Password"
          validationRules={{
            minLength: 12,
            maxLength: 128
          }}
          onChange={(value, isValid) => setPassword({ value, isValid })}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              color="primary"
              aria-label="Remember this device"
            />
          }
          label="Remember this device"
        />

        <Button
          type="submit"
          fullWidth
          disabled={state.isLoading || !email.isValid || !password.isValid}
          ariaLabel="Sign in"
          startIcon={state.isLoading ? <CircularProgress size={20} /> : null}
        >
          {state.isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography
            variant="body2"
            color="textSecondary"
            component="p"
          >
            Forgot your password?{' '}
            <Button
              variant="text"
              color="primary"
              onClick={() => navigate('/auth/reset-password')}
              ariaLabel="Reset password"
            >
              Reset it here
            </Button>
          </Typography>
        </Box>
      </Form>
    </LoginContainer>
  );
});

Login.displayName = 'Login';

export default Login;