"use client";

import React from "react";
import Image from "next/image";

interface AnimatedGifProps {
  state: boolean;
  gifSrc: string;
  jpgSrc: string;
  altText?: string;
  width?: number;
  height?: number;
}

const AnimatedGif: React.FC<AnimatedGifProps> = ({
  state,
  gifSrc,
  jpgSrc,
  altText = "Status image",
  width = 300,
  height = 200,
}) => {
  return (
    <div className="w-full flex justify-center">
      <Image
        src={state ? gifSrc : jpgSrc}
        alt={altText}
        width={width}
        height={height}
        className={`rounded-md object-cover ${!state ? 'opacity-60' : ''}`}
      />
    </div>
  );
};

export default AnimatedGif;
