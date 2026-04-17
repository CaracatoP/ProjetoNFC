import { useState } from 'react';

export function useClipboard() {
  const [lastCopied, setLastCopied] = useState('');

  async function copy(value) {
    if (!value) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      setLastCopied(value);
      return true;
    } catch (error) {
      console.warn('Falha ao copiar texto:', error);
      return false;
    }
  }

  return {
    lastCopied,
    copy,
  };
}

