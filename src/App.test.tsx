import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('KaiAI Website', () => {
  it('renders the hero section with company name', () => {
    render(<App />);
    const kaiElements = screen.getAllByText(/Kai/i);
    expect(kaiElements.length).toBeGreaterThan(0);
  });

  it('displays the construction-first value proposition on landing page', () => {
    render(<App />);
    expect(screen.getByText(/Secure, Local AI Built for the/i)).toBeInTheDocument();
  });

  it('shows the core service packages with "Starting at" pricing', () => {
    render(<App />);
    expect(screen.getByText(/The Foundation/i)).toBeInTheDocument();
    expect(screen.getByText(/\$15k/i)).toBeInTheDocument();
    expect(screen.getByText(/\$75k/i)).toBeInTheDocument();
    expect(screen.getByText(/\$250k/i)).toBeInTheDocument();
  });

  it('navigates to the Data Security page', async () => {
    render(<App />);
    const securityLinks = screen.getAllByText(/Data Security/i);
    
    // Click the nav link
    fireEvent.click(securityLinks[0]);
    
    // Check for the "Security-First" span specifically or use a function matcher
    expect(await screen.findByText(/Security-First/i)).toBeInTheDocument();
    expect(screen.getByText(/Local-First Architecture/i)).toBeInTheDocument();
  });
});
