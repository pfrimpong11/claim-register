import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('identifies the application', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: 'Claims Register' })).toBeInTheDocument();
  });
});
