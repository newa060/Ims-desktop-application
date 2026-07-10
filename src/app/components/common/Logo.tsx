interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  onDark?: boolean;
  className?: string;
}

const Logo = ({ size = 34, withWordmark = true, onDark = false, className = '' }: LogoProps) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-none"
      >
        <rect width="40" height="40" rx="10" fill="#c9d16b" />
        <rect x="8.5" y="22" width="5" height="10" rx="2.5" fill="#1c1c1a" />
        <rect x="17.5" y="15" width="5" height="17" rx="2.5" fill="#1c1c1a" />
        <rect x="26.5" y="8" width="5" height="24" rx="2.5" fill="#1c1c1a" />
      </svg>
      {withWordmark && (
        <span
          className={`font-display font-bold tracking-wide leading-none ${onDark ? 'text-paper' : 'text-ink'}`}
          style={{ fontSize: Math.round(size * 0.56) }}
        >
          IMS
        </span>
      )}
    </div>
  );
};

export default Logo;
