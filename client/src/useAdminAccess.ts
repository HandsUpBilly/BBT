import { useEffect, useState } from 'react';
import { fetchAdminStatus } from './editor/editorApi';

/** Keeps admin navigation hidden until the server confirms this identity. */
export function useAdminAccess(idToken: string | null): boolean {
  const [confirmed, setConfirmed] = useState<{ idToken: string | null; allowed: boolean }>({
    idToken: null,
    allowed: false,
  });

  useEffect(() => {
    let cancelled = false;

    void fetchAdminStatus(idToken).then(allowed => {
      if (!cancelled) setConfirmed({ idToken, allowed });
    });

    return () => { cancelled = true; };
  }, [idToken]);

  // A token change invalidates the previous answer synchronously, without a
  // setState call inside the effect and without briefly leaking stale access.
  return confirmed.idToken === idToken && confirmed.allowed;
}
