import { useState, useEffect } from "react";
import { Briefcase } from "lucide-react";

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
  const [hasError, setHasError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const defaultFallback = fallbackIcon || (
    <Briefcase className="w-4 h-4 text-muted-foreground" />
  );

  if (!src || hasError) {
    return <>{defaultFallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        console.warn(`SafeLogo failed to load image src: "${src}". Falling back to default icon.`);
        setHasError(true);
      }}
    />
  );
}
