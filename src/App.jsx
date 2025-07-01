import { useEffect, useState, useRef } from "react";
import "./App.css";
import Signup from "./Signup.jsx";

const getArcData = (w) => {
  const yStart = Math.round(
    37 - Math.min(1000, Math.max(0, 1400 - w)) * 0.02           // 0.02 = 20 / 1000
  );

  const t      = Math.min(1, Math.max(0, (1400 - w) / 1000));   // 0‥1
  const scalar = 1.1 - 0.59 * t;                                // 1 → 0.45
  const cpY    = yStart - yStart * scalar;                      // peak height

  const end    = w < 700 ? { x: 76, y: 16.5 } : { x: 76, y: 25 };

  return {
    path: `M0,${yStart} Q50,${cpY} ${end.x},${end.y}`,          // ← back-ticks!
    endpoint: end,
    rotation: w < 700 ? 25 : w < 1100 ? 35 : 30
  };
};

export default function App() {
  const [ready, setReady]   = useState(false);
  const [arcData, setArc]   = useState(() => getArcData(window.innerWidth));
  const [planePos, setPos]  = useState({ x: 0, y: 0 });
  const svgRef              = useRef(null);

  /** place the plane */
  const updatePlane = () => {
    if (!svgRef.current) return;

    const rect     = svgRef.current.getBoundingClientRect();
    const scaleX   = rect.width  / 100;
    const scaleY   = rect.height / 100;
    const baseX    = rect.left + arcData.endpoint.x * scaleX;
    const baseY    = rect.top  + arcData.endpoint.y * scaleY;

    const wPx      = Math.max(80, Math.min(window.innerWidth * 0.09, 600)); // clamp(80px, 9vw, 600px)
    const rad      = (arcData.rotation * Math.PI) / 180;

    // move 60 % forward along the heading, plus 30 % of height downward
    const dx       = Math.cos(rad) * wPx * 0.65;
    const dy       = Math.sin(rad) * wPx * 0.5;

    setPos({ x: baseX + dx, y: baseY + dy });
  };

  /* one-time entrance animation */
  useEffect(() => { requestAnimationFrame(() => setReady(true)); }, []);

  /* recompute arc + plane on resize */
  useEffect(() => {
    const onResize = () => { setArc(getArcData(window.innerWidth)); updatePlane(); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* track SVG size changes (flex layout, etc.) */
  useEffect(() => {
    updatePlane();
    const ro = new ResizeObserver(updatePlane);
    svgRef.current && ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [arcData]);

  return (
    <>
      <div className="hero">
      <div className="arc-layer">
        <svg
          ref={svgRef}
          className="arc"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d={arcData.path} className="arc-path" />
        </svg>
      </div>

      <div
        className="plane-container"
        style={{
          left: `${planePos.x}px`,
          top:  `${planePos.y}px`,
          transform: `translate(-50%, -50%) rotate(${arcData.rotation}deg)`
        }}
      >
        <img className="plane" src="/plane.png" alt="" aria-hidden />
      </div>
      <div className="logo-container">
        <img
          className={`logo ${ready ? "in" : ""}`}
          src="/tipt_logo.svg"
          alt="TIPT logo"
        />
        <p className={`tagline ${ready ? "show" : ""}`}>
          Get&nbsp;Tipped.&nbsp;Finally.&nbsp;Launching&nbsp;Soon.
        </p>
      </div>
    </div>
      <Signup />
    </>
  );
}
