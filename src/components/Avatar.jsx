import React, { useState } from 'react';

const COLORS = [
  ['#5b8def', '#7c5cff'],
  ['#3fd17a', '#5b8def'],
  ['#ffb547', '#ff5d6c'],
  ['#7c5cff', '#ff5d6c'],
  ['#3fd17a', '#ffb547'],
  ['#ff5d6c', '#5b8def']
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({ name, url, size = 32 }) {
  const [failed, setFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const [c1, c2] = COLORS[hash(name || '?') % COLORS.length];

  if (url && !failed) {
    return (
      <img
        src={url}
        onError={() => setFailed(true)}
        alt=""
        className="rounded-full border border-border shrink-0 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        fontSize: size * 0.4
      }}
    >
      {initial}
    </div>
  );
}
