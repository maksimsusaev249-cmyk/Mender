import React, { useState, useEffect } from 'react';
import { TypingStatus } from '../../types';

interface TypingIndicatorTextProps {
  typingUsers: TypingStatus[];
  isDirect?: boolean;
  showPrefix?: boolean;
  className?: string;
}

const DOT_SEQUENCE = ['...', '..', '.'] as const;

export const TypingIndicatorText: React.FC<TypingIndicatorTextProps> = ({
  typingUsers,
  isDirect = true,
  showPrefix = true,
  className = '',
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typingUsers.length === 0) {
      setStep(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStep(prev => (prev + 1) % DOT_SEQUENCE.length);
    }, 420);
    return () => window.clearInterval(timer);
  }, [typingUsers.length]);

  if (typingUsers.length === 0) return null;

  const dots = DOT_SEQUENCE[step];

  let label = 'печатает';
  if (typingUsers.length === 1) {
    const firstName = typingUsers[0].displayName?.split(' ')[0] || typingUsers[0].displayName;
    label = !isDirect && showPrefix && firstName ? `${firstName} печатает` : 'печатает';
  } else if (typingUsers.length === 2) {
    const n1 = typingUsers[0].displayName?.split(' ')[0] || 'Пользователь';
    const n2 = typingUsers[1].displayName?.split(' ')[0] || 'Пользователь';
    label = showPrefix ? `${n1}, ${n2} печатают` : 'печатают';
  } else {
    label = showPrefix ? `${typingUsers.length} чел. печатают` : 'печатают';
  }

  return (
    <span className={`inline-flex items-baseline whitespace-nowrap ${className}`}>
      <span className="truncate">{label}</span>
      <span className="inline-block w-[1.15em] text-left shrink-0" aria-hidden="true">
        {dots}
      </span>
    </span>
  );
};
