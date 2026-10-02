"use client";
const players=["Marcus T.","Jordan P.","Reuel A.","Ayo P.","Player","Khalil D.","Tyrese W.","Daniel K.","Manny C.","Jay S."];
export default function PlayerList({live=false}:{live?:boolean}){
 return <div className="card section"><div className="row"><div className="title">{live?"Who's on the run":"Players on this run"}</div><span className="badge">{players.length} booked</span></div>
 <div className="list section">{players.map((p,i)=><div key={i} className="row"><div className="row" style={{justifyContent:"flex-start"}}><div className="profileIcon">{p==="Player"?"P":p.split(" ").map(x=>x[0]).join("")}</div><span>{p}</span></div><span className="muted">Booked</span></div>)}</div></div>
}