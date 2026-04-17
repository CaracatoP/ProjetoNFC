import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessMapSection({ section, onTrackAction }) {
  const { settings } = section;

  if (!settings?.mapUrl && !settings?.embedUrl) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title || 'Mapa'} description={section.description || settings.display} />
      {settings.embedUrl ? (
        <iframe
          className="map-frame"
          src={settings.embedUrl}
          title={section.title || 'Mapa do negócio'}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
      <Button
        href={settings.mapUrl}
        target="_blank"
        variant="secondary"
        onClick={() =>
          onTrackAction?.({
            eventType: 'link_click',
            sectionType: 'map',
            targetType: 'map',
            targetLabel: settings.display,
          })
        }
      >
        Abrir rota no mapa
      </Button>
    </Card>
  );
}

