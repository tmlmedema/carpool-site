export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 320 220" aria-hidden="true">
      <g fill="none" stroke="#f2b705" strokeWidth={3} opacity={0.9}>
        <path d="M20 170 Q90 120 160 150 T300 110" />
        <path d="M20 185 Q90 135 160 165 T300 125" opacity={0.5} />
      </g>
      <g fill="#f2b705">
        <circle cx={70} cy={120} r={10} />
        <rect x={77} y={62} width={4} height={58} />
        <circle cx={120} cy={104} r={10} />
        <rect x={127} y={46} width={4} height={58} />
        <rect x={77} y={46} width={54} height={10} transform="skewY(-10) translate(0 14)" />
      </g>
      <g transform="translate(170 40)">
        <rect x={0} y={40} width={130} height={56} rx={16} fill="#fff" />
        <path d="M22 40 L40 12 H96 L112 40Z" fill="#fff" opacity={0.85} />
        <circle cx={30} cy={98} r={15} fill="#14224a" stroke="#f2b705" strokeWidth={5} />
        <circle cx={100} cy={98} r={15} fill="#14224a" stroke="#f2b705" strokeWidth={5} />
        <rect x={46} y={18} width={20} height={18} rx={3} fill="#9fb3e6" />
        <rect x={70} y={18} width={20} height={18} rx={3} fill="#9fb3e6" />
      </g>
      <g fill="#fff" opacity={0.8}>
        <circle cx={250} cy={24} r={6} />
        <rect x={255} y={-4} width={3} height={28} />
      </g>
    </svg>
  );
}
