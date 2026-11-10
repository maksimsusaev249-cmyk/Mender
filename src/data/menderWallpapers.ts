import { BuiltinWallpaper, WallpaperCategory } from '../types';

function encodeSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const WALLPAPER_CATEGORIES: { id: 'all' | WallpaperCategory | 'custom'; label: string }[] = [
  { id: 'all', label: 'Все стили' },
  { id: 'space', label: 'Космос' },
  { id: 'neon', label: 'Неон' },
  { id: 'abstract', label: 'Абстракция' },
  { id: 'liquid_glass', label: 'Жидкое стекло' },
  { id: 'nature', label: 'Природа' },
  { id: 'minimal', label: 'Минимализм' },
  { id: 'geometry', label: 'Геометрия' },
  { id: 'gradients', label: 'Градиенты' },
  { id: 'pastel', label: 'Пастель' },
  { id: 'dark', label: 'Тёмные' },
  { id: 'custom', label: 'Мои обои' },
];

export const SOLID_WALLPAPER_COLORS = [
  { id: 'color_slate_950', name: 'Глубокий Обсидиан', hex: '#020617' },
  { id: 'color_indigo_950', name: 'Полночный Индиго', hex: '#1e1b4b' },
  { id: 'color_violet_950', name: 'Темный Аметист', hex: '#2e1065' },
  { id: 'color_sky_950', name: 'Океанический Синий', hex: '#082f49' },
  { id: 'color_emerald_950', name: 'Северный Изумруд', hex: '#022c22' },
  { id: 'color_rose_950', name: 'Винный Бархат', hex: '#4c0519' },
  { id: 'color_neutral_900', name: 'Графитовый Монолит', hex: '#171717' },
  { id: 'color_indigo_900', name: 'Королевский Сапфир', hex: '#312e81' },
];

export const MENDER_WALLPAPERS: BuiltinWallpaper[] = [
  // 0. DEFAULT FEATURED: Фиолетовые горы и ночное озеро (как на главном скриншоте чата Mender)
  {
    id: 'mw_cosmic_mountains',
    name: 'Космические Горы и Озеро',
    subtitle: 'Фиолетовый закат, звёздное небо и ночное отражение Mender',
    category: 'space',
    accentColor: '#9333ea',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="csky" x1="0%" y1="0%" x2="0%" y2="75%">
            <stop offset="0%" stop-color="#060417"/>
            <stop offset="38%" stop-color="#1D1147"/>
            <stop offset="72%" stop-color="#5B21B6"/>
            <stop offset="100%" stop-color="#A855F7"/>
          </linearGradient>
          <radialGradient id="cneb1" cx="50%" cy="32%" r="50%">
            <stop offset="0%" stop-color="#D8B4FE" stop-opacity="0.5"/>
            <stop offset="45%" stop-color="#7C3AED" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#060417" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="cneb2" cx="22%" cy="20%" r="40%">
            <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.4"/>
            <stop offset="60%" stop-color="#4F46E5" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#060417" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="clake" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#6B21A8"/>
            <stop offset="45%" stop-color="#2E1065"/>
            <stop offset="100%" stop-color="#070414"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#csky)"/>
        <rect width="1200" height="900" fill="url(#cneb1)"/>
        <rect width="1200" height="900" fill="url(#cneb2)"/>
        <g fill="#FFFFFF" opacity="0.88">
          <circle cx="140" cy="90" r="1.8"/><circle cx="260" cy="150" r="1.2"/><circle cx="390" cy="70" r="2.2"/>
          <circle cx="540" cy="110" r="1.5"/><circle cx="690" cy="60" r="2"/><circle cx="840" cy="130" r="1.4"/>
          <circle cx="990" cy="80" r="2.4"/><circle cx="1110" cy="160" r="1.5"/><circle cx="180" cy="240" r="1.3"/>
          <circle cx="620" cy="210" r="2.1"/><circle cx="770" cy="195" r="1.2"/><circle cx="920" cy="230" r="1.7"/>
          <circle cx="460" cy="165" r="1.4"/><circle cx="1050" cy="245" r="1.9"/><circle cx="85" cy="190" r="1.5"/>
        </g>
        <polygon points="0,640 140,480 270,560 430,390 590,530 740,410 910,545 1060,440 1200,560 1200,665 0,665" fill="#4C1D95" opacity="0.78"/>
        <polygon points="0,665 90,540 230,610 350,470 520,600 660,485 830,605 980,490 1120,590 1200,535 1200,670 0,670" fill="#2E1065"/>
        <polygon points="0,675 0,480 35,535 65,495 100,565 135,520 175,610 220,675" fill="#0F0728"/>
        <polygon points="960,675 1015,575 1055,615 1095,515 1135,575 1170,490 1200,530 1200,675" fill="#0F0728"/>
        <rect x="0" y="665" width="1200" height="235" fill="url(#clake)"/>
        <g fill="#F3E8FF" opacity="0.4">
          <rect x="420" y="685" width="360" height="2.5" rx="1"/>
          <rect x="460" y="706" width="280" height="2" rx="1"/>
          <rect x="380" y="730" width="440" height="2" rx="1"/>
          <rect x="490" y="756" width="220" height="2" rx="1"/>
          <rect x="520" y="786" width="160" height="1.5" rx="0.75"/>
        </g>
      </svg>
    `),
  },
  // 1. Закат над океаном (карточка 2 в Фоны чатов)
  {
    id: 'mw_sunset_ocean_glow',
    name: 'Закат над Океаном',
    subtitle: 'Солнечная дорожка на воде и пурпурные облака',
    category: 'nature',
    accentColor: '#f97316',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="ssky" x1="0%" y1="0%" x2="0%" y2="62%">
            <stop offset="0%" stop-color="#1E1B4B"/>
            <stop offset="40%" stop-color="#701A75"/>
            <stop offset="75%" stop-color="#EA580C"/>
            <stop offset="100%" stop-color="#FACC15"/>
          </linearGradient>
          <linearGradient id="ssea" x1="0%" y1="60%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#F97316"/>
            <stop offset="35%" stop-color="#701A75"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="560" fill="url(#ssky)"/>
        <circle cx="600" cy="510" r="95" fill="#FEF08A" opacity="0.9"/>
        <rect y="555" width="1200" height="345" fill="url(#ssea)"/>
        <g fill="#FEF08A" opacity="0.58">
          <rect x="490" y="575" width="220" height="4" rx="2"/>
          <rect x="510" y="595" width="180" height="4" rx="2"/>
          <rect x="470" y="620" width="260" height="3" rx="1.5"/>
          <rect x="530" y="650" width="140" height="3" rx="1.5"/>
          <rect x="550" y="685" width="100" height="3" rx="1.5"/>
        </g>
      </svg>
    `),
  },
  // 2. Цветущая сакура (карточка 3 в Фоны чатов)
  {
    id: 'mw_sakura_blossom',
    name: 'Цветущая Сакура',
    subtitle: 'Нежные розовые лепестки на вечернем небе',
    category: 'pastel',
    accentColor: '#f472b6',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="sakbg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E1B4B"/>
            <stop offset="50%" stop-color="#4A1D56"/>
            <stop offset="100%" stop-color="#831843"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#sakbg)"/>
        <path d="M1200 80 Q850 180 620 420 M950 140 Q820 310 730 510 M1050 90 Q1000 280 910 380" stroke="#3B122C" stroke-width="14" fill="none" stroke-linecap="round"/>
        <g fill="#F472B6" opacity="0.85">
          <circle cx="960" cy="140" r="36"/><circle cx="880" cy="210" r="44"/><circle cx="780" cy="280" r="38"/>
          <circle cx="680" cy="370" r="42"/><circle cx="830" cy="360" r="34"/><circle cx="930" cy="310" r="40"/>
          <circle cx="740" cy="480" r="35"/><circle cx="620" cy="420" r="32"/><circle cx="1050" cy="200" r="45"/>
        </g>
        <g fill="#FBCFE8" opacity="0.9">
          <circle cx="940" cy="130" r="22"/><circle cx="865" cy="200" r="26"/><circle cx="770" cy="270" r="22"/>
          <circle cx="670" cy="360" r="25"/><circle cx="820" cy="350" r="20"/><circle cx="920" cy="300" r="24"/>
          <circle cx="420" cy="540" r="10"/><circle cx="310" cy="650" r="8"/><circle cx="510" cy="690" r="11"/>
        </g>
      </svg>
    `),
  },
  // 3. Тёмные неоновые волны (карточка 4 в Фоны чатов)
  {
    id: 'mw_dark_purple_waves',
    name: 'Неоновый Шёлк',
    subtitle: 'Тёмные абстрактные фиолетовые волны',
    category: 'neon',
    accentColor: '#a855f7',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <rect width="1200" height="900" fill="#050411"/>
        <path d="M-100,750 C250,420 550,680 1300,220" stroke="#7C3AED" stroke-width="45" stroke-opacity="0.28" fill="none"/>
        <path d="M-100,680 C300,350 620,640 1300,160" stroke="#C084FC" stroke-width="14" stroke-opacity="0.55" fill="none"/>
        <path d="M-100,820 C340,560 720,760 1300,380" stroke="#4F46E5" stroke-width="28" stroke-opacity="0.35" fill="none"/>
      </svg>
    `),
  },
  // 4. Ледяные горные вершины (карточка 5 в Фоны чатов)
  {
    id: 'mw_icy_peaks',
    name: 'Ледяные Вершины',
    subtitle: 'Голубые горные пики и чистый воздух',
    category: 'nature',
    accentColor: '#38bdf8',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="icesky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0C4A6E"/>
            <stop offset="55%" stop-color="#0284C7"/>
            <stop offset="100%" stop-color="#082F49"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#icesky)"/>
        <polygon points="0,650 220,340 430,580 670,280 920,560 1100,360 1200,520 1200,900 0,900" fill="#0369A1"/>
        <polygon points="220,340 310,450 180,490" fill="#E0F2FE" opacity="0.85"/>
        <polygon points="670,280 780,430 610,460" fill="#E0F2FE" opacity="0.9"/>
        <polygon points="0,700 180,480 410,660 620,450 870,670 1200,470 1200,900 0,900" fill="#082F49"/>
      </svg>
    `),
  },
  // 5. Космос и фиолетовые облака (карточка 6 в Фоны чатов и карточка ИИ)
  {
    id: 'mw_crescent_purple_clouds',
    name: 'Космос и Фиолетовые Облака',
    subtitle: 'Полумесяц в звёздном небе над сияющими облаками',
    category: 'space',
    accentColor: '#8b5cf6',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="cpsky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#060417"/>
            <stop offset="50%" stop-color="#1E104C"/>
            <stop offset="100%" stop-color="#5B21B6"/>
          </linearGradient>
          <radialGradient id="cpglow" cx="52%" cy="34%" r="42%">
            <stop offset="0%" stop-color="#DDD6FE" stop-opacity="0.5"/>
            <stop offset="45%" stop-color="#8B5CF6" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#060417" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#cpsky)"/>
        <rect width="1200" height="900" fill="url(#cpglow)"/>
        <path d="M630 200 A85 85 0 1 0 695 335 A68 68 0 1 1 630 200 Z" fill="#F5F3FF"/>
        <g fill="#FFFFFF" opacity="0.85">
          <circle cx="210" cy="140" r="2"/><circle cx="370" cy="100" r="1.5"/><circle cx="840" cy="130" r="2.2"/>
          <circle cx="980" cy="210" r="1.6"/><circle cx="150" cy="290" r="1.4"/><circle cx="490" cy="180" r="1.2"/>
        </g>
        <g fill="#7C3AED" opacity="0.48">
          <circle cx="180" cy="680" r="190"/><circle cx="420" cy="710" r="210"/>
          <circle cx="760" cy="700" r="220"/><circle cx="1040" cy="670" r="190"/>
        </g>
        <g fill="#A855F7" opacity="0.42">
          <circle cx="290" cy="760" r="170"/><circle cx="600" cy="740" r="200"/><circle cx="910" cy="750" r="180"/>
        </g>
        <g fill="#3B0764" opacity="0.88">
          <circle cx="120" cy="850" r="180"/><circle cx="390" cy="860" r="210"/>
          <circle cx="690" cy="850" r="220"/><circle cx="1020" cy="840" r="200"/>
        </g>
      </svg>
    `),
  },

  // 6. SPACE (Космос — Туманность Андромеды)
  {
    id: 'mw_space_nebula',
    name: 'Туманность Андромеды',
    subtitle: 'Глубокий космос и звёздная пыль Mender',
    category: 'space',
    accentColor: '#6366f1',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <radialGradient id="bg" cx="50%" cy="40%" r="80%">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="45%" stop-color="#0f0a2c"/>
            <stop offset="100%" stop-color="#03030b"/>
          </radialGradient>
          <radialGradient id="neb1" cx="30%" cy="35%" r="45%">
            <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.45"/>
            <stop offset="60%" stop-color="#4f46e5" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="neb2" cx="75%" cy="65%" r="50%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
            <stop offset="50%" stop-color="#6366f1" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#bg)"/>
        <circle cx="380" cy="320" r="480" fill="url(#neb1)"/>
        <circle cx="880" cy="580" r="520" fill="url(#neb2)"/>
        <g fill="#ffffff" opacity="0.75">
          <circle cx="150" cy="120" r="1.5"/><circle cx="280" cy="90" r="1"/><circle cx="420" cy="210" r="2"/>
          <circle cx="640" cy="140" r="1.2"/><circle cx="890" cy="180" r="1.8"/><circle cx="1050" cy="110" r="1"/>
          <circle cx="190" cy="440" r="1.2"/><circle cx="520" cy="490" r="2.2"/><circle cx="760" cy="390" r="1.4"/>
          <circle cx="980" cy="460" r="1.6"/><circle cx="310" cy="720" r="1.8"/><circle cx="670" cy="760" r="1.2"/>
          <circle cx="1080" cy="740" r="2"/><circle cx="110" cy="810" r="1.4"/><circle cx="840" cy="820" r="1.1"/>
        </g>
        <ellipse cx="600" cy="450" rx="420" ry="110" fill="none" stroke="#818cf8" stroke-opacity="0.18" stroke-width="1.5" transform="rotate(-24 600 450)"/>
        <circle cx="600" cy="450" r="54" fill="#09071a" stroke="#a5b4fc" stroke-opacity="0.4" stroke-width="2"/>
      </svg>
    `),
  },
  {
    id: 'mw_space_orbit',
    name: 'Квантовая Орбита',
    subtitle: 'Планетарное затмение и кольца света',
    category: 'space',
    accentColor: '#38bdf8',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="sp2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#020617"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
          <radialGradient id="halo" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stop-color="#020617" stop-opacity="1"/>
            <stop offset="76%" stop-color="#38bdf8" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#sp2)"/>
        <circle cx="600" cy="450" r="320" fill="url(#halo)"/>
        <circle cx="600" cy="450" r="210" fill="#030712"/>
        <ellipse cx="600" cy="450" rx="460" ry="95" fill="none" stroke="#38bdf8" stroke-opacity="0.3" stroke-width="2" transform="rotate(18 600 450)"/>
        <ellipse cx="600" cy="450" rx="390" ry="70" fill="none" stroke="#818cf8" stroke-opacity="0.22" stroke-width="1" transform="rotate(18 600 450)"/>
      </svg>
    `),
  },

  // 2. NEON (Неон)
  {
    id: 'mw_neon_pulse',
    name: 'Неоновый Импульс',
    subtitle: 'Светящиеся кибер-дуги индиго и пурпура',
    category: 'neon',
    accentColor: '#d946ef',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="nbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#090418"/>
            <stop offset="100%" stop-color="#030712"/>
          </linearGradient>
          <linearGradient id="nline1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ec4899" stop-opacity="0"/>
            <stop offset="50%" stop-color="#d946ef" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="nline2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0"/>
            <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#nbg)"/>
        <path d="M-100 280 C 320 80, 780 540, 1300 220" fill="none" stroke="url(#nline1)" stroke-width="6"/>
        <path d="M-100 580 C 420 780, 820 260, 1300 620" fill="none" stroke="url(#nline2)" stroke-width="6"/>
        <path d="M-100 430 C 350 310, 850 610, 1300 410" fill="none" stroke="url(#nline1)" stroke-width="2" opacity="0.6"/>
        <circle cx="320" cy="240" r="180" fill="#d946ef" opacity="0.1"/>
        <circle cx="880" cy="640" r="220" fill="#06b6d4" opacity="0.1"/>
      </svg>
    `),
  },
  {
    id: 'mw_neon_grid',
    name: 'Синтвейв Горизонт',
    subtitle: 'Перспективная неоновая сетка будущего',
    category: 'neon',
    accentColor: '#22d3ee',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="sbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#090314"/>
            <stop offset="55%" stop-color="#2e1065"/>
            <stop offset="100%" stop-color="#090418"/>
          </linearGradient>
          <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f43f5e"/>
            <stop offset="50%" stop-color="#d946ef"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#sbg)"/>
        <circle cx="600" cy="460" r="170" fill="url(#sun)" opacity="0.55"/>
        <rect x="0" y="495" width="1200" height="405" fill="#080316"/>
        <g stroke="#a855f7" stroke-opacity="0.28" stroke-width="1.5">
          <line x1="0" y1="500" x2="1200" y2="500"/>
          <line x1="0" y1="540" x2="1200" y2="540"/>
          <line x1="0" y1="595" x2="1200" y2="595"/>
          <line x1="0" y1="670" x2="1200" y2="670"/>
          <line x1="0" y1="770" x2="1200" y2="770"/>
          <line x1="600" y1="500" x2="-200" y2="900"/>
          <line x1="600" y1="500" x2="150" y2="900"/>
          <line x1="600" y1="500" x2="450" y2="900"/>
          <line x1="600" y1="500" x2="750" y2="900"/>
          <line x1="600" y1="500" x2="1050" y2="900"/>
          <line x1="600" y1="500" x2="1400" y2="900"/>
        </g>
      </svg>
    `),
  },

  // 3. ABSTRACT (Абстракция)
  {
    id: 'mw_abstract_silk',
    name: 'Шелковые Волны',
    subtitle: 'Многослойные плавные ленты индиго и фиолета',
    category: 'abstract',
    accentColor: '#818cf8',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="50%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
          <linearGradient id="w1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#9333ea" stop-opacity="0.1"/>
          </linearGradient>
          <linearGradient id="w2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.08"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#abg)"/>
        <path d="M0 240 Q 320 60, 640 280 T 1200 200 L 1200 900 L 0 900 Z" fill="url(#w1)"/>
        <path d="M0 460 Q 400 280, 760 520 T 1200 420 L 1200 900 L 0 900 Z" fill="url(#w2)"/>
        <path d="M0 650 Q 300 540, 720 710 T 1200 620 L 1200 900 L 0 900 Z" fill="#090d1f" opacity="0.65"/>
      </svg>
    `),
  },

  // 4. LIQUID GLASS (Жидкое стекло)
  {
    id: 'mw_liquid_crystal',
    name: 'Кристальная Рефракция',
    subtitle: 'Полупрозрачные стеклянные сферы и блики',
    category: 'liquid_glass',
    accentColor: '#a78bfa',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="lgbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0b1120"/>
            <stop offset="50%" stop-color="#1e1b4b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="glass1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24"/>
            <stop offset="50%" stop-color="#818cf8" stop-opacity="0.08"/>
            <stop offset="100%" stop-color="#c084fc" stop-opacity="0.22"/>
          </linearGradient>
          <linearGradient id="glass2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#ffffff" stop-opacity="0.04"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#lgbg)"/>
        <circle cx="340" cy="290" r="210" fill="url(#glass1)" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
        <circle cx="830" cy="540" r="260" fill="url(#glass2)" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
        <rect x="260" y="210" width="680" height="460" rx="64" fill="url(#glass1)" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1.5" transform="rotate(-8 600 440)"/>
      </svg>
    `),
  },

  // 5. NATURE (Природа)
  {
    id: 'mw_nature_aurora',
    name: 'Северное Сияние Фьорда',
    subtitle: 'Ночные горные хребты и изумрудно-фиолетовая аврора',
    category: 'nature',
    accentColor: '#34d399',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#020617"/>
            <stop offset="55%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e1b4b"/>
          </linearGradient>
          <linearGradient id="aur" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.05"/>
            <stop offset="35%" stop-color="#34d399" stop-opacity="0.38"/>
            <stop offset="70%" stop-color="#8b5cf6" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#6366f1" stop-opacity="0.05"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#sky)"/>
        <path d="M0 190 Q 300 40, 620 210 T 1200 150 L 1200 390 Q 880 280, 560 400 T 0 340 Z" fill="url(#aur)"/>
        <polygon points="0,900 0,620 240,440 510,650 820,410 1200,660 1200,900" fill="#0b1329"/>
        <polygon points="0,900 180,580 460,730 740,510 1020,690 1200,560 1200,900" fill="#050914"/>
      </svg>
    `),
  },

  // 6. MINIMAL (Минимализм)
  {
    id: 'mw_minimal_zen',
    name: 'Точка Равновесия',
    subtitle: 'Чистая архитектурная композиция и мягкий свет',
    category: 'minimal',
    accentColor: '#94a3b8',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <rect width="1200" height="900" fill="#0c101d"/>
        <circle cx="600" cy="450" r="240" fill="#161e31"/>
        <circle cx="600" cy="450" r="140" fill="none" stroke="#334155" stroke-width="1.5"/>
        <line x1="200" y1="450" x2="1000" y2="450" stroke="#1e293b" stroke-width="1.5"/>
      </svg>
    `),
  },

  // 7. GEOMETRY (Геометрия)
  {
    id: 'mw_geometry_prism',
    name: 'Изометрическая Призма',
    subtitle: 'Точная геометрия граней в стиле Mender',
    category: 'geometry',
    accentColor: '#6366f1',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <rect width="1200" height="900" fill="#090d1a"/>
        <g stroke="#4f46e5" stroke-opacity="0.22" stroke-width="1.5" fill="none">
          <polygon points="600,140 900,310 900,650 600,820 300,650 300,310"/>
          <polygon points="600,240 810,360 810,600 600,720 390,600 390,360" fill="#1e1b4b" fill-opacity="0.35"/>
          <line x1="600" y1="140" x2="600" y2="820"/>
          <line x1="300" y1="310" x2="900" y2="650"/>
          <line x1="900" y1="310" x2="300" y2="650"/>
        </g>
      </svg>
    `),
  },

  // 8. GRADIENTS (Градиенты)
  {
    id: 'mw_gradient_mender',
    name: 'Фирменный Mender Aurora',
    subtitle: 'Глубокий переход индиго, сапфира и пурпура',
    category: 'gradients',
    accentColor: '#7c3aed',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="mgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e1b4b"/>
            <stop offset="45%" stop-color="#312e81"/>
            <stop offset="100%" stop-color="#4c1d95"/>
          </linearGradient>
          <radialGradient id="mglow" cx="80%" cy="20%" r="60%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#mgrad)"/>
        <rect width="1200" height="900" fill="url(#mglow)"/>
      </svg>
    `),
  },

  // 9. PASTEL (Мягкие пастельные цвета)
  {
    id: 'mw_pastel_lavender',
    name: 'Вечерняя Лаванда',
    subtitle: 'Мягкие бархатные пастельные переливы',
    category: 'pastel',
    accentColor: '#c4b5fd',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2e2344"/>
            <stop offset="50%" stop-color="#262c47"/>
            <stop offset="100%" stop-color="#3b2842"/>
          </linearGradient>
          <radialGradient id="p1" cx="25%" cy="30%" r="50%">
            <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#2e2344" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="p2" cx="75%" cy="70%" r="50%">
            <stop offset="0%" stop-color="#fbcfe8" stop-opacity="0.26"/>
            <stop offset="100%" stop-color="#3b2842" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="900" fill="url(#pbg)"/>
        <rect width="1200" height="900" fill="url(#p1)"/>
        <rect width="1200" height="900" fill="url(#p2)"/>
      </svg>
    `),
  },

  // 10. DARK (Тёмные фоны)
  {
    id: 'mw_dark_obsidian',
    name: 'Обсидиановая Матрица',
    subtitle: 'Ультра-тёмный фон для максимальной контрастности текста',
    category: 'dark',
    accentColor: '#475569',
    svgDataUrl: encodeSvgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
        <defs>
          <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.2" fill="#334155" opacity="0.45"/>
          </pattern>
        </defs>
        <rect width="1200" height="900" fill="#030712"/>
        <rect width="1200" height="900" fill="url(#dots)"/>
      </svg>
    `),
  },
];

/**
 * Generates a custom high-resolution AI/procedural wallpaper on HTML5 Canvas from a user prompt
 * (e.g. «Космос и фиолетовые облака», «Закат и океан», «Неоновый киберпанк», «Горы и луна»)
 * and returns a real JPEG Blob + dataUrl ready for Firebase Storage & Cloud Firestore.
 */
export async function generateAiWallpaperFromPrompt(
  promptText: string
): Promise<{ blob: Blob; dataUrl: string; title: string }> {
  const cleanPrompt = promptText.trim() || 'Космос и фиолетовые облака';
  const lower = cleanPrompt.toLowerCase();

  // Deterministic seed from prompt + timestamp for variety
  let hash = 2166136261;
  const seedStr = `${lower}_${Date.now()}`;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const rand = () => {
    hash += 0x6d2b79f5;
    let t = hash;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Choose palette based on prompt keywords
  let skyTop = '#060417';
  let skyMid = '#1E104C';
  let skyBot = '#6D28D9';
  let glowColor = '#C084FC';
  let cloudColor1 = '#7C3AED';
  let cloudColor2 = '#4C1D95';

  if (lower.includes('закат') || lower.includes('океан') || lower.includes('солнц') || lower.includes('sunset')) {
    skyTop = '#1E1B4B';
    skyMid = '#701A75';
    skyBot = '#EA580C';
    glowColor = '#FDE047';
    cloudColor1 = '#DB2777';
    cloudColor2 = '#4C1D95';
  } else if (lower.includes('сакур') || lower.includes('розов') || lower.includes('цвет') || lower.includes('pink')) {
    skyTop = '#1F1235';
    skyMid = '#581C87';
    skyBot = '#BE185D';
    glowColor = '#F9A8D4';
    cloudColor1 = '#EC4899';
    cloudColor2 = '#500724';
  } else if (lower.includes('лед') || lower.includes('сини') || lower.includes('голуб') || lower.includes('север')) {
    skyTop = '#041026';
    skyMid = '#0C4A6E';
    skyBot = '#0284C7';
    glowColor = '#38BDF8';
    cloudColor1 = '#0369A1';
    cloudColor2 = '#082F49';
  } else if (lower.includes('изумруд') || lower.includes('зелен') || lower.includes('аврор') || lower.includes('лес')) {
    skyTop = '#021210';
    skyMid = '#064E3B';
    skyBot = '#4F46E5';
    glowColor = '#34D399';
    cloudColor1 = '#10B981';
    cloudColor2 = '#1E1B4B';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // 1. Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 900);
  skyGrad.addColorStop(0, skyTop);
  skyGrad.addColorStop(0.55, skyMid);
  skyGrad.addColorStop(1, skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1200, 900);

  // 2. Nebula radial glow
  const radGrad = ctx.createRadialGradient(620, 300, 20, 620, 300, 520);
  radGrad.addColorStop(0, `${glowColor}88`);
  radGrad.addColorStop(0.5, `${cloudColor1}44`);
  radGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, 1200, 900);

  // 3. Starfield
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 95; i++) {
    const sx = rand() * 1200;
    const sy = rand() * 620;
    const sr = 0.8 + rand() * 2.2;
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 4. Crescent Moon
  const moonX = 560 + (rand() - 0.5) * 140;
  const moonY = 230 + (rand() - 0.5) * 50;
  ctx.save();
  ctx.fillStyle = '#F5F3FF';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 35;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(moonX + 26, moonY - 16, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Redraw sky behind moon cutout gently
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1200, 900);
  ctx.globalCompositeOperation = 'source-over';

  // 5. Layered Cosmic Clouds / Mountains
  const drawCloudLayer = (yBase: number, color: string, alpha: number, count: number) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (let i = 0; i <= count; i++) {
      const cx = (i / count) * 1260 - 30 + (rand() - 0.5) * 60;
      const cy = yBase + (rand() - 0.5) * 55;
      const radius = 140 + rand() * 95;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  drawCloudLayer(680, glowColor, 0.25, 7);
  drawCloudLayer(735, cloudColor1, 0.5, 8);
  drawCloudLayer(830, cloudColor2, 0.88, 7);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Failed to encode AI wallpaper blob'))),
      'image/jpeg',
      0.9
    );
  });

  return {
    blob,
    dataUrl,
    title: `ИИ: ${cleanPrompt.slice(0, 42)}`,
  };
}

