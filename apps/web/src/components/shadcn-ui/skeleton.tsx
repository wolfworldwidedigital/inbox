import { cn } from '@/src/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-base-3 animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
