import React, { useState, useCallback, ReactNode } from 'react'; // @version ^18.0.0
import { Tabs as MuiTabs, Tab as MuiTab } from '@mui/material'; // @version ^5.0.0
import { styled } from '@mui/material/styles'; // @version ^5.0.0
import { useTheme } from '../../hooks/useTheme';

// Interfaces
interface TabItem {
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: number;
  onChange?: (index: number) => void;
  ariaLabel?: string;
  className?: string;
}

// Styled components with WCAG 2.1 Level AA compliance
const StyledTabs = styled(MuiTabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTabs-indicator': {
    backgroundColor: theme.palette.mode === 'dark' 
      ? theme.palette.primary.light 
      : theme.palette.primary.main,
    height: 3,
  },
  '& .MuiTabs-flexContainer': {
    gap: theme.spacing(1),
  },
  transition: theme.transitions.create(['background-color', 'color'], {
    duration: theme.transitions.duration.standard,
  }),
}));

const StyledTab = styled(MuiTab)(({ theme }) => ({
  textTransform: 'none',
  minWidth: 0,
  padding: theme.spacing(2, 3),
  fontWeight: theme.typography.fontWeightRegular,
  color: theme.palette.text.secondary,
  '&:hover': {
    color: theme.palette.mode === 'dark' 
      ? theme.palette.primary.light 
      : theme.palette.primary.main,
    opacity: 1,
  },
  '&.Mui-selected': {
    color: theme.palette.mode === 'dark' 
      ? theme.palette.primary.light 
      : theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightMedium,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  '&.Mui-focusVisible': {
    backgroundColor: theme.palette.action.focus,
    outline: `3px solid ${theme.palette.primary.main}`,
    outlineOffset: -1,
  },
  minHeight: 48, // Ensures adequate touch target size
}));

// Tab Panel component for content
const TabPanel = React.memo(({ children, value, index, ...props }: {
  children: ReactNode;
  value: number;
  index: number;
}) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`tab-panel-${index}`}
    aria-labelledby={`tab-${index}`}
    {...props}
  >
    {value === index && children}
  </div>
));

TabPanel.displayName = 'TabPanel';

// Main Tabs component
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab = 0,
  onChange,
  ariaLabel = 'Navigation tabs',
  className,
}) => {
  const { theme } = useTheme();
  const [selectedTab, setSelectedTab] = useState(defaultTab);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const tabCount = tabs.length;
    let newIndex = selectedTab;

    switch (event.key) {
      case 'ArrowLeft':
        newIndex = selectedTab === 0 ? tabCount - 1 : selectedTab - 1;
        // Skip disabled tabs
        while (tabs[newIndex].disabled && newIndex !== selectedTab) {
          newIndex = newIndex === 0 ? tabCount - 1 : newIndex - 1;
        }
        break;
      case 'ArrowRight':
        newIndex = selectedTab === tabCount - 1 ? 0 : selectedTab + 1;
        // Skip disabled tabs
        while (tabs[newIndex].disabled && newIndex !== selectedTab) {
          newIndex = newIndex === tabCount - 1 ? 0 : newIndex + 1;
        }
        break;
      case 'Home':
        newIndex = 0;
        // Find first enabled tab
        while (tabs[newIndex].disabled && newIndex < tabCount - 1) {
          newIndex++;
        }
        break;
      case 'End':
        newIndex = tabCount - 1;
        // Find last enabled tab
        while (tabs[newIndex].disabled && newIndex > 0) {
          newIndex--;
        }
        break;
      default:
        return;
    }

    if (newIndex !== selectedTab && !tabs[newIndex].disabled) {
      event.preventDefault();
      setSelectedTab(newIndex);
      onChange?.(newIndex);
      // Focus the selected tab
      const tabElement = document.getElementById(`tab-${newIndex}`);
      tabElement?.focus();
    }
  }, [selectedTab, tabs, onChange]);

  // Handle tab change
  const handleChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    if (!tabs[newValue].disabled) {
      setSelectedTab(newValue);
      onChange?.(newValue);
    }
  }, [tabs, onChange]);

  return (
    <div className={className} role="navigation">
      <StyledTabs
        value={selectedTab}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        role="tablist"
        theme={theme}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {tabs.map((tab, index) => (
          <StyledTab
            key={`tab-${index}`}
            id={`tab-${index}`}
            label={tab.label}
            aria-controls={`tab-panel-${index}`}
            disabled={tab.disabled}
            theme={theme}
            tabIndex={selectedTab === index ? 0 : -1}
          />
        ))}
      </StyledTabs>
      {tabs.map((tab, index) => (
        <TabPanel key={`panel-${index}`} value={selectedTab} index={index}>
          {tab.content}
        </TabPanel>
      ))}
    </div>
  );
};

export type { TabsProps, TabItem };