import { render } from '@testing-library/react';
import { ActionIcon } from './ActionIcon.jsx';

describe('ActionIcon', () => {
  it('marks brand icons separately from generic theme icons', () => {
    const { container, rerender } = render(<ActionIcon name="whatsapp" />);

    expect(container.querySelector('.action-icon')).toHaveAttribute('data-icon-kind', 'brand');
    expect(container.querySelector('.action-icon')).toHaveClass('action-icon--brand', 'action-icon--whatsapp');

    rerender(<ActionIcon name="email" />);

    expect(container.querySelector('.action-icon')).toHaveAttribute('data-icon-kind', 'generic');
    expect(container.querySelector('.action-icon')).toHaveClass('action-icon--generic', 'action-icon--mail');
  });

  it('renders external icon images without stretching or SVG color inheritance', () => {
    const { container } = render(<ActionIcon name="https://cdn.example.com/icon.png" />);
    const image = container.querySelector('img');

    expect(image).toHaveAttribute('src', 'https://cdn.example.com/icon.png');
    expect(image.closest('.action-icon')).toHaveClass('action-icon--image');
  });
});
