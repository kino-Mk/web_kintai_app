import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import React from 'react';

describe('Button Component', () => {
  it('should render children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should show loading spinner when isLoading is true', () => {
    const { container } = render(<Button isLoading>Submit</Button>);
    // Check for the Lucide-react spin icon (Loader2)
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('animate-spin');
  });

  it('should be disabled when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should apply variant classes correctly', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });
});
