const iconPaths = {
  whatsapp: (
    <>
      <path d="M12 20a8 8 0 1 0-4.11-1.14L4 20l1.28-3.63A8 8 0 0 0 12 20Z" />
      <path d="M9.6 8.9c.16-.36.33-.37.49-.38h.42c.12 0 .31.05.48.42.17.38.57 1.4.62 1.5.05.1.08.23.02.38-.07.15-.1.25-.2.38-.11.13-.22.29-.32.39-.1.1-.2.22-.08.43.12.2.54.9 1.16 1.46.8.71 1.47.92 1.68 1.02.2.1.33.08.45-.05.12-.13.52-.6.66-.8.13-.2.27-.17.45-.1.18.08 1.17.55 1.37.65.2.1.33.15.38.23.05.08.05.48-.11.95-.16.48-.93.92-1.3.98-.34.05-.76.08-2.46-.61-2.06-.84-3.37-2.92-3.47-3.06-.1-.13-.83-1.1-.83-2.11 0-1 .53-1.49.72-1.69Z" />
    </>
  ),
  phone: (
    <path d="M7.1 4.9c.4-.4 1.02-.52 1.55-.28l1.58.72c.57.26.89.88.78 1.49l-.26 1.47a1.5 1.5 0 0 0 .42 1.3l3.23 3.23c.35.35.85.5 1.34.42l1.44-.26c.61-.1 1.22.21 1.49.78l.72 1.58c.24.53.12 1.15-.28 1.55l-.88.88c-.84.84-2.08 1.16-3.22.82-2.28-.68-4.43-2.15-6.43-4.15-2-2-3.47-4.15-4.15-6.43-.34-1.14-.02-2.38.82-3.22l.88-.88Z" />
  ),
  map: (
    <>
      <path d="M12 20s5.5-5.28 5.5-9.2A5.5 5.5 0 1 0 6.5 10.8C6.5 14.72 12 20 12 20Z" />
      <circle cx="12" cy="10.5" r="1.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </>
  ),
  wifi: (
    <>
      <path d="M4.5 9.5a11.5 11.5 0 0 1 15 0" />
      <path d="M7.5 12.5a7.2 7.2 0 0 1 9 0" />
      <path d="M10.2 15.3a3.2 3.2 0 0 1 3.6 0" />
      <circle cx="12" cy="18.1" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  pix: (
    <>
      <path
        fill="currentColor"
        stroke="none"
        d="M12 2.6a2 2 0 0 1 1.41.58l4.15 4.15H14.8c-.6 0-1.18.24-1.6.67L12 9.2 10.8 8a2.25 2.25 0 0 0-1.6-.67H6.44l4.15-4.15A2 2 0 0 1 12 2.6Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M21.4 12a2 2 0 0 1-.58 1.41l-4.15 4.15V14.8c0-.6-.24-1.18-.67-1.6L14.8 12l1.2-1.2c.43-.42.67-1 .67-1.6V6.44l4.15 4.15A2 2 0 0 1 21.4 12Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M12 21.4a2 2 0 0 1-1.41-.58l-4.15-4.15H9.2c.6 0 1.18-.24 1.6-.67L12 14.8l1.2 1.2c.42.43 1 .67 1.6.67h2.76l-4.15 4.15A2 2 0 0 1 12 21.4Z"
      />
      <path
        fill="currentColor"
        stroke="none"
        d="M2.6 12a2 2 0 0 1 .58-1.41l4.15-4.15V9.2c0 .6.24 1.18.67 1.6L9.2 12 8 13.2c-.43.42-.67 1-.67 1.6v2.76l-4.15-4.15A2 2 0 0 1 2.6 12Z"
      />
    </>
  ),
  instagram: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="4" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.3" cy="7.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  mail: (
    <>
      <path d="M4.5 7.5A1.5 1.5 0 0 1 6 6h12a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 18H6a1.5 1.5 0 0 1-1.5-1.5v-9Z" />
      <path d="m5.5 8 6.5 5L18.5 8" />
    </>
  ),
  default: (
    <>
      <path d="M8 8h8v8H8z" />
      <path d="M10 6h4" />
      <path d="M18 10v4" />
    </>
  ),
};

const iconAliases = {
  email: 'mail',
  'e-mail': 'mail',
  telefone: 'phone',
  telephone: 'phone',
  location: 'map',
  address: 'map',
  localizacao: 'map',
  maps: 'map',
};

const brandIconNames = new Set(['whatsapp', 'instagram', 'pix']);

function isImageIcon(value) {
  return /^(https?:\/\/|data:image\/|\/)/i.test(String(value || '').trim());
}

function normalizeIconName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  const aliased = iconAliases[normalized] || normalized;

  return iconPaths[aliased] ? aliased : 'default';
}

export function ActionIcon({ name, className = '' }) {
  if (isImageIcon(name)) {
    return (
      <span className={['action-icon', 'action-icon--image', className].filter(Boolean).join(' ')}>
        <img src={name} alt="" aria-hidden="true" />
      </span>
    );
  }

  const iconName = normalizeIconName(name);
  const iconKind = brandIconNames.has(iconName) ? 'brand' : 'generic';

  return (
    <span
      className={['action-icon', `action-icon--${iconKind}`, `action-icon--${iconName}`, className]
        .filter(Boolean)
        .join(' ')}
      data-icon-kind={iconKind}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {iconPaths[iconName]}
      </svg>
    </span>
  );
}
