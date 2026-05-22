import { useEffect, useState } from 'react';

// Estado collapsed/expanded persistido em JsonStore por app+seção.
// Chave salva: `collapsed.<appId>.<key>` (boolean).
// `defaultCollapsed` é o estado quando ainda não tem nada salvo.
export function useCollapsed(appId, key, defaultCollapsed = false) {
  const storeKey = `collapsed.${appId}.${key}`;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    window.api.config.get(storeKey).then((v) => {
      if (!alive) return;
      if (typeof v === 'boolean') setCollapsed(v);
      else setCollapsed(defaultCollapsed);
      setLoaded(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.api.config.set(storeKey, next);
  };

  return [collapsed, toggle, loaded];
}
