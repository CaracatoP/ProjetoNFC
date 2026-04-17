export function Card({ as: Component = 'section', className = '', children, ...props }) {
  return (
    <Component className={['card', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </Component>
  );
}

