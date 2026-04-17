import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessSocialSection({ section, onTrackAction }) {
  if (!section.items?.length) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className="action-grid action-grid--compact">
        {section.items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target={item.target || '_blank'}
            rel="noreferrer"
            className="action-tile action-tile--compact"
            onClick={() =>
              onTrackAction?.({
                eventType: 'link_click',
                sectionType: 'social',
                targetType: item.type,
                targetId: item.id,
                targetLabel: item.label,
              })
            }
          >
            <strong>{item.label}</strong>
            {item.subtitle ? <span>{item.subtitle}</span> : null}
          </a>
        ))}
      </div>
    </Card>
  );
}
