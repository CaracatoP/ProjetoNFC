import { fireEvent, render, screen } from '@testing-library/react';
import { BusinessLinksSection } from './BusinessLinksSection.jsx';

describe('BusinessLinksSection', () => {
  it('renders links with url as external anchors even when metadata.action exists', () => {
    const onBusinessAction = vi.fn();

    render(
      <BusinessLinksSection
        section={{
          title: 'Acesso rapido',
          description: 'Atalhos',
          settings: { layout: 'compact' },
          items: [
            {
              id: 'link-whatsapp',
              label: 'WhatsApp',
              subtitle: 'Fale agora',
              icon: 'whatsapp',
              url: 'https://wa.me/5511999999999',
              target: '_blank',
              metadata: { action: 'whatsapp' },
            },
            {
              id: 'link-wifi',
              label: 'Wi-Fi',
              subtitle: 'Abrir acesso',
              icon: 'wifi',
              metadata: { action: 'wifi' },
            },
          ],
        }}
        onBusinessAction={onBusinessAction}
      />,
    );

    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/5511999999999',
    );

    fireEvent.click(screen.getByRole('button', { name: /Wi-Fi/i }));

    expect(onBusinessAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'wifi',
      }),
    );
  });
});
