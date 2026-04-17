import QRCode from 'react-qr-code';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { useClipboard } from '@/hooks/useClipboard.js';
import { buildWifiPayload } from '@/utils/pix.js';

export function BusinessWifiSection({ section, onTrackAction }) {
  const { settings } = section;
  const { copy, lastCopied } = useClipboard();
  const qrValue = buildWifiPayload(settings);

  if (!settings?.password) {
    return null;
  }

  return (
    <Card className="section-card wifi-card">
      <SectionHeader title={section.title} description={section.description || settings.description} />
      <div className="two-column-grid">
        <div className="info-stack">
          <div className="info-card">
            <span>Rede Wi-Fi</span>
            <strong>{settings.ssid}</strong>
          </div>
          <div className="info-card">
            <span>Senha</span>
            <strong>{settings.password}</strong>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await copy(settings.password);
              onTrackAction?.({
                eventType: 'copy_action',
                sectionType: 'wifi',
                targetType: 'wifi_password',
                targetLabel: settings.ssid,
              });
            }}
          >
            {lastCopied === settings.password ? 'Senha copiada' : 'Copiar senha'}
          </Button>
        </div>
        <div className="qr-panel">
          <div className="qr-frame">
            <QRCode value={qrValue} size={180} />
          </div>
          <p>{section.settings.qrDescription || 'Escaneie para conectar automaticamente.'}</p>
        </div>
      </div>
    </Card>
  );
}

