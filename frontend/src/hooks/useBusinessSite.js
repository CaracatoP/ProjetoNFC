import { startTransition, useCallback, useDeferredValue, useEffect, useState } from 'react';
import { getPublicSiteBySlug } from '@/services/publicSiteService.js';

const initialState = {
  status: 'idle',
  data: null,
  error: null,
  isRefreshing: false,
};

export function useBusinessSite(slug, options = {}) {
  const deferredSlug = useDeferredValue(slug);
  const [state, setState] = useState(initialState);
  const [reloadState, setReloadState] = useState({ key: 0, options: {} });

  const reload = useCallback((reloadOptions = {}) => {
    setReloadState((current) => ({
      key: current.key + 1,
      options: reloadOptions || {},
    }));
  }, []);

  useEffect(() => {
    if (!deferredSlug) {
      setState(initialState);
      return undefined;
    }

    let cancelled = false;
    const requestOptions = {
      ...options,
      ...(reloadState.options || {}),
    };

    if (requestOptions.preview) {
      requestOptions.bypassCache = true;
    }

    setState((current) =>
      current.data
        ? {
            ...current,
            error: null,
            isRefreshing: true,
          }
        : {
            ...current,
            status: 'loading',
            error: null,
            isRefreshing: true,
          },
    );

    getPublicSiteBySlug(deferredSlug, requestOptions)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setState({
            status: 'success',
            data: payload,
            error: null,
            isRefreshing: false,
          });
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setState((current) =>
          current.data
            ? {
                ...current,
                error,
                isRefreshing: false,
              }
            : {
                status: 'error',
                data: null,
                error,
                isRefreshing: false,
              },
        );
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSlug, options, reloadState]);

  return {
    ...state,
    reload,
  };
}
