/**
 * Font configuration for the AI-Driven Application Intake Platform
 * Implements WCAG 2.1 Level AA compliant typography with Material-UI v5 compatibility
 * @version 1.0.0
 */

// @fontsource/roboto v5.0.0 - Primary font family import
import '@fontsource/roboto/300.css';  // Light
import '@fontsource/roboto/400.css';  // Regular
import '@fontsource/roboto/500.css';  // Medium
import '@fontsource/roboto/700.css';  // Bold

/**
 * Font family definitions with fallback stacks
 * Primary: Roboto for consistent cross-platform rendering
 * Secondary: System fonts for optimal performance where Roboto isn't needed
 */
export const fontFamily = {
  primary: '"Roboto", "Helvetica", "Arial", sans-serif',
  secondary: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif'
} as const;

/**
 * Standardized font weights following Material-UI conventions
 * Ensures consistent typography across the application
 */
export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  bold: 700
} as const;

/**
 * WCAG 2.1 Level AA compliant font sizes
 * Base size of 16px (1rem) with proportional scaling
 * All values in rem for better accessibility and responsive design
 */
export const fontSize = {
  base: 1,          // 16px
  h1: 2.5,         // 40px
  h2: 2,           // 32px
  h3: 1.75,        // 28px
  body1: 1,        // 16px
  body2: 0.875     // 14px
} as const;

/**
 * Font display strategy for optimized loading
 * 'swap' ensures text remains visible during webfont load
 */
export const FONT_DISPLAY = 'swap' as const;

/**
 * Base font size in pixels
 * Used for rem calculations and ensuring minimum readable size
 */
export const BASE_FONT_SIZE = 16 as const;

/**
 * Typography scale ratios for consistent visual hierarchy
 * Following Material Design type scale
 */
export const fontScale = {
  minorThird: 1.2,
  majorThird: 1.25,
  perfect: 1.333
} as const;

/**
 * Line height values for optimal readability
 * WCAG 2.1 Level AA requires sufficient line spacing
 */
export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75
} as const;

/**
 * Letter spacing adjustments for improved legibility
 * Values in em for proportional scaling
 */
export const letterSpacing = {
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  heading: '-0.0125em'
} as const;