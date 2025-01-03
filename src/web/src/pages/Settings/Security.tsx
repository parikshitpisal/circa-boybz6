import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Switch,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  Divider,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Security as SecurityIcon,
  QrCode as QrCodeIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  DevicesOther as DevicesIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

import Card from '../../components/common/Card/Card';
import { useAuth } from '../../hooks/useAuth';
import { authConfig } from '../../config/auth.config';

interface SecurityEvent {
  type: string;
  timestamp: Date;
  details: Record<string, any>;
}

interface DeviceInfo {
  id: string;
  deviceName: string;
  lastActive: Date;
  ipAddress: string;
  browser: string;
  location: string;
}

interface SecuritySettings {
  mfaEnabled: boolean;
  mfaMethod: 'totp' | 'email' | 'sms';
  lastLogin: Date;
  sessionTimeout: number;
  securityEvents: SecurityEvent[];
  passwordLastChanged: Date;
  activeDevices: DeviceInfo[];
}

const Security: React.FC = () => {
  const { user, verifyMFA, updateSecuritySettings, getSecurityActivity } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMFADialog, setShowMFADialog] = useState(false);
  const [mfaCode, setMFACode] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);

  // Load security settings
  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        setLoading(true);
        const securityData = await getSecurityActivity();
        setSettings(securityData);
      } catch (err) {
        setError('Failed to load security settings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSecuritySettings();
  }, [getSecurityActivity]);

  // Handle MFA toggle
  const handleMFAToggle = useCallback(async (enabled: boolean) => {
    try {
      if (enabled) {
        const response = await updateSecuritySettings({ setupMFA: true });
        setQrCode(response.qrCode);
        setShowMFADialog(true);
      } else {
        await updateSecuritySettings({ disableMFA: true });
        setSettings(prev => prev ? { ...prev, mfaEnabled: false } : null);
      }
    } catch (err) {
      setError('Failed to update MFA settings');
      console.error(err);
    }
  }, [updateSecuritySettings]);

  // Verify MFA setup
  const handleVerifyMFA = useCallback(async () => {
    try {
      await verifyMFA(mfaCode);
      setSettings(prev => prev ? { ...prev, mfaEnabled: true } : null);
      setShowMFADialog(false);
      setMFACode('');
    } catch (err) {
      setError('Invalid MFA code');
    }
  }, [verifyMFA, mfaCode]);

  // Handle session timeout update
  const handleSessionTimeoutUpdate = useCallback(async (timeout: number) => {
    try {
      await updateSecuritySettings({ sessionTimeout: timeout });
      setSettings(prev => prev ? { ...prev, sessionTimeout: timeout } : null);
    } catch (err) {
      setError('Failed to update session timeout');
      console.error(err);
    }
  }, [updateSecuritySettings]);

  if (loading) {
    return <CircularProgress />;
  }

  if (!settings) {
    return <Alert severity="error">Failed to load security settings</Alert>;
  }

  return (
    <Grid container spacing={3}>
      {error && (
        <Grid item xs={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {/* MFA Configuration */}
      <Grid item xs={12}>
        <Card>
          <Typography variant="h6" gutterBottom>
            <SecurityIcon /> Multi-Factor Authentication
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Switch
                checked={settings.mfaEnabled}
                onChange={(e) => handleMFAToggle(e.target.checked)}
                disabled={user?.role === 'ADMIN' && authConfig.mfaConfig.requiredForAdmin}
              />
            </Grid>
            <Grid item>
              <Typography>
                {settings.mfaEnabled ? 'Enabled' : 'Disabled'}
              </Typography>
            </Grid>
          </Grid>
          {settings.mfaEnabled && (
            <Typography variant="body2" color="textSecondary">
              Using {settings.mfaMethod.toUpperCase()} authentication
            </Typography>
          )}
        </Card>
      </Grid>

      {/* Active Sessions */}
      <Grid item xs={12}>
        <Card>
          <Typography variant="h6" gutterBottom>
            <DevicesIcon /> Active Devices
          </Typography>
          <List>
            {settings.activeDevices.map((device) => (
              <ListItem key={device.id}>
                <ListItemText
                  primary={device.deviceName}
                  secondary={`Last active: ${format(device.lastActive, 'PPpp')}`}
                />
                <ListItemSecondary>
                  <Typography variant="body2" color="textSecondary">
                    {device.location} • {device.browser}
                  </Typography>
                  <IconButton
                    onClick={() => updateSecuritySettings({ revokeDevice: device.id })}
                  >
                    <WarningIcon color="error" />
                  </IconButton>
                </ListItemSecondary>
              </ListItem>
            ))}
          </List>
        </Card>
      </Grid>

      {/* Security Activity */}
      <Grid item xs={12}>
        <Card>
          <Typography variant="h6" gutterBottom>
            <HistoryIcon /> Security Activity
          </Typography>
          <List>
            {settings.securityEvents.map((event, index) => (
              <ListItem key={index}>
                <ListItemText
                  primary={event.type}
                  secondary={format(event.timestamp, 'PPpp')}
                />
                <Typography variant="body2" color="textSecondary">
                  {event.details.location}
                </Typography>
              </ListItem>
            ))}
          </List>
        </Card>
      </Grid>

      {/* MFA Setup Dialog */}
      <Dialog open={showMFADialog} onClose={() => setShowMFADialog(false)}>
        <DialogTitle>Setup MFA</DialogTitle>
        <DialogContent>
          {qrCode && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <img src={qrCode} alt="MFA QR Code" />
            </div>
          )}
          <TextField
            fullWidth
            label="Enter MFA Code"
            value={mfaCode}
            onChange={(e) => setMFACode(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMFADialog(false)}>Cancel</Button>
          <Button onClick={handleVerifyMFA} color="primary">
            Verify
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default Security;