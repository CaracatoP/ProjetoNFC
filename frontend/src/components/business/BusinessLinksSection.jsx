import { ActionIcon } from '@/components/common/ActionIcon.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

function resolveAction(item) {
  return item.metadata?.action || item.type;
}

function resolveIcon(item, action) {
  return item.icon || item.metadata?.icon || action || item.type || 'default';
}

function shouldRenderItem(item, section) {
  if (item.visible === false) {
    return false;
  }

  const isCompactShowcase = section.settings?.layout === 'compact';
  const isSupportShortcut = item.metadata?.action === 'contact' && item.metadata?.targetSection === 'contact';

  if (isCompactShowcase && isSupportShortcut) {
    return false;
  }

  return true;
}

export function BusinessLinksSection({ section, onBusinessAction, onTrackAction }) {
  const visibleItems = (section.items || []).filter((item) => shouldRenderItem(item, section));

  if (!visibleItems.length) {
    return null;
  }

  const gridClassName = ['action-grid', section.settings?.layout === 'compact' ? 'action-grid--showcase' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className={gridClassName}>
        {visibleItems.map((item) => {
          const action = resolveAction(item);
          const iconName = resolveIcon(item, action);
          const isInternalAction = !item.url && Boolean(action);
          const tileClassName = [
            'action-tile',
            section.settings?.layout === 'compact' ? 'action-tile--showcase' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const tileContent = (
            <>
              <div className="action-tile__header">
                <ActionIcon name={iconName} />
              </div>
              <div className="action-tile__body">
                <strong>{item.label}</strong>
                {item.subtitle ? <span>{item.subtitle}</span> : null}
              </div>
            </>
          );

          if (isInternalAction) {
            return (
              <button
                key={item.id}
                type="button"
                className={tileClassName}
                onClick={() => {
                  onTrackAction?.({
                    eventType: 'link_click',
                    sectionType: section.type,
                    targetType: action,
                    targetId: item.id,
                    targetLabel: item.label,
                  });
                  onBusinessAction?.({
                    action,
                    item,
                    sectionKey: section.key,
                    targetSection: item.metadata?.targetSection,
                  });
                }}
              >
                {tileContent}
              </button>
            );
          }

          return (
            <a
              key={item.id}
              className={tileClassName}
              href={item.url}
              target={item.target || '_blank'}
              rel="noreferrer"
              onClick={() =>
                onTrackAction?.({
                  eventType: 'link_click',
                  sectionType: section.type,
                  targetType: item.type,
                  targetId: item.id,
                  targetLabel: item.label,
                })
              }
            >
              {tileContent}
            </a>
          );
        })}
      </div>
    </Card>
  );
}
