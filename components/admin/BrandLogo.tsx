import Image from "next/image";

/**
 * The Mister Chameleon logo for dark surfaces (admin sidebar, login page):
 * public/logo-on-dark.svg, the coloured dots of logo.svg with a white wordmark.
 * The dot mark alone (favicon) is too fine to read at sidebar size, and
 * logo-dark.svg is all white on its own black background.
 */
export function BrandLogo({ width, className }: { width: number; className?: string }) {
  const height = Math.round((width * 324) / 535);
  return (
    <Image
      src="/logo-on-dark.svg"
      alt="Mister Chameleon"
      width={width}
      height={height}
      unoptimized
      className={className}
    />
  );
}
