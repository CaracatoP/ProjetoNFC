import { useEffect } from 'react';
import { buildTenantTheme, buildThemeCssVariables } from '@shared/utils/theme.js';

export function useTenantTheme(theme) {
  useEffect(() => {
    if (!theme) {
      return undefined;
    }

    const resolvedTheme = buildTenantTheme(theme);
    const root = document.documentElement;
    const entries = Object.entries(buildThemeCssVariables(resolvedTheme));
    const previousValues = new Map(
      entries.map(([name]) => [name, root.style.getPropertyValue(name)]),
    );

    entries.forEach(([name, value]) => root.style.setProperty(name, value));

    let styleTag = null;

    if (resolvedTheme.customCss) {
      styleTag = document.createElement('style');
      styleTag.setAttribute('data-tenant-theme', 'true');
      styleTag.textContent = resolvedTheme.customCss;
      document.head.appendChild(styleTag);
    }

    return () => {
      entries.forEach(([name]) => {
        const previousValue = previousValues.get(name) || '';

        if (previousValue) {
          root.style.setProperty(name, previousValue);
          return;
        }

        root.style.removeProperty(name);
      });

      if (styleTag) {
        styleTag.remove();
      }
    };
  }, [theme]);
}
