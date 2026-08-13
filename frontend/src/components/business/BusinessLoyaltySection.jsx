import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

function normalizeWhatsapp(whatsapp) {
  return String(whatsapp || '').replace(/\D+/g, '');
}

export function BusinessLoyaltySection({ business, segmentConfig, onTrackAction }) {
  const whatsapp = normalizeWhatsapp(business.contact?.whatsapp);
  const whatsappUrl = whatsapp ? `https://wa.me/${whatsapp}` : '';

  return (
    <Card className="section-card section-card--loyalty">
      <SectionHeader
        eyebrow="Módulo ativo"
        title={segmentConfig?.loyaltyTitle || 'Programa de fidelidade'}
        description={segmentConfig?.loyaltyDescription || 'Mantenha o relacionamento do cliente e destaque benefícios de retorno.'}
      />
      <div className="loyalty-card">
        <strong>Mostre esta seção para clientes recorrentes</strong>
        <p>Use a página NFC para lembrar benefícios, retornos e campanhas especiais do tenant.</p>
        {whatsappUrl ? (
          <Button
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              onTrackAction?.({
                eventType: 'link_click',
                targetType: 'loyalty_contact',
                targetLabel: 'Abrir WhatsApp de fidelidade',
                sectionType: 'loyalty',
              })
            }
          >
            Falar sobre fidelidade
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
