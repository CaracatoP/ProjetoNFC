import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

export function BusinessCtaSection({ section, onBusinessAction, onTrackAction }) {
  const { primaryAction, secondaryAction } = section.settings || {};

  function trackCtaClick(targetType, targetLabel) {
    onTrackAction?.({
      eventType: 'cta_click',
      sectionType: 'cta',
      targetType,
      targetLabel,
    });
  }

  function handleAction(actionConfig, targetType) {
    if (!actionConfig) {
      return;
    }

    trackCtaClick(targetType, actionConfig.label);

    if (actionConfig.action) {
      onBusinessAction?.(actionConfig);
    }
  }

  return (
    <Card className="section-card cta-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className="button-row">
        {primaryAction?.href ? (
          <Button href={primaryAction.href} target="_blank" onClick={() => trackCtaClick('primary', primaryAction.label)}>
            {primaryAction.label}
          </Button>
        ) : primaryAction ? (
          <Button onClick={() => handleAction(primaryAction, 'primary')}>{primaryAction.label}</Button>
        ) : null}

        {secondaryAction?.href ? (
          <Button
            href={secondaryAction.href}
            target="_blank"
            variant="secondary"
            onClick={() => trackCtaClick('secondary', secondaryAction.label)}
          >
            {secondaryAction.label}
          </Button>
        ) : secondaryAction ? (
          <Button variant="secondary" onClick={() => handleAction(secondaryAction, 'secondary')}>
            {secondaryAction.label}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
