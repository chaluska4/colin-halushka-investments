"use client";

import { useEffect, useRef } from "react";

type Bubble = {
  x: number;
  y: number;
  baseRadius: number;
  currentGlow: number;
  targetGlow: number;
};

const CONFIG = {
  // Grid spacing between bubbles
  spacing: 48,
  // Base bubble radius
  baseRadius: 2.5,
  // Cursor activation radius
  activationRadius: 130,
  // Base opacity when inactive
  baseOpacity: 0.06,
  // Max opacity when fully activated
  maxOpacity: 0.7,
  // Glow animation smoothing (0-1, lower = smoother)
  glowSmoothing: 0.08,
  // Glow falloff power (higher = sharper falloff)
  falloffPower: 2,
  // Halo 4 energy sword colors
  baseColor: { r: 47, g: 174, b: 255 },     // #2FAEFF - accent glow
  glowColor: { r: 99, g: 216, b: 255 },     // #63D8FF - accent
  coreColor: { r: 221, g: 251, b: 255 },    // #DDFBFF - brightest
};

export function InteractiveBubbleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<Bubble[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    function createBubbles() {
      const bubbles: Bubble[] = [];
      const { spacing, baseRadius } = CONFIG;

      // Calculate grid dimensions with offset for centering
      const cols = Math.ceil(window.innerWidth / spacing) + 2;
      const rows = Math.ceil(window.innerHeight / spacing) + 2;

      // Offset to center the grid
      const offsetX = (window.innerWidth - (cols - 1) * spacing) / 2;
      const offsetY = (window.innerHeight - (rows - 1) * spacing) / 2;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Slight offset for alternating rows (hexagonal-ish pattern)
          const xOffset = row % 2 === 0 ? 0 : spacing / 2;

          bubbles.push({
            x: offsetX + col * spacing + xOffset,
            y: offsetY + row * spacing,
            baseRadius,
            currentGlow: 0,
            targetGlow: 0,
          });
        }
      }

      bubblesRef.current = bubbles;
    }

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
      createBubbles();
    }

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    function handleResize() {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(resizeCanvas, 100);
    }

    function drawBubble(bubble: Bubble, glow: number) {
      const { baseOpacity, maxOpacity, baseColor, glowColor, coreColor } = CONFIG;

      const opacity = baseOpacity + glow * (maxOpacity - baseOpacity);
      const radius = bubble.baseRadius * (1 + glow * 0.5);

      if (opacity < 0.01) return;

      // Outer glow (only when activated)
      if (glow > 0.05) {
        const glowRadius = radius * (2 + glow * 2);
        const gradient = ctx!.createRadialGradient(
          bubble.x, bubble.y, 0,
          bubble.x, bubble.y, glowRadius
        );

        gradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${glow * 0.3})`);
        gradient.addColorStop(0.4, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${glow * 0.15})`);
        gradient.addColorStop(1, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0)`);

        ctx!.beginPath();
        ctx!.arc(bubble.x, bubble.y, glowRadius, 0, Math.PI * 2);
        ctx!.fillStyle = gradient;
        ctx!.fill();
      }

      // Core bubble
      const coreGradient = ctx!.createRadialGradient(
        bubble.x, bubble.y, 0,
        bubble.x, bubble.y, radius
      );

      const coreOpacity = opacity;
      const edgeOpacity = opacity * 0.4;

      // Interpolate between base and core color based on glow
      const r = Math.round(baseColor.r + (coreColor.r - baseColor.r) * glow);
      const g = Math.round(baseColor.g + (coreColor.g - baseColor.g) * glow);
      const b = Math.round(baseColor.b + (coreColor.b - baseColor.b) * glow);

      coreGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${coreOpacity})`);
      coreGradient.addColorStop(1, `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${edgeOpacity})`);

      ctx!.beginPath();
      ctx!.arc(bubble.x, bubble.y, radius, 0, Math.PI * 2);
      ctx!.fillStyle = coreGradient;
      ctx!.fill();
    }

    function animate() {
      const { activationRadius, glowSmoothing, falloffPower } = CONFIG;
      const mouse = mouseRef.current;

      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const bubble of bubblesRef.current) {
        // Calculate distance from cursor
        const dx = bubble.x - mouse.x;
        const dy = bubble.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate target glow based on distance
        if (distance < activationRadius) {
          const normalized = distance / activationRadius;
          bubble.targetGlow = Math.pow(1 - normalized, falloffPower);
        } else {
          bubble.targetGlow = 0;
        }

        // Smooth transition to target glow
        bubble.currentGlow += (bubble.targetGlow - bubble.currentGlow) * glowSmoothing;

        // Clamp very small values to 0 for performance
        if (bubble.currentGlow < 0.001) {
          bubble.currentGlow = 0;
        }

        drawBubble(bubble, bubble.currentGlow);
      }

      animationRef.current = requestAnimationFrame(animate);
    }

    // Initialize
    resizeCanvas();

    // Event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
