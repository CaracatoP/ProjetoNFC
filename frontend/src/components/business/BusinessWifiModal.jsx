import QRCode from 'react-qr-code';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { useClipboard } from '@/hooks/useClipboard.js';
import { buildWifiPayload } from '@/utils/pix.js';

export function BusinessWifiModal({ open, wifi, onClose, onTrackAction }) {
  const { copy, lastCopied } = useClipboard();
  const qrValue = buildWifiPayload(wifi);

  if (!wifi?.password) {
    return null;
  }

  return (
    <Modal open={open} title={wifi.title || 'Wi-Fi do local'} onClose={onClose}>
      <div className="qr-stack">
        <div className="two-column-grid two-column-grid--compact">
          <div className="info-card info-card--compact">
            <span>Rede</span>
            <strong>{wifi.ssid}</strong>
          </div>
          <div className="info-card info-card--compact">
            <span>Senha</span>
            <strong>{wifi.password}</strong>
          </div>
        </div>

        <div className="button-row">
          <Button
            variant="secondary"
            onClick={async () => {
              await copy(wifi.ssid);
              onTrackAction?.({
                eventType: 'copy_action',
                sectionType: 'wifi',
                targetType: 'wifi_ssid',
                targetLabel: wifi.ssid,
              });
            }}
          >
            {lastCopied === wifi.ssid ? 'Rede copiada' : 'Copiar rede'}
          </Button>
          <Button
            onClick={async () => {
              await copy(wifi.password);
              onTrackAction?.({
                eventType: 'copy_action',
                sectionType: 'wifi',
                targetType: 'wifi_password',
                targetLabel: wifi.ssid,
              });
            }}
          >
            {lastCopied === wifi.password ? 'Senha copiada' : 'Copiar senha'}
          </Button>
        </div>

        {qrValue ? (
          <div className="qr-panel qr-panel--compact">
            <div className="qr-frame">
              <QRCode value={qrValue} size={180} />
            </div>
            <p>{wifi.description || 'Escaneie o QR Code para conectar automaticamente.'}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
