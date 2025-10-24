import React, { useEffect, useState } from "react";
export default function ReadyScreen({ prompt, seconds, onStart }: { prompt: string; seconds: number; onStart: ()=>void }){
  const [t, setT] = useState(seconds)
  useEffect(()=>{ const id = setInterval(()=> setT(x=> x>0? x-1:0), 1000); return ()=> clearInterval(id) },[])
  useEffect(()=>{ if (t===0) onStart() }, [t])
  return (
    <div className="card" style={{ textAlign:"center" }}>
      <div style={{ fontSize: 18, marginBottom: 8 }}>පළමුව මෙය කියවන්න</div>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{prompt}</div>
      <div style={{ fontSize: 16, opacity: 0.8 }}>ආරම්භයට {t} s</div>
    </div>
  )
}
