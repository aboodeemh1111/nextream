export default function AnimatedBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      <div className="bg-layer" />
      <div className="bg-layer bg-layer--alt" />
      <div className="mask-layer" />

      <style jsx>{`
        .bg-layer {
          position: absolute;
          inset: -25%;
          width: 150%;
          height: 150%;
          background:
            radial-gradient(35% 35% at 20% 25%, rgba(244, 63, 94, 0.35), rgba(244, 63, 94, 0) 60%),
            radial-gradient(40% 40% at 80% 30%, rgba(168, 85, 247, 0.30), rgba(168, 85, 247, 0) 60%),
            radial-gradient(45% 45% at 50% 80%, rgba(34, 211, 238, 0.25), rgba(34, 211, 238, 0) 60%);
          filter: blur(50px);
          will-change: transform;
          animation: nb-rotate 60s linear infinite;
          transform-origin: 50% 50%;
          opacity: 0.55;
        }

        .bg-layer--alt {
          animation-duration: 90s;
          animation-direction: reverse;
          opacity: 0.45;
        }

        .mask-layer {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.85));
          pointer-events: none;
        }

        @keyframes nb-rotate {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-layer, .bg-layer--alt { animation: none; }
        }
      `}</style>
    </div>
  );
}


