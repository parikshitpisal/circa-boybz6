import React from 'react'; // v18.x
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogProps } from '@mui/material'; // v5.x
import { styled } from '@mui/material/styles'; // v5.x
import { CustomButton } from '../Button/Button';

// Enhanced dialog props interface with accessibility and customization options
export interface CustomDialogProps extends DialogProps {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  ariaDescribedBy?: string;
}

// Styled components with theme integration
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '8px',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
    transition: 'box-shadow 0.3s ease-in-out',
    [theme.breakpoints.down('sm')]: {
      margin: '16px',
    },
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: '16px 24px',
  fontSize: {
    xs: '1.125rem',
    sm: '1.25rem',
  },
  fontWeight: 500,
  lineHeight: 1.6,
  color: theme.palette.text.primary,
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: {
    xs: '12px 16px',
    sm: '16px 24px',
  },
  minHeight: '120px',
  overflowY: 'auto',
  color: theme.palette.text.secondary,
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: {
    xs: '12px 16px',
    sm: '16px 24px',
  },
  gap: '8px',
  flexWrap: 'wrap',
  '& > button': {
    margin: 0, // Override default MUI margin
  },
}));

// Main dialog component with accessibility enhancements
export const CustomDialog = React.memo<CustomDialogProps>(({
  title,
  children,
  open,
  onClose,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  ariaDescribedBy,
  ...props
}) => {
  // Generate unique IDs for accessibility
  const titleId = React.useId();
  const contentId = React.useId();

  // Handle escape key press
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Focus trap management
  const dialogRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    if (open) {
      // Set initial focus to the dialog
      dialogRef.current?.focus();
      
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [open]);

  return (
    <StyledDialog
      ref={dialogRef}
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy || contentId}
      onKeyDown={handleKeyDown}
      scroll="paper"
      {...props}
    >
      <StyledDialogTitle id={titleId}>
        {title}
      </StyledDialogTitle>
      
      <StyledDialogContent id={contentId}>
        {children}
      </StyledDialogContent>
      
      {actions && (
        <StyledDialogActions>
          {actions}
        </StyledDialogActions>
      )}
    </StyledDialog>
  );
});

// Display name for debugging
CustomDialog.displayName = 'CustomDialog';

export default CustomDialog;