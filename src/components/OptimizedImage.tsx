import React, { useState, useEffect } from "react";
import { cn, resolveDriveImage } from "@/lib/utils";
import { ImageOff } from "lucide-react";

export interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  fallbackIcon?: React.ReactNode;
  fallbackInitials?: string;
  aspectRatio?: string;
  className?: string;
  containerClassName?: string;
  priority?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  fallbackIcon,
  fallbackInitials,
  aspectRatio,
  className,
  containerClassName,
  priority = false,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = src ? resolveDriveImage(src) : undefined;

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  const defaultFallback = fallbackIcon || (
    <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 text-muted-foreground/50 p-2">
      {fallbackInitials ? (
        <span className="font-mono font-bold text-xs uppercase tracking-wider text-muted-foreground">
          {fallbackInitials.substring(0, 2)}
        </span>
      ) : (
        <ImageOff className="w-4 h-4 opacity-40" />
      )}
    </div>
  );

  if (!resolvedSrc || hasError) {
    return (
      <div className={cn("relative overflow-hidden rounded-[8px] bg-secondary/20 flex items-center justify-center", containerClassName)} style={aspectRatio ? { aspectRatio } : undefined}>
        {defaultFallback}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-[8px] bg-secondary/10", containerClassName)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Shimmer Blur Placeholder while image is loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted/40 animate-pulse rounded-[8px]" />
      )}

      <img
        src={resolvedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setHasError(true);
          setIsLoaded(true);
        }}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300 rounded-[8px]",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </div>
  );
}
