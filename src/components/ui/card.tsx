import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex h-full min-w-[320px] flex-col justify-between rounded-lg border border-primitive-neutral-800 bg-primitive-neutral-900 p-4 hover:z-10 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-2 mb-4", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-1 flex-col", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex items-center justify-between gap-2 pt-3", className)} {...props} />;
}
