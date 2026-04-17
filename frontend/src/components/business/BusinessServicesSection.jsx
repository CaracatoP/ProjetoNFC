import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { useClipboard } from '@/hooks/useClipboard.js';
import { formatCurrency } from '@/utils/formatters.js';
import { buildPixPayload } from '@/utils/pix.js';

export function BusinessServicesSection({ business, section, onTrackAction }) {
  const [selectedService, setSelectedService] = useState(null);
  const { copy, lastCopied } = useClipboard();
  const pix = business.contact?.pix;
  const pixPayload = selectedService && pix ? buildPixPayload(pix, selectedService.price) : '';

  if (!section.items?.length) {
    return null;
  }

  return (
    <>
      <Card className="section-card">
        <SectionHeader title={section.title} description={section.description} />
        <div className="service-grid">
          {section.items.map((service) => (
            <article key={service.id} className="service-card">
              <div className="service-card__header">
                <h3>{service.name}</h3>
                <strong>{formatCurrency(service.price)}</strong>
              </div>
              {service.description ? <p>{service.description}</p> : null}
              <div className="service-card__actions">
                <Button
                  variant="secondary"
                  disabled={!pix}
                  onClick={() => {
                    setSelectedService(service);
                    onTrackAction?.({
                      eventType: 'qr_view',
                      sectionType: 'services',
                      targetType: 'service_qr',
                      targetId: service.id,
                      targetLabel: service.name,
                    });
                  }}
                >
                  {service.ctaLabel || 'Gerar QR PIX'}
                </Button>
                <Button
                  disabled={!pix}
                  onClick={async () => {
                    const servicePixPayload = buildPixPayload(pix, service.price);
                    await copy(servicePixPayload);
                    onTrackAction?.({
                      eventType: 'copy_action',
                      sectionType: 'services',
                      targetType: 'pix_payload',
                      targetId: service.id,
                      targetLabel: service.name,
                    });
                  }}
                >
                  {lastCopied === buildPixPayload(pix, service.price) ? 'Codigo copiado' : 'Copiar codigo PIX'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Card>

      <Modal open={Boolean(selectedService)} title={selectedService?.name || 'PIX'} onClose={() => setSelectedService(null)}>
        {selectedService && pix ? (
          <div className="qr-stack">
            <p>Pagamento instantâneo para {selectedService.name}.</p>
            <div className="qr-frame">
              <QRCode value={pixPayload} size={180} />
            </div>
            <p className="qr-caption">{formatCurrency(selectedService.price)}</p>
            <Button
              variant="secondary"
              onClick={async () => {
                await copy(pixPayload);
                onTrackAction?.({
                  eventType: 'copy_action',
                  sectionType: 'services',
                  targetType: 'pix_payload',
                  targetId: selectedService.id,
                  targetLabel: selectedService.name,
                });
              }}
            >
              Copiar código PIX
            </Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
