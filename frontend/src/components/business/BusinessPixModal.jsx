import QRCode from 'react-qr-code';
import { Modal } from '@/components/common/Modal.jsx';
import { buildPixPayload } from '@/utils/pix.js';

export function BusinessPixModal({ open, pix, onClose }) {
  const pixPayload = buildPixPayload(pix);

  if (!pix?.key) {
    return null;
  }

  return (
    <Modal open={open} title={pix.receiverName || 'Pagamento PIX'} onClose={onClose}>
      <div className="qr-stack">
        <div className="two-column-grid two-column-grid--compact">
          <div className="info-card info-card--compact">
            <span>Chave PIX</span>
            <strong>{pix.key}</strong>
          </div>
          <div className="info-card info-card--compact">
            <span>Recebedor</span>
            <strong>{pix.receiverName}</strong>
          </div>
        </div>

        <div className="qr-panel qr-panel--compact">
          <div className="qr-frame">
            <QRCode value={pixPayload} size={180} />
          </div>
          <p>{pix.description || 'Escaneie o QR Code para pagar.'}</p>
        </div>
      </div>
    </Modal>
  );
}
