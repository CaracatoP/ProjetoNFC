import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessContactSection({ section, onTrackAction }) {
  if (!section.items?.length && !section.settings?.hours?.length) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className={`contact-layout ${section.settings?.hours?.length ? 'contact-layout--with-hours' : ''}`}>
        <div className="contact-grid">
          {section.items.map((item) => (
            <a
              key={item.id}
              href={item.href || '#'}
              target={item.href?.startsWith('http') ? '_blank' : '_self'}
              rel="noreferrer"
              className="info-card"
              onClick={() =>
                onTrackAction?.({
                  eventType: 'link_click',
                  sectionType: 'contact',
                  targetType: item.label,
                  targetId: item.id,
                  targetLabel: item.value,
                })
              }
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </a>
          ))}
        </div>

        {section.settings?.hours?.length ? (
          <div className="hours-card">
            <h3>Horarios</h3>
            <ul>
              {section.settings.hours.map((hour) => (
                <li key={hour.id}>
                  <span>{hour.label}</span>
                  <strong>{hour.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
