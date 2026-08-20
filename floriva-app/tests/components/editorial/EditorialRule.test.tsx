import { render, screen } from '@testing-library/react-native';

import { EditorialRule } from '@/src/components/editorial/EditorialRule';

describe('EditorialRule', () => {
  it('renders a hairline divider', () => {
    render(<EditorialRule testID="rule" />);
    expect(screen.getByTestId('rule')).toBeTruthy();
  });

  it('renders an optional center mark', () => {
    render(<EditorialRule mark="OR" testID="rule" />);
    expect(screen.getByText('OR')).toBeTruthy();
  });
});
