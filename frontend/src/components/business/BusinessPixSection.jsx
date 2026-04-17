import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { useClipboard } from '@/hooks/useClipboard.js';
import { buildPixPayload } from '@/utils/pix.js';

export function BusinessPixSection({ section, onTrackAction }) {
  const pix = section.settings;
  const { copy, lastCopied } = useClipboard();
  const [amount, setAmount] = useState('');
  const numericAmount = Number(amount.replace(',', '.'));
  const pixPayload = buildPixPayload(pix, numericAmount > 0 ? numericAmount : undefined);

  if (!pix?.key) {
    return null;
  }

  return (
    <Card className="section-card pix-card">
      <SectionHeader title={section.title} description={section.description || pix.description} />
      <div className="two-column-grid">
        <div className="info-stack">
          <div className="info-card">
            <span>Chave PIX</span>
            <strong>{pix.key}</strong>
          </div>
          <div className="info-card">
            <span>Recebedor</span>
            <strong>{pix.receiverName}</strong>
          </div>
          <label className="field">
            <span>Valor opcional</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </label>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={async () => {
                await copy(pix.key);
                onTrackAction?.({
                  eventType: 'copy_action',
                  sectionType: 'pix',
                  targetType: 'pix_key',
                  targetLabel: pix.receiverName,
                });
              }}
            >
              {lastCopied === pix.key ? 'Chave copiada' : pix.actionLabel || 'Copiar chave PIX'}
            </Button>
            <Button
              onClick={async () => {
                await copy(pixPayload);
                onTrackAction?.({
                  eventType: 'copy_action',
                  sectionType: 'pix',
                  targetType: 'pix_payload',
                  targetLabel: pix.receiverName,
                });
              }}
            >
              {lastCopied === pixPayload ? 'Código copiado' : 'Copiar código PIX'}
            </Button>
          </div>
        </div>
        <div className="qr-panel">
          <div className="qr-frame">
            <QRCode value={pixPayload} size={180} />
          </div>
          <p>{pix.description}</p>
        </div>
      </div>
    </Card>
  );
}

