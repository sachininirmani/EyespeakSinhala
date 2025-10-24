import React from "react";
export default function DwellSliders({ main, popup, setMain, setPopup }: { main: number; popup: number; setMain: (v:number)=>void; setPopup:(v:number)=>void }){
  return (
    <div className="card" style={{ display: "flex", gap: 16 }}>
      <div><div className="label">Main dwell (ms)</div><input type="range" min={250} max={1200} step={25} value={main} onChange={e=>setMain(parseInt(e.target.value))} /><div>{main} ms</div></div>
      <div><div className="label">Vowel popup dwell (ms)</div><input type="range" min={200} max={1000} step={25} value={popup} onChange={e=>setPopup(parseInt(e.target.value))} /><div>{popup} ms</div></div>
    </div>
  )
}
