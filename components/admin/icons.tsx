/**
 * Small line icons for the admin chrome: buttons, badges and empty states. They
 * replace colour emoji, which render differently per platform and clash with
 * the indigo accent. Colour comes from currentColor, size from className.
 */

function Icon({ className = "size-4", children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const BoltIcon = (p: IconProps) => (
  <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Icon>
);
export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></Icon>
);
export const LayersIcon = (p: IconProps) => (
  <Icon {...p}><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" /></Icon>
);
export const FolderIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" /></Icon>
);
export const FlaskIcon = (p: IconProps) => (
  <Icon {...p}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 15h9" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}><path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-6-6l-1.5 1.5M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 6 6l1.5-1.5" /></Icon>
);
export const TagIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01" /></Icon>
);
export const SproutIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 15c0-3 3-5 7-5 0 3-3 5-7 5z" /></Icon>
);
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.5 6.5a4 4 0 0 1 5-5l-3 3 1 2.5 2.5 1 3-3a4 4 0 0 1-5 5L8 21a2 2 0 0 1-3-3z" /></Icon>
);
