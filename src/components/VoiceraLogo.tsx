import { cn } from '../lib/utils';
import voiceraLogoNavUrl from '../assets/voicera-logo-nav.svg?url';
import voiceraLogoFullUrl from '../assets/voicera-logo.svg?url';

type VoiceraLogoProps = {
  className?: string;
  /** Alt for accessibility. Default: Voicera. */
  alt?: string;
  /**
   * `wordmark` — logo + bars only (fits headers; readable at nav heights).
   * `full` — includes tagline (“Every missed call…”).
   */
  variant?: 'wordmark' | 'full';
};

/**
 * Voicera wordmark. Imported via Vite (`?url`) so the path resolves in dev, preview, and any `base` config.
 */
export function VoiceraLogo({ className, alt = 'Voicera', variant = 'wordmark' }: VoiceraLogoProps) {
  const full = variant === 'full';
  return (
    <img
      src={full ? voiceraLogoFullUrl : voiceraLogoNavUrl}
      alt={alt}
      width={full ? 320 : 300}
      height={full ? 80 : 64}
      decoding="async"
      className={cn(
        'h-9 w-auto max-w-full shrink-0 object-left object-contain sm:h-10',
        className
      )}
    />
  );
}
