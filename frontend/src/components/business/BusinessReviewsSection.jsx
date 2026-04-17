import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessReviewsSection({ section }) {
  if (!section.items?.length) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className="review-grid">
        {section.items.map((review) => (
          <article key={review.id} className="review-card">
            <strong>{review.author}</strong>
            <span>{'★'.repeat(review.rating || 5)}</span>
            <p>{review.quote}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

