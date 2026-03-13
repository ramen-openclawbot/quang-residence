"use client";

export default function Skeleton({ width = "100%", height = 16, radius = 8 }) {
  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`}</style>
      <div style={{
        width, height, borderRadius: radius,
        background: "linear-gradient(90deg, #f0f4f0 25%, #e8ede8 50%, #f0f4f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }} />
    </>
  );
}
