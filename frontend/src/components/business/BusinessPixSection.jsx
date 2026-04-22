import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { buildPixPayload } from '@/utils/pix.js';

export function BusinessPixSection({ section }) {
  const pix = section.settings;
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
