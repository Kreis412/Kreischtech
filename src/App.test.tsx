import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('ContractorSight hub', () => {
  it('provides the web app and verified testing invitation, without advertising a public Play release', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /Open ContractorSight/ })).toHaveAttribute('href', 'https://contractorsight-pilot.onrender.com/');
    expect(screen.getByRole('link', { name: /Check Google Play test access/ })).toHaveAttribute('href', 'https://play.google.com/apps/testing/com.kreischtech.contractorsight');
    expect(screen.getByText(/submitted for Google review/)).toBeInTheDocument();
    expect(screen.queryByText(/Buy AgentOS/)).not.toBeInTheDocument();
  });
});
