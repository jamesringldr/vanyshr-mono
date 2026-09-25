import { cx } from "@/utils/cx"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("animate-pulse rounded-md bg-background-surface-secondary", className)}
      {...props}
    />
  )
}

export { Skeleton }
