/**
 * @fileoverview Centralized icon exports with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 * 
 * This file exports Material-UI icons and custom icon configurations
 * with proper accessibility support and theme compatibility.
 */

// @mui/icons-material v5.x
import {
  Dashboard as DashboardIcon,
  DocumentScanner as DocumentScannerIcon,
  Description as DescriptionIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Notifications as NotificationsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { SvgIconComponent } from '@mui/material';

/**
 * Type definition for status indicator icons ensuring WCAG compliance
 */
export interface StatusIconsType {
  success: SvgIconComponent;
  error: SvgIconComponent;
  warning: SvgIconComponent;
  info: SvgIconComponent;
}

/**
 * Type definition for theme switching icons with accessibility support
 */
export interface ThemeIconsType {
  dark: SvgIconComponent;
  light: SvgIconComponent;
}

// Navigation and Feature Icons
export {
  DashboardIcon,
  DocumentScannerIcon,
  DescriptionIcon,
  SettingsIcon,
  PersonIcon,
  NotificationsIcon,
};

/**
 * Status indicator icons with WCAG 2.1 Level AA compliant colors
 */
export const StatusIcons: StatusIconsType = {
  success: CheckCircleIcon,
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
};

/**
 * Theme switching icons with proper accessibility labels
 */
export const ThemeIcons: ThemeIconsType = {
  dark: DarkModeIcon,
  light: LightModeIcon,
};

// Default export for convenient import of all icons
export default {
  DashboardIcon,
  DocumentScannerIcon,
  DescriptionIcon,
  SettingsIcon,
  PersonIcon,
  NotificationsIcon,
  StatusIcons,
  ThemeIcons,
};