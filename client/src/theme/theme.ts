import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  defaultRadius: 'md',
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 6px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.08), 0 4px 6px rgba(0, 0, 0, 0.04)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.1), 0 8px 10px rgba(0, 0, 0, 0.04)',
  },
  components: {
    Paper: {
      defaultProps: {
        shadow: 'xs',
        radius: 'md',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Badge: {
      defaultProps: {
        variant: 'light',
        radius: 'sm',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    NumberInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        overlayProps: { blur: 3 },
      },
    },
    Drawer: {
      defaultProps: {
        overlayProps: { blur: 3 },
      },
    },
    NavLink: {
      styles: (_theme: any, props: any) => ({
        root: props.active ? {
          backgroundColor: 'var(--mantine-color-teal-0)',
          color: 'var(--mantine-color-teal-7)',
          borderLeft: '3px solid var(--mantine-color-teal-6)',
        } : {},
      }),
    },
  },
});
