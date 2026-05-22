import { useEffect, useState } from 'react';

function readColors() {
  if (typeof document === 'undefined') return {};
  const s = getComputedStyle(document.documentElement);
  const rgb = (name) => `rgb(${s.getPropertyValue('--' + name).trim()})`;
  const rgba = (name, a) => `rgb(${s.getPropertyValue('--' + name).trim()} / ${a})`;
  return {
    bg: rgb('bg'),
    panel: rgb('panel'),
    panel2: rgb('panel2'),
    border: rgb('border'),
    mute: rgb('mute'),
    text: rgb('text'),
    accent: rgb('accent'),
    accent2: rgb('accent2'),
    success: rgb('success'),
    danger: rgb('danger'),
    warn: rgb('warn'),
    rgba
  };
}

export function useThemeColors() {
  const [c, setC] = useState(() => readColors());
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => setC(readColors()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return c;
}
