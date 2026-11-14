import React, { useState, useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  isSystemSecurity?: boolean;
  onClick?: () => void;
}

const AVATAR_PALETTES = [
  'bg-[#0077FF] text-white',
  'bg-[#5B6EF5] text-white',
  'bg-[#0EA5E9] text-white',
  'bg-[#10B981] text-white',
  'bg-[#F59E0B] text-white',
  'bg-[#EC4899] text-white',
  'bg-[#8B5CF6] text-white',
];

function getInitials(name?: string): string {
  const clean = (name || '').trim();
  if (!clean) return 'M';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function getColorClass(name?: string): string {
  const str = (name || 'Mender').trim();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'Пользователь',
  className = 'w-10 h-10 rounded-full',
  isSystemSecurity = false,
  onClick,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  if (isSystemSecurity) {
    return (
      <div
        onClick={onClick}
        className={`${className} bg-[#0077FF] text-white flex items-center justify-center shrink-0 select-none`}
        aria-label={name}
      >
        <ShieldCheck className="w-1/2 h-1/2" />
      </div>
    );
  }

  const trimmedSrc = (src || '').trim();
  const shouldShowFallback = !trimmedSrc || imgFailed;

  if (shouldShowFallback) {
    return (
      <div
        onClick={onClick}
        className={`${className} ${getColorClass(
          name
        )} font-bold flex items-center justify-center shrink-0 select-none text-xs`}
        aria-label={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={trimmedSrc}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      onClick={onClick}
      className={`${className} object-cover shrink-0 bg-[#EDEFEF]`}
    />
  );
};
