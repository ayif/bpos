"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

export default function ProductImage({
  src,
  name,
  className = "",
  iconClassName = "h-5 w-5",
}: {
  src?: string | null;
  name: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`} aria-label={`Gambar ${name} tidak tersedia`}>
        <ImageIcon className={iconClassName} aria-hidden="true" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
