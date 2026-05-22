// Estilo (cor + ícone) para cada plano da Discloud.
// Fonte: https://discloud.com/plans (Free, Gold, Platinum, Diamond, Ruby, Sapphire, Krypton, Vibranium)
export const PLAN_STYLES = {
  free:      { color: '#94a3b8', label: 'Free' },
  gold:      { color: '#f59e0b', label: 'Gold' },
  platinum:  { color: '#cbd5e1', label: 'Platinum' },
  diamond:   { color: '#38bdf8', label: 'Diamond' },
  ruby:      { color: '#ef4444', label: 'Ruby' },
  sapphire:  { color: '#3b82f6', label: 'Sapphire' },
  krypton:   { color: '#22c55e', label: 'Krypton' },
  vibranium: { color: '#a855f7', label: 'Vibranium' }
};

export function planStyle(planName) {
  if (!planName) return null;
  const key = String(planName).toLowerCase().trim();
  return PLAN_STYLES[key] || { color: '#94a3b8', label: planName };
}

// Constrói URL do avatar Discord do user retornado por /user.
// Aceita várias formas que a API pode usar.
export function userAvatarURL(user) {
  if (!user) return null;
  const u = user.user || user;
  if (u.avatarURL) return u.avatarURL;
  if (u.avatar_url) return u.avatar_url;
  // hash Discord + id → CDN
  if (u.avatar && u.id) {
    const ext = String(u.avatar).startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${ext}?size=64`;
  }
  if (typeof u.avatar === 'string' && /^https?:/.test(u.avatar)) return u.avatar;
  return null;
}

export function userName(user) {
  if (!user) return '';
  const u = user.user || user;
  return u.global_name || u.username || u.name || u.tag || '';
}

export function userPlan(user) {
  if (!user) return null;
  const u = user.user || user;
  return u.plan || user.plan || null;
}
