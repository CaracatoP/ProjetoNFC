import { startTransition, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { getPublicSiteBySlug } from '@/services/publicSiteService.js';

const initialState = {
  status: 'idle',
  data: null,
  error: null,
};

export function useBusinessSite(slug) {
  const deferredSlug = useDeferredValue(slug);
  const [state, setState] = useState(initialState);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!deferredSlug) {
      return undefined;
    }

    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading', error: null }));

    getPublicSiteBySlug(deferredSlug)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'success',
            data: payload,
            error: null,
          });
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState({
          status: 'error',
          data: null,
          error,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSlug, reloadKey]);

  return {
    ...state,
    reload,
  };
}
