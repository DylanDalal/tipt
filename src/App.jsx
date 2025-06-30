// /src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";

const arcFor = w => {
  const yStart = Math.round(
    40 - Math.min(1000, Math.max(0, 1400 - w)) * 0.02          // 0.02 = 20 / 1000
  );

  const t       = Math.min(1, Math.max(0, (1400 - w) / 1000)); // 0..1
  const scalar  = 1 - 0.65 * t;                                // 1 → 0.45
  const cpY     = yStart - yStart * scalar;                    // peak height

  const end    = w < 700 ? { x: 84.5, y: 21.5 } : { x: 76, y: 25 };

  return `M0,${yStart} Q50,${cpY} ${end.x},${end.y}`;
};


export default function App() {
  const [ready, setReady] = useState(false);
  const [pathD, setPathD] = useState(() => arcFor(window.innerWidth));


  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  useEffect(() => {
    const onResize = () => setPathD(arcFor(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="hero">
      <div className="arc-layer">
      <svg className="arc" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={pathD} className="arc-path" />
      </svg>
      </div>
      <div className="plane-container">
        <img className="plane" src="/plane.png" alt="" aria-hidden />
      </div>
    <img
      className={`logo ${ready ? "in" : ""}`}
      src="/tipt_logo.svg"
      alt="TIPT logo"
    />
    <p className={`tagline ${ready ? "show" : ""}`}>
        Get&nbsp;Tipped.&nbsp;Finally.&nbsp;Launching&nbsp;Soon.
      </p>
      <div style={{height: '28vh'}}>
      </div>
    </div>
  );
}
