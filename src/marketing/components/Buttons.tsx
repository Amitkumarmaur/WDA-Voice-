import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '../../lib/utils';

const base = cn(
  'type-button inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md px-[18px] py-2.5',
  'transition-ui motion-safe:active:scale-[0.99]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

type BtnProps = React.ComponentProps<'button'> & { className?: string };

export function ButtonPrimary({ className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(base, 'bg-ink text-on-primary hover:bg-ink/90', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonPrimaryLink({ className, children, to, ...rest }: LinkProps & { className?: string }) {
  return (
    <Link className={cn(base, 'bg-ink text-on-primary hover:bg-ink/90', className)} to={to} {...rest}>
      {children}
    </Link>
  );
}

export function ButtonSecondary({ className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        base,
        'border border-hairline bg-surface-1 text-ink hover:border-ink/15 hover:bg-surface-1',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonSecondaryLink({ className, children, to, ...rest }: LinkProps & { className?: string }) {
  return (
    <Link
      className={cn(
        base,
        'border border-hairline bg-surface-1 text-ink hover:border-ink/15',
        className
      )}
      to={to}
      {...rest}
    >
      {children}
    </Link>
  );
}

export function ButtonFin({ className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cn(
        base,
        'min-h-11 bg-fin-orange text-on-primary hover:bg-[#e64e00] focus-visible:ring-fin-orange/40',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonFinLink({ className, children, to, ...rest }: LinkProps & { className?: string }) {
  return (
    <Link
      className={cn(
        base,
        'min-h-11 bg-fin-orange text-on-primary hover:bg-[#e64e00] focus-visible:ring-fin-orange/40',
        className
      )}
      to={to}
      {...rest}
    >
      {children}
    </Link>
  );
}
