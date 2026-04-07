"use client";

import type { CSSProperties } from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: CSSProperties;
};

export function SkeletonBlock({ width = "100%", height = 16, borderRadius = 6, style }: Props) {
  return (
    <>
      <style>{`
        @keyframes skeletonShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div
        style={{
          width,
          height,
          borderRadius,
          background: "linear-gradient(90deg, rgba(47,174,255,0.08) 25%, rgba(99,216,255,0.15) 50%, rgba(47,174,255,0.08) 75%)",
          backgroundSize: "200% 100%",
          animation: "skeletonShimmer 1.6s ease-in-out infinite",
          ...style,
        }}
      />
    </>
  );
}
