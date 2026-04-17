import QRCode from 'react-qr-code';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { useClipboard } from '@/hooks/useClipboard.js';
import { buildPixPayload } from '@/utils/pix.js';

export function BusinessPixModal({ open, pix, onClose, onTrackAction }) {
  const { copy, lastCopied } = useClipboard();
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
            {lastCopied === pixPayload ? 'Codigo copiado' : 'Copiar codigo PIX'}
          </Button>
        </div>

        <div className="qr-panel qr-panel--compact">
          <div className="qr-frame">
            <QRCode value={pixPayload} size={180} />
          </div>
          <p>{pix.description || 'Escaneie o QR Code ou copie o codigo para pagar.'}</p>
        </div>
      </div>
    </Modal>
  );
}
