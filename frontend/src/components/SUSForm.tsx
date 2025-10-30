import React, { useState } from "react";
const items = [
    "මම මෙම පද්ධතිය නිතර භාවිතා කිරීමට කැමතියි.",
    "මෙම පද්ධතිය අවශ්‍ය නොවන ලෙස සංකීර්ණ බවක් දක්වයි.",
    "මෙම පද්ධතිය භාවිතා කිරීමට ඉතා පහසුය.",
    "මෙම පද්ධතිය භාවිතා කිරීමට තවත් කෙනෙකුගේ සහය අවශ්‍ය බව මට හැඟෙයි.",
    "මෙම පද්ධතියේ විවිධ කාර්යයන් හොඳින් ඒකාබද්ධ කර ඇත.",
    "මෙම පද්ධතියේ ක්‍රියාකාරීත්වයන් අතර විරෝධාත්මකතා තිබේ.",
    "බොහෝ අය මෙම පද්ධතිය ඉක්මනින් ඉගෙන ගනු ඇත.",
    "මෙම පද්ධතිය භාවිතා කිරීම අසීරුය.",
    "මෙම පද්ධතිය භාවිතා කිරීමේදී මට විශ්වාසයක් ඇතිවේ.",
    "මෙම පද්ධතිය භාවිතා කිරීමට පෙර මට ඉතා වැඩි පුහුණුවක් අවශ්‍ය වේ."
];
export default function SUSForm({ onSubmit }: { onSubmit: (values:number[])=>void }){
  const [vals, setVals] = useState<number[]>(Array(10).fill(3))
  return (
    <div className="card">
      <div className="label">SUS (1-5)</div>
        <h3 style={{ marginBottom: 16, textAlign: "center" }}>
            පද්ධතිය භාවිතා කිරීමේ අත්දැකීම (System Usability Scale)
        </h3>
        <p style={{ textAlign: "center", marginBottom: 24 }}>
            කරුණාකර සෑම ප්‍රශ්නයකටම ඔබේ අදහස 1 සිට 5 මඟින් තෝරන්න.<br />
            <strong>1 = එකග නොවෙමි – 5 =  එකග වෙමි</strong>
        </p>
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
