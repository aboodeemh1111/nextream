"use client";

import { useEffect, useRef } from "react";

interface FuturisticAdminBackgroundProps {
  className?: string;
}

const FuturisticAdminBackground: React.FC<FuturisticAdminBackgroundProps> = ({
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas to full screen
    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    // Create grid points
    class GridPoint {
      x: number;
      y: number;
      baseY: number;
      speed: number;
      size: number;
      color: string;

      constructor(x: number, y: number) {
        this.x = x;
        this.baseY = y;
        this.y = y;
        this.speed = 0.05 + Math.random() * 0.1;
        this.size = 1 + Math.random();

        // Professional dark blue scheme for admin
        const colors = [
          "rgba(30, 64, 175, 0.7)", // dark blue
          "rgba(20, 184, 166, 0.7)", // teal
          "rgba(79, 70, 229, 0.7)", // indigo
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update(time: number) {
        // Create a slight wave effect
        this.y = this.baseY + Math.sin(time * this.speed) * 5;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    // Create data visualization lines
    class DataLine {
      startX: number = 0;
      startY: number = 0;
      endX: number = 0;
      endY: number = 0;
      progress: number = 0;
      speed: number = 0.3;
      color: string = "rgba(59, 130, 246, 0.6)";
      maxLength: number = 0.5;

      constructor() {
        if (!canvas) return;
        // Start from a point on the left edge
        this.startX = 0;
        this.startY = Math.random() * canvas.height;

        // Set end point somewhere on the right side
        this.endX = canvas.width;
        this.endY = Math.random() * canvas.height;

        this.progress = 0;
        this.speed = 0.2 + Math.random() * 0.5;
        this.maxLength = 0.4 + Math.random() * 0.4; // Max progress before fading out

        const colors = [
          "rgba(59, 130, 246, 0.6)", // blue
          "rgba(16, 185, 129, 0.6)", // green
          "rgba(99, 102, 241, 0.6)", // indigo
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.progress += 0.005 * this.speed;

        if (this.progress > 1) {
          if (!canvas) return;
          // Reset line with new parameters
          this.startX = 0;
          this.startY = Math.random() * canvas.height;
          this.endX = canvas.width;
          this.endY = Math.random() * canvas.height;
          this.progress = 0;
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        const currentEndX =
          this.startX +
          (this.endX - this.startX) * Math.min(this.progress, this.maxLength);
        const currentEndY =
          this.startY +
          (this.endY - this.startY) * Math.min(this.progress, this.maxLength);

        // Calculate start point if we've moved past maxLength
        let startX = this.startX;
        let startY = this.startY;

        if (this.progress > this.maxLength) {
          const excessProgress =
            (this.progress - this.maxLength) / (1 - this.maxLength);
          startX = this.startX + (this.endX - this.startX) * excessProgress;
          startY = this.startY + (this.endY - this.startY) * excessProgress;
        }

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(currentEndX, currentEndY);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw data packet circles along the line
        const packetProgress = (this.progress % 0.2) / 0.2;
        const packetX = startX + (currentEndX - startX) * packetProgress;
        const packetY = startY + (currentEndY - startY) * packetProgress;

        ctx.beginPath();
        ctx.arc(packetX, packetY, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    // Create grid points
    const gridSize = 30;
    const gridPoints: GridPoint[] = [];

    for (let x = 0; x < canvas.width; x += gridSize) {
      for (let y = 0; y < canvas.height; y += gridSize) {
        if (Math.random() > 0.8) {
          // Only create some points, not all
          gridPoints.push(new GridPoint(x, y));
        }
      }
    }

    // Create data flow lines
    const dataLines: DataLine[] = [];
    const numLines = 15; // Number of animated data lines

    for (let i = 0; i < numLines; i++) {
      dataLines.push(new DataLine());
    }

    // Animation loop
    let animationTime = 0;
    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create a gradient background
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );
      gradient.addColorStop(0, "rgba(15, 23, 42, 1)"); // slate-900
      gradient.addColorStop(1, "rgba(30, 41, 59, 1)"); // slate-800

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw elements
      animationTime += 0.01;

      // Draw the grid points
      gridPoints.forEach((point) => {
        point.update(animationTime);
        point.draw(ctx);
      });

      // Draw moving data lines
      dataLines.forEach((line) => {
        line.update();
        line.draw(ctx);
      });

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className={`absolute inset-0 z-0 ${className}`} />
  );
};

export default FuturisticAdminBackground;
