"use client";

import { useEffect, useRef, useCallback } from "react";

type EnergyStream = {
  points: { x: number; y: number; vx: number; vy: number }[];
  opacity: number;
  width: number;
  color: string;
  speed: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
};

type Ember = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseOpacity: number;
  color: string;
  layer: number; // 0 = far/slow, 1 = mid, 2 = near/fast (parallax)
  // Cinematic properties
  driftPhase: number; // For organic wandering motion
  driftSpeed: number;
  driftAmplitude: number;
  shimmerPhase: number; // For light-catching moments
  shimmerSpeed: number;
  warmth: number; // Color temperature variation 0-1
  focusBlur: number; // Depth of field softness
};

const COLORS = {
  cyan: "99, 216, 255",
  blue: "47, 174, 255",
  white: "220, 240, 255",
  silver: "180, 200, 220",
};

// Cinematic dust color palette - muted, film-like warmth
const DUST_COLORS = [
  [180, 140, 95],   // Warm amber
  [160, 125, 80],   // Muted gold
  [200, 155, 100],  // Soft orange
  [145, 115, 75],   // Deep bronze
  [190, 165, 120],  // Pale sand
  [170, 130, 85],   // Burnt sienna
];

export function SciFiFinanceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamsRef = useRef<EnergyStream[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const embersRef = useRef<Ember[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });
  // Smoothed mouse position for silky easing
  const smoothMouseRef = useRef({ x: -1000, y: -1000, intensity: 0 });
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const createStreams = useCallback(() => {
    const streams: EnergyStream[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Horizontal flowing energy streams
    for (let i = 0; i < 6; i++) {
      const points: EnergyStream["points"] = [];
      const y = h * (0.2 + Math.random() * 0.6);
      const startX = -200;

      for (let j = 0; j < 8; j++) {
        points.push({
          x: startX + j * (w / 6),
          y: y + (Math.random() - 0.5) * 100,
          vx: 0.3 + Math.random() * 0.4,
          vy: (Math.random() - 0.5) * 0.1,
        });
      }

      streams.push({
        points,
        opacity: 0.03 + Math.random() * 0.04,
        width: 1 + Math.random() * 2,
        color: Math.random() > 0.3 ? COLORS.cyan : COLORS.blue,
        speed: 0.5 + Math.random() * 0.5,
      });
    }

    // Diagonal ascending streams
    for (let i = 0; i < 4; i++) {
      const points: EnergyStream["points"] = [];
      const startX = Math.random() * w;
      const startY = h + 100;

      for (let j = 0; j < 6; j++) {
        points.push({
          x: startX + j * 80 + (Math.random() - 0.5) * 40,
          y: startY - j * (h / 4),
          vx: 0.2 + Math.random() * 0.2,
          vy: -0.4 - Math.random() * 0.3,
        });
      }

      streams.push({
        points,
        opacity: 0.02 + Math.random() * 0.03,
        width: 0.5 + Math.random() * 1.5,
        color: COLORS.white,
        speed: 0.3 + Math.random() * 0.3,
      });
    }

    streamsRef.current = streams;
  }, []);

  const createParticles = useCallback(() => {
    const particles: Particle[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (let i = 0; i < 50; i++) {
      const colorKeys = ["cyan", "blue", "white", "silver"] as const;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.2 - 0.1,
        size: 0.5 + Math.random() * 1.5,
        opacity: 0.1 + Math.random() * 0.3,
        color: COLORS[colorKeys[Math.floor(Math.random() * colorKeys.length)]],
        life: Math.random() * 1000,
        maxLife: 500 + Math.random() * 1000,
      });
    }

    particlesRef.current = particles;
  }, []);

  const createEmbers = useCallback(() => {
    const embers: Ember[] = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Cinematic dust distribution - mix of micro and larger motes
    // More particles in far layers (atmospheric haze), fewer close
    const layerCounts = [18, 10, 6]; // Far, mid, near

    for (let layer = 0; layer < 3; layer++) {
      const count = layerCounts[layer];

      for (let i = 0; i < count; i++) {
        // Size distribution: mostly micro-particles, occasional larger motes
        const sizeRoll = Math.random();
        let size: number;
        if (sizeRoll < 0.6) {
          size = 0.4 + Math.random() * 0.6; // Micro dust (60%)
        } else if (sizeRoll < 0.9) {
          size = 1 + Math.random() * 1.2; // Medium motes (30%)
        } else {
          size = 2 + Math.random() * 1.5; // Larger particles (10%)
        }

        // Far layers are smaller and more diffuse
        const layerSizeMult = [0.5, 0.75, 1][layer];
        size *= layerSizeMult;

        // Pick a color and add warmth variation
        const baseColor = DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)];
        const warmth = Math.random();

        // Depth of field - far particles are softer/blurrier
        const focusBlur = [2.5, 1.4, 1][layer];

        // Opacity varies by layer (far = more subtle)
        const layerOpacity = [0.08, 0.14, 0.22][layer];
        const baseOpacity = layerOpacity + Math.random() * 0.08;

        embers.push({
          x: Math.random() * w,
          y: Math.random() * h,
          // Almost imperceptible base drift
          vx: (Math.random() - 0.5) * 0.04,
          vy: (Math.random() - 0.5) * 0.03 - 0.01, // Tiny upward bias
          size,
          baseOpacity,
          color: baseColor.join(", "),
          layer,
          // Organic wandering motion (like dust in air currents)
          driftPhase: Math.random() * Math.PI * 2,
          driftSpeed: 0.2 + Math.random() * 0.4,
          driftAmplitude: 0.3 + Math.random() * 0.5,
          // Light-catching shimmer (rare bright moments)
          shimmerPhase: Math.random() * Math.PI * 2,
          shimmerSpeed: 0.1 + Math.random() * 0.2,
          warmth,
          focusBlur,
        });
      }
    }

    embersRef.current = embers;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
      createStreams();
      createParticles();
      createEmbers();
    }

    function handleMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    }

    function handleMouseLeave() {
      mouseRef.current = { ...mouseRef.current, active: false };
    }

    function drawEnergyStreams() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = smoothMouseRef.current;
      const t = timeRef.current;

      for (const stream of streamsRef.current) {
        // Track if any point is near mouse for brightness boost
        let nearestDist = Infinity;

        // Update points
        for (let idx = 0; idx < stream.points.length; idx++) {
          const point = stream.points[idx];
          point.x += point.vx * stream.speed;
          point.y += point.vy * stream.speed;

          const dx = mouse.x - point.x;
          const dy = mouse.y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          nearestDist = Math.min(nearestDist, dist);

          // Mouse interaction with smooth morphing
          if (mouse.intensity > 0.01) {
            const interactionRadius = 280;
            if (dist < interactionRadius) {
              const normalizedDist = dist / interactionRadius;
              // Smooth falloff curve
              const falloff = Math.pow(1 - normalizedDist, 2);

              // Wave distortion - perpendicular oscillation
              const angle = Math.atan2(dy, dx);
              const perpAngle = angle + Math.PI / 2;
              const wavePhase = t * 2 + idx * 0.8;
              const waveAmp = 15 * falloff * mouse.intensity;
              const waveOffset = Math.sin(wavePhase) * waveAmp;

              // Gentle attraction toward cursor
              const attractForce = falloff * 0.015 * mouse.intensity;
              point.x += dx * attractForce;
              point.y += dy * attractForce;

              // Perpendicular wave motion
              point.x += Math.cos(perpAngle) * waveOffset * 0.3;
              point.y += Math.sin(perpAngle) * waveOffset * 0.3;

              // Gentle orbital morphing around cursor
              const orbitForce = falloff * 0.008 * mouse.intensity;
              point.x += Math.cos(angle + Math.PI / 2) * orbitForce * 20;
              point.y += Math.sin(angle + Math.PI / 2) * orbitForce * 20;
            }
          }

          // Wrap around
          if (point.x > w + 200) point.x = -100;
          if (point.x < -200) point.x = w + 100;
          if (point.y < -100) point.y = h + 100;
          if (point.y > h + 100) point.y = -100;
        }

        // Draw smooth curve through points
        if (stream.points.length < 2) continue;

        ctx!.beginPath();
        ctx!.moveTo(stream.points[0].x, stream.points[0].y);

        for (let i = 1; i < stream.points.length - 1; i++) {
          const xc = (stream.points[i].x + stream.points[i + 1].x) / 2;
          const yc = (stream.points[i].y + stream.points[i + 1].y) / 2;
          ctx!.quadraticCurveTo(stream.points[i].x, stream.points[i].y, xc, yc);
        }

        const lastIdx = stream.points.length - 1;
        ctx!.lineTo(stream.points[lastIdx].x, stream.points[lastIdx].y);

        // Calculate brightness boost based on proximity to mouse
        const proximityBoost = mouse.intensity > 0.01 && nearestDist < 300
          ? 1 + (1 - nearestDist / 300) * 1.5 * mouse.intensity
          : 1;
        const boostedOpacity = Math.min(stream.opacity * proximityBoost, 0.25);

        // Create gradient along path
        const gradient = ctx!.createLinearGradient(
          stream.points[0].x, stream.points[0].y,
          stream.points[lastIdx].x, stream.points[lastIdx].y
        );
        gradient.addColorStop(0, `rgba(${stream.color}, 0)`);
        gradient.addColorStop(0.2, `rgba(${stream.color}, ${boostedOpacity})`);
        gradient.addColorStop(0.8, `rgba(${stream.color}, ${boostedOpacity})`);
        gradient.addColorStop(1, `rgba(${stream.color}, 0)`);

        ctx!.strokeStyle = gradient;
        ctx!.lineWidth = stream.width * (proximityBoost > 1 ? 1 + (proximityBoost - 1) * 0.3 : 1);
        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        ctx!.stroke();

        // Enhanced glow near cursor
        const glowIntensity = proximityBoost > 1 ? 0.3 + (proximityBoost - 1) * 0.4 : 0.3;
        ctx!.shadowColor = `rgba(${stream.color}, ${glowIntensity})`;
        ctx!.shadowBlur = 10 + (proximityBoost - 1) * 15;
        ctx!.stroke();
        ctx!.shadowBlur = 0;
      }
    }

    function drawParticles() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = smoothMouseRef.current;

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mouse interaction - particles drift with parallax effect
        if (mouse.intensity > 0.01 && dist < 200 && dist > 0) {
          const normalizedDist = dist / 200;
          const falloff = Math.pow(1 - normalizedDist, 1.5);

          // Gentle repulsion with parallax (closer particles move more)
          const parallaxFactor = 1 + (1 - p.size / 2) * 0.5;
          const force = falloff * 0.4 * mouse.intensity * parallaxFactor;
          p.vx += (dx / dist) * force * 0.03;
          p.vy += (dy / dist) * force * 0.03;
        }

        // Dampen velocity smoothly
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Wrap around
        if (p.x < -20) p.x = w + 10;
        if (p.x > w + 20) p.x = -10;
        if (p.y < -20) p.y = h + 10;
        if (p.y > h + 20) p.y = -10;

        // Reset life
        if (p.life > p.maxLife) {
          p.life = 0;
          p.x = Math.random() * w;
          p.y = Math.random() * h;
        }

        // Fade based on life
        const lifeFade = Math.sin((p.life / p.maxLife) * Math.PI);

        // Brightness boost near cursor
        const proximityBoost = mouse.intensity > 0.01 && dist < 180
          ? 1 + (1 - dist / 180) * 0.8 * mouse.intensity
          : 1;
        const opacity = Math.min(p.opacity * lifeFade * proximityBoost, 0.7);

        if (opacity < 0.01) continue;

        // Draw particle with glow
        const glowSize = p.size * 4 * (proximityBoost > 1 ? 1 + (proximityBoost - 1) * 0.5 : 1);
        const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `rgba(${p.color}, ${opacity})`);
        gradient.addColorStop(0.3, `rgba(${p.color}, ${opacity * 0.4})`);
        gradient.addColorStop(1, `rgba(${p.color}, 0)`);

        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawEmbers() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = smoothMouseRef.current;
      const t = timeRef.current;

      for (const e of embersRef.current) {
        // Parallax speed multiplier
        const layerMult = [0.25, 0.5, 1][e.layer];

        // Organic wandering motion - like dust caught in subtle air currents
        const driftX = Math.sin(t * e.driftSpeed + e.driftPhase) * e.driftAmplitude;
        const driftY = Math.cos(t * e.driftSpeed * 0.7 + e.driftPhase) * e.driftAmplitude * 0.6;

        // Apply base velocity + organic drift
        e.x += (e.vx + driftX * 0.02) * layerMult;
        e.y += (e.vy + driftY * 0.02) * layerMult;

        // Wrap around (with buffer for smooth transition)
        if (e.x < -50) e.x = w + 40;
        if (e.x > w + 50) e.x = -40;
        if (e.y < -50) e.y = h + 40;
        if (e.y > h + 50) e.y = -40;

        // Light-catching shimmer - rare bright moments like dust catching light
        const shimmerBase = Math.sin(t * e.shimmerSpeed + e.shimmerPhase);
        // Only shimmer when sine is in the top 15% of its range
        const shimmerPeak = shimmerBase > 0.85 ? (shimmerBase - 0.85) / 0.15 : 0;
        const shimmer = 1 + shimmerPeak * 1.8;

        // Mouse interaction
        const dx = e.x - mouse.x;
        const dy = e.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let brightnessBoost = 1;
        let mouseDisturb = 0;

        if (mouse.intensity > 0.01) {
          const interactionRadius = 160 * (1 + e.layer * 0.3); // Larger for near particles
          if (dist < interactionRadius) {
            const normalizedDist = dist / interactionRadius;
            const falloff = Math.pow(1 - normalizedDist, 2);

            // Subtle brightness boost
            brightnessBoost = 1 + falloff * 0.4 * mouse.intensity;

            // Gentle turbulence - particles swirl slightly
            mouseDisturb = falloff * mouse.intensity;
            const turbAngle = Math.atan2(dy, dx) + Math.PI * 0.5;
            const turbForce = mouseDisturb * 0.15 * layerMult;
            e.x += Math.cos(turbAngle) * turbForce + (dx / dist) * turbForce * 0.5;
            e.y += Math.sin(turbAngle) * turbForce + (dy / dist) * turbForce * 0.5;
          }
        }

        // Final opacity: base + shimmer + cursor boost
        const opacity = Math.min(e.baseOpacity * shimmer * brightnessBoost, 0.45);

        if (opacity < 0.015) continue;

        // Depth of field: far particles are softer/larger glow
        const blurMult = e.focusBlur;
        const glowRadius = e.size * (2.5 + blurMult);

        // Color temperature shift based on warmth + shimmer brightening
        const [r, g, b] = e.color.split(", ").map(Number);
        const warmShift = e.warmth * 15;
        const shimmerWhite = shimmerPeak * 40; // Adds white when catching light
        const finalR = Math.min(255, r + warmShift + shimmerWhite);
        const finalG = Math.min(255, g + shimmerWhite * 0.7);
        const finalB = Math.min(255, b - warmShift * 0.3 + shimmerWhite * 0.4);
        const colorStr = `${Math.round(finalR)}, ${Math.round(finalG)}, ${Math.round(finalB)}`;

        // Draw with depth-aware softness
        const gradient = ctx!.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowRadius);

        // Softer falloff for far particles (more diffuse)
        const coreFalloff = e.layer === 0 ? 0.15 : e.layer === 1 ? 0.25 : 0.35;
        const midFalloff = e.layer === 0 ? 0.4 : e.layer === 1 ? 0.5 : 0.55;

        gradient.addColorStop(0, `rgba(${colorStr}, ${opacity})`);
        gradient.addColorStop(coreFalloff, `rgba(${colorStr}, ${opacity * 0.6})`);
        gradient.addColorStop(midFalloff, `rgba(${colorStr}, ${opacity * 0.2})`);
        gradient.addColorStop(1, `rgba(${colorStr}, 0)`);

        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(e.x, e.y, glowRadius, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawMouseGlow() {
      const mouse = smoothMouseRef.current;
      if (mouse.intensity < 0.01) return;

      const t = timeRef.current;
      const { x, y, intensity } = mouse;

      // Pulsing size variation
      const pulseSize = 1 + Math.sin(t * 1.5) * 0.05;
      const baseRadius = 320 * pulseSize;

      // Outer soft glow - large and diffuse
      const outerGradient = ctx!.createRadialGradient(x, y, 0, x, y, baseRadius);
      outerGradient.addColorStop(0, `rgba(${COLORS.cyan}, ${0.08 * intensity})`);
      outerGradient.addColorStop(0.2, `rgba(${COLORS.blue}, ${0.05 * intensity})`);
      outerGradient.addColorStop(0.5, `rgba(${COLORS.cyan}, ${0.025 * intensity})`);
      outerGradient.addColorStop(0.75, `rgba(${COLORS.blue}, ${0.01 * intensity})`);
      outerGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx!.fillStyle = outerGradient;
      ctx!.beginPath();
      ctx!.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx!.fill();

      // Inner bright core glow
      const coreRadius = 80 * pulseSize;
      const coreGradient = ctx!.createRadialGradient(x, y, 0, x, y, coreRadius);
      coreGradient.addColorStop(0, `rgba(${COLORS.white}, ${0.12 * intensity})`);
      coreGradient.addColorStop(0.3, `rgba(${COLORS.cyan}, ${0.08 * intensity})`);
      coreGradient.addColorStop(0.7, `rgba(${COLORS.blue}, ${0.03 * intensity})`);
      coreGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx!.fillStyle = coreGradient;
      ctx!.beginPath();
      ctx!.arc(x, y, coreRadius, 0, Math.PI * 2);
      ctx!.fill();

      // Ring wave effect - subtle expanding rings
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const phase = (t * 0.4 + i * 0.33) % 1;
        const ringRadius = 60 + phase * 200;
        const ringOpacity = (1 - phase) * 0.04 * intensity;

        if (ringOpacity > 0.005) {
          ctx!.strokeStyle = `rgba(${COLORS.cyan}, ${ringOpacity})`;
          ctx!.lineWidth = 1.5 * (1 - phase * 0.5);
          ctx!.beginPath();
          ctx!.arc(x, y, ringRadius, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }
    }

    function drawAmbientGlows() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = timeRef.current;

      // Pulsing central glow
      const pulseIntensity = 0.03 + Math.sin(t * 0.3) * 0.01;
      const centerGradient = ctx!.createRadialGradient(
        w * 0.5, h * 0.35, 0,
        w * 0.5, h * 0.35, w * 0.5
      );
      centerGradient.addColorStop(0, `rgba(${COLORS.cyan}, ${pulseIntensity})`);
      centerGradient.addColorStop(0.4, `rgba(${COLORS.blue}, ${pulseIntensity * 0.5})`);
      centerGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx!.fillStyle = centerGradient;
      ctx!.fillRect(0, 0, w, h);

      // Bottom horizon glow
      const horizonGradient = ctx!.createLinearGradient(0, h * 0.75, 0, h);
      horizonGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      horizonGradient.addColorStop(1, `rgba(${COLORS.blue}, 0.04)`);

      ctx!.fillStyle = horizonGradient;
      ctx!.fillRect(0, h * 0.75, w, h * 0.25);
    }

    function animate() {
      timeRef.current += 0.016;

      // Smooth mouse position with silky easing (lerp)
      const rawMouse = mouseRef.current;
      const smooth = smoothMouseRef.current;
      const easingFactor = 0.08; // Lower = smoother/slower

      smooth.x += (rawMouse.x - smooth.x) * easingFactor;
      smooth.y += (rawMouse.y - smooth.y) * easingFactor;

      // Smooth intensity fade in/out
      const targetIntensity = rawMouse.active ? 1 : 0;
      smooth.intensity += (targetIntensity - smooth.intensity) * 0.06;

      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      drawAmbientGlows();
      drawEmbers(); // Draw embers first (behind other effects)
      drawEnergyStreams();
      drawParticles();
      drawMouseGlow();

      animationRef.current = requestAnimationFrame(animate);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [createStreams, createParticles, createEmbers]);

  return (
    <>
      {/* Deep base gradient */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse 140% 70% at 50% 10%, rgba(20, 40, 80, 0.4) 0%, transparent 50%),
            radial-gradient(ellipse 100% 50% at 80% 90%, rgba(47, 174, 255, 0.08) 0%, transparent 40%),
            radial-gradient(ellipse 80% 40% at 10% 80%, rgba(99, 216, 255, 0.05) 0%, transparent 40%),
            linear-gradient(180deg, #020408 0%, #040812 20%, #061020 50%, #081830 80%, #0a2040 100%)
          `,
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Brand title in background */}
      <div
        style={{
          position: "fixed",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            fontSize: "clamp(1.8rem, 5vw, 3.5rem)",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            background: `
              linear-gradient(180deg,
                rgba(220, 240, 255, 0.95) 0%,
                rgba(180, 210, 240, 0.9) 20%,
                rgba(140, 180, 220, 0.85) 40%,
                rgba(99, 216, 255, 0.8) 60%,
                rgba(47, 174, 255, 0.7) 80%,
                rgba(30, 120, 200, 0.6) 100%
              )
            `,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 30px rgba(99, 216, 255, 0.4)) drop-shadow(0 0 60px rgba(47, 174, 255, 0.2))",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          <span style={{ display: "block", letterSpacing: "0.15em", fontSize: "0.35em", opacity: 0.7, marginBottom: "0.3em" }}>
            ━━━━━━━━━━━━━━━━━━━━━━
          </span>
          COLIN HALUSKA
          <span
            style={{
              display: "block",
              fontSize: "0.7em",
              letterSpacing: "0.25em",
              marginTop: "0.1em",
              background: `linear-gradient(90deg,
                rgba(99, 216, 255, 0.6) 0%,
                rgba(180, 220, 255, 0.9) 30%,
                rgba(255, 255, 255, 1) 50%,
                rgba(180, 220, 255, 0.9) 70%,
                rgba(99, 216, 255, 0.6) 100%
              )`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            INVESTMENTS
          </span>
          <span style={{ display: "block", letterSpacing: "0.15em", fontSize: "0.35em", opacity: 0.7, marginTop: "0.3em" }}>
            ━━━━━━━━━━━━━━━━━━━━━━
          </span>
        </div>

        {/* Metallic shine overlay effect */}
        <div
          style={{
            position: "absolute",
            inset: "-20%",
            background: `
              linear-gradient(105deg,
                transparent 40%,
                rgba(255, 255, 255, 0.03) 45%,
                rgba(255, 255, 255, 0.08) 50%,
                rgba(255, 255, 255, 0.03) 55%,
                transparent 60%
              )
            `,
            animation: "shimmer 8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Canvas animation layer */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 2,
        }}
        aria-hidden="true"
      />

      {/* Top vignette */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            linear-gradient(180deg, rgba(2, 4, 8, 0.6) 0%, transparent 25%),
            radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(2, 4, 8, 0.5) 100%)
          `,
          pointerEvents: "none",
          zIndex: 3,
        }}
        aria-hidden="true"
      />

      {/* CSS animation */}
      <style jsx global>{`
        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}
