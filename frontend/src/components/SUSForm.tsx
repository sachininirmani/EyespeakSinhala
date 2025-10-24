import React, { useState } from "react";
const items = [
  "මට මෙම පද්ධතිය නිතර භාවිතා කිරීමට කැමතියි.",
  "මෙම පද්ධතිය අතිශයින් සංකීර්ණය.",
  "මෙම පද්ධතිය භාවිතා කිරීමට පහසුය.",
  "මෙම පද්ධතිය භාවිතය සඳහා තනි පුද්ගලයාගේ සහය අවශ්‍ය වේ.",
  "මෙම පද්ධතියේ විවිධ කාර්යයන් හොඳින් ඒකාබද්ධ කර ඇත.",
  "මෙම පද්ධතියේ අසමානු සංඛ්‍යාවක් ඇත.",
  "මම හිතන්නේ බොහෝ අය මෙම පද්ධතිය ඉක්මනින් ඉගෙන ගනු ඇත.",
  "මෙම පද්ධතිය භාවිතා කිරීමට ඉතා අපහසුය.",
  "මෙම පද්ධතිය භාවිතා කිරීමේදී මට විශ්වාසයක් ඇත.",
  "මෙම පද්ධතිය ඉතා පිරික්සුම් අවශ්‍ය කරයි."
]
export default function SUSForm({ onSubmit }: { onSubmit: (values:number[])=>void }){
  const [vals, setVals] = useState<number[]>(Array(10).fill(3))
  return (
    <div className="card">
      <div className="label">SUS (1-5)</div>
      {items.map((q, i)=> (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <div style={{ flex: 1 }}>{i+1}. {q}</div>
          <select value={vals[i]} onChange={e=>{ const v = parseInt(e.target.value); const n=[...vals]; n[i]=v; setVals(n) }}>
            {[1,2,3,4,5].map(v=> <option value={v} key={v}>{v}</option>)}
          </select>
        </div>
      ))}
      <button className="btn primary" onClick={()=> onSubmit(vals)}>Submit SUS</button>
    </div>
  )
}
