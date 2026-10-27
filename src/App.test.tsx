import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('ContractorSight hub', () => {
  it('explains ContractorSight and links directly to the public Play listing and web app', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: /Open the web app/ })).toHaveAttribute('href', 'https://contractorsight-pilot.onrender.com/');
    expect(screen.getByRole('link', { name: /Download on Google Play/ })).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=com.kreischtech.contractorsight');
    expect(screen.queryByText(/open-testing release|test access|submitted for Google review/i)).not.toBeInTheDocument();
    expect(screen.getByText(/reviewed estimate and material list/i)).toBeInTheDocument();
    expect(screen.queryByText(/Buy AgentOS/)).not.toBeInTheDocument();
  });
});
