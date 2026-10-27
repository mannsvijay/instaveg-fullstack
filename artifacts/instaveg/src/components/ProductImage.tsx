import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const PLACEHOLDER_IMAGE = "/images/placeholder.svg";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  /** Sizing/rounding for the square frame, e.g. "w-16 rounded-xl" or "w-full". */
  className?: string;
  imgClassName?: string;
  /** Use eager loading for above-the-fold images (e.g. the product detail hero). */
  eager?: boolean;
};

// The one way product images are rendered (H3): square frame, object-cover,
// lazy loading, and a local placeholder if the image is missing or fails.
export function ProductImage({ src, alt, className, imgClassName, eager = false }: ProductImageProps) {
  const [current, setCurrent] = useState(src || PLACEHOLDER_IMAGE);

  useEffect(() => {
    setCurrent(src || PLACEHOLDER_IMAGE);
  }, [src]);

  return (
    <div className={cn("relative aspect-square overflow-hidden bg-product-bg flex-shrink-0", className)}>
      <img
        src={current}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        width={800}
        height={800}
        onError={() => {
          if (current !== PLACEHOLDER_IMAGE) setCurrent(PLACEHOLDER_IMAGE);
        }}
        className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
