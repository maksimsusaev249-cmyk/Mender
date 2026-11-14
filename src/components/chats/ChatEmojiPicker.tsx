import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ChatEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    id: 'popular',
    label: 'Частые',
    emojis: [
      '😀', '😂', '🥰', '😍', '😎', '🤔', '😅', '😭',
      '👍', '👎', '❤️', '🔥', '🎉', '👏', '🙏', '✨',
      '👌', '🤝', '💪', '🤩', '🥳', '😴', '🤯', '💯',
    ],
  },
  {
    id: 'faces',
    label: 'Эмоции',
    emojis: [
      '😊', '😇', '🙂', '😉', '😌', '😋', '😜', '🤪',
      '🤨', '🧐', '🤓', '😏', '😒', '😞', '😔', '😟',
      '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😤',
      '😠', '😡', '🤬', '😳', '🥵', '🥶', '😱', '🤗',
    ],
  },
  {
    id: 'gestures',
    label: 'Жесты',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️',
      '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇',
      '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '👀',
    ],
  },
  {
    id: 'objects',
    label: 'Символы',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘',
      '⭐', '🌟', '⚡', '🔥', '💥', '❄️', '🌈', '☕',
      '🎵', '🎧', '🎬', '📸', '🚀', '💎', '✅', '⚡',
    ],
  },
];

export const ChatEmojiPicker: React.FC<ChatEmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);

  const currentList =
    EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.emojis || EMOJI_CATEGORIES[0].emojis;

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="w-[296px] sm:w-[320px] bg-white border border-[#E1E3E6] rounded-2xl shadow-xl overflow-hidden text-[#19191A]"
    >
      <div className="px-3 py-2 border-b border-[#E1E3E6] bg-[#F7F8FA] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map(cat => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0077FF] text-white'
                    : 'text-[#626D7A] hover:bg-[#EDEFEF] hover:text-[#19191A]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[#818C99] hover:text-[#19191A] hover:bg-[#EDEFEF] cursor-pointer shrink-0"
          title="Закрыть панель эмодзи"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2.5 grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
        {currentList.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            type="button"
            onClick={() => onSelect(emoji)}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-lg hover:bg-[#F2F3F5] active:scale-90 transition-transform cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
