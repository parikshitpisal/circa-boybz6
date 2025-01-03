import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import Card from '../../components/common/Card/Card';
import Input from '../../components/common/Input/Input';
import useAuth from '../../hooks/useAuth';

// Styled components for enhanced accessibility and theme support
const StyledSection = styled('section')(({ theme }) => ({
  marginBottom: theme.spacing(4),
  '&:last-child': {
    marginBottom: 0,
  },
}));

const StyledAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  '& .MuiAlert-message': {
    width: '100%',
  },
}));

interface ProfileFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mfaEnabled: boolean;
  lastPasswordChange: Date;
}

const Profile: React.FC = () => {
  const theme = useTheme();
  const { user, updateProfile, setupMFA } = useAuth();
  
  // Form state management
  const [formData, setFormData] = useState<ProfileFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: '',
    mfaEnabled: false,
    lastPasswordChange: new Date(),
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; secret: string } | null>(null);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        lastPasswordChange: new Date(user.lastPasswordChange),
      });
    }
  }, [user]);

  // Handle form field changes with validation
  const handleFieldChange = useCallback((field: keyof ProfileFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  }, []);

  // Handle profile update with security measures
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
      });

      setSuccess('Profile updated successfully');
      // Announce success for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Profile updated successfully';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle MFA setup with security confirmation
  const handleMFASetup = async () => {
    try {
      setLoading(true);
      const setupData = await setupMFA();
      setMfaSetupData(setupData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Profile Settings Form">
      <Grid container spacing={3}>
        {/* Status Messages */}
        {error && (
          <Grid item xs={12}>
            <StyledAlert 
              severity="error" 
              role="alert"
              aria-live="assertive"
            >
              {error}
            </StyledAlert>
          </Grid>
        )}
        
        {success && (
          <Grid item xs={12}>
            <StyledAlert 
              severity="success"
              role="status"
              aria-live="polite"
            >
              {success}
            </StyledAlert>
          </Grid>
        )}

        {/* Personal Information Section */}
        <Grid item xs={12}>
          <Card>
            <StyledSection>
              <Typography variant="h6" component="h2" gutterBottom>
                Personal Information
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Input
                    id="firstName"
                    name="firstName"
                    label="First Name"
                    value={formData.firstName}
                    onChange={(value) => handleFieldChange('firstName', value)}
                    required
                    ariaLabel="First Name"
                    validationRules={{
                      minLength: 2,
                      maxLength: 50,
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Input
                    id="lastName"
                    name="lastName"
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(value) => handleFieldChange('lastName', value)}
                    required
                    ariaLabel="Last Name"
                    validationRules={{
                      minLength: 2,
                      maxLength: 50,
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Input
                    id="email"
                    name="email"
                    label="Email Address"
                    value={formData.email}
                    onChange={(value) => handleFieldChange('email', value)}
                    type="email"
                    required
                    ariaLabel="Email Address"
                  />
                </Grid>
              </Grid>
            </StyledSection>
          </Card>
        </Grid>

        {/* Security Settings Section */}
        <Grid item xs={12}>
          <Card>
            <StyledSection>
              <Typography variant="h6" component="h2" gutterBottom>
                Security Settings
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Role: {formData.role}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Last Password Change: {formData.lastPasswordChange.toLocaleDateString()}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    variant="contained"
                    color={formData.mfaEnabled ? "secondary" : "primary"}
                    onClick={handleMFASetup}
                    disabled={loading}
                    aria-label={formData.mfaEnabled ? "Disable MFA" : "Enable MFA"}
                  >
                    {formData.mfaEnabled ? "Disable MFA" : "Enable MFA"}
                  </Button>
                </Grid>

                {mfaSetupData && (
                  <Grid item xs={12}>
                    <Typography variant="body1" gutterBottom>
                      Scan the QR code below with your authenticator app:
                    </Typography>
                    <img
                      src={mfaSetupData.qrCode}
                      alt="MFA QR Code"
                      style={{ maxWidth: '200px' }}
                    />
                    <Typography variant="body2" color="textSecondary">
                      Manual entry code: {mfaSetupData.secret}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </StyledSection>
          </Card>
        </Grid>

        {/* Form Actions */}
        <Grid item xs={12}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            aria-label="Save Profile Changes"
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Save Changes'
            )}
          </Button>
        </Grid>
      </Grid>
    </form>
  );
};

export default Profile;