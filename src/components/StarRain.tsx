import { useEffect, useRef } from 'react';

interface StarRainProps {
  active: boolean;
}

export default function StarRain({ active }: StarRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Star particle model representing a cozy starry night
    class StarParticle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      twinkleSpeed: number;
      twinkleOffset: number;
      glowRadius: number;

      constructor(isInitial = false) {
        this.x = Math.random() * width;
        this.y = isInitial ? Math.random() * height : -10 - Math.random() * 50;
        this.size = Math.random() * 2 + 1; // 1px to 3px (li ti nhỏ)
        this.speedY = Math.random() * 1.5 + 0.5; // gentle downward drifting
        this.speedX = (Math.random() - 0.5) * 0.3; // subtle left-right drifting
        this.opacity = Math.random() * 0.8 + 0.2;
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
        this.twinkleOffset = Math.random() * Math.PI * 2;
        this.glowRadius = Math.random() * 4 + 2;
      }

      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.twinkleOffset += this.twinkleSpeed;

        // Reset if offscreen
        if (this.y > height + 10 || this.x < -10 || this.x > width + 10) {
          this.x = Math.random() * width;
          this.y = -10;
          this.opacity = Math.random() * 0.8 + 0.2;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        
        // Twinkle factor using cosine
        const breathe = 0.5 + 0.5 * Math.cos(this.twinkleOffset);
        const currentOpacity = Math.max(0.15, this.opacity * (0.6 + 0.4 * Math.cos(this.twinkleOffset)));
        c.globalAlpha = currentOpacity;
        
        // 1. Draw a soft radial gradient halo first for the beautiful light glow
        const glowRadius = this.size * (3 + 5 * breathe);
        const gradient = c.createRadialGradient(
          this.x, this.y, this.size * 0.1,
          this.x, this.y, glowRadius
        );
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.45)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.12)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        c.beginPath();
        c.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
        c.fillStyle = gradient;
        c.fill();
        
        // 2. Draw the bright, sharp star core
        c.beginPath();
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        // Set glow shadow for cosmic depth
        c.shadowBlur = this.glowRadius + 2;
        c.shadowColor = 'rgba(255, 255, 255, 0.95)';
        c.fillStyle = '#ffffff';
        c.fill();
        
        c.restore();
      }
    }

    // Initialize starry particles (higher density for immersive vibe)
    const particleCount = Math.min(80, Math.floor((width * height) / 12000));
    const particles: StarParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new StarParticle(true));
    }

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.update();
        p.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 block"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
