import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessCustomSection({ section }) {
  return (
    <Card className="section-card">
      <SectionHeader eyebrow={section.settings?.eyebrow} title={section.title} description={section.description} />
      <div className="story-block">
        {section.items?.map((item) => (
          <p key={item.id}>{item.body}</p>
        ))}
      </div>
    </Card>
  );
}

