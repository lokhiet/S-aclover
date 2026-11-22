import { useEffect, useRef } from 'react';

interface CloverRainProps {
  active: boolean;
}

export default function CloverRain({ active }: CloverRainProps) {
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

    // Particle class for clover
    class CloverParticle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
      swayAmount: number;
      swaySpeed: number;
      swayOffset: number;
      isFourLeaf: boolean;

      constructor(isInitial = false) {
        this.x = Math.random() * width;
        this.y = isInitial ? Math.random() * height : -20 - Math.random() * 50;
        this.size = Math.random() * 12 + 6; // 6px to 18px
        this.speedY = Math.random() * 1.2 + 0.6; // gentle fall
        this.speedX = Math.random() * 0.4 - 0.2;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        this.opacity = Math.random() * 0.45 + 0.15; // translucent
        this.swayAmount = Math.random() * 1.5 + 0.5;
        this.swaySpeed = Math.random() * 0.02 + 0.005;
        this.swayOffset = Math.random() * Math.PI * 2;
        // Most are 4-leaf clovers, some are 3-leaf
        this.isFourLeaf = Math.random() > 0.15;
      }

      update() {
        this.y += this.speedY;
        this.swayOffset += this.swaySpeed;
        this.x += this.speedX + Math.sin(this.swayOffset) * this.swayAmount * 0.3;
        this.rotation += this.rotationSpeed;

        // Reset if offscreen
        if (this.y > height + 20 || this.x < -20 || this.x > width + 20) {
          this.x = Math.random() * width;
          this.y = -20;
          this.opacity = Math.random() * 0.45 + 0.15;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.globalAlpha = this.opacity;

        // Draw clover leaves
        const leavesCount = this.isFourLeaf ? 4 : 3;
        const leafColor = '#42b883'; // clover green
        const shadowColor = '#1e5f39';

        c.fillStyle = leafColor;
        c.strokeStyle = shadowColor;
        c.lineWidth = 0.5;

        // Draw individual leaves (little heart-like structures or circles)
        for (let i = 0; i < leavesCount; i++) {
          c.rotate((Math.PI * 2) / leavesCount);
          
          c.beginPath();
          // Draw standard left-right leaf loops
          c.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
          c.arc(this.size * 0.3, -this.size * 0.3, this.size * 0.3, 0, Math.PI * 2);
          
          // Stem connection
          c.lineTo(0, 0);
          c.fill();
          c.stroke();
        }

        // Draw a tiny stem
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(
          this.size * 0.2,
          this.size * 0.6,
          this.size * 0.1,
          this.size * 0.9
        );
        c.strokeStyle = shadowColor;
        c.lineWidth = this.size * 0.1;
        c.stroke();

        c.restore();
      }
    }

    // Initialize particles
    const particleCount = Math.min(40, Math.floor((width * height) / 25000));
    const particles: CloverParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new CloverParticle(true));
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
      style={{ mixBlendMode: 'normal' }}
    />
  );
}
