import React from "react";
import { Briefcase } from "lucide-react";
import { OptimizedImage } from "@/src/components/OptimizedImage";

interface SafeLogoProps {
  src?: string;
  fallbackIcon?: React.ReactNode;
  alt?: string;
  className?: string;
}

export function SafeLogo({
  src,
  fallbackIcon,
  alt = "Logo",
  className = "w-full h-full object-cover"
}: SafeLogoProps) {
  const defaultFallback = fallbackIcon || (
    <Briefcase className="w-4 h-4 text-muted-foreground" />
  );

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fallbackIcon={defaultFallback}
      className={className}
      containerClassName="w-full h-full"
    />
  );
}
