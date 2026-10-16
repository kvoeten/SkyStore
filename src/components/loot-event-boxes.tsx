"use client";
import {useState} from "react";
import {formatGold} from "@/lib/money";
import type {LootDashboard} from "@/lib/loot/service";
type Admin=Extract<LootDashboard,{manage:true}>;
export function LootEventBoxes({event,assignments,customerName}:{event:Admin['events'][number];assignments:Admin['assignments'];customerName:(id:string|null)=>string}){
 const [filter,setFilter]=useState("available");
 const boxes=event.plan?.boxes??[];
 const assigned=assignments.filter(box=>box.eventId===event.id);
 const available=boxes.filter(box=>!assigned.find(row=>row.boxNumber===box.id)?.userId);
 const shown=filter==="available"?available:boxes;
 const contents=new Map<string,{name:string;quantity:number}>();
 for(const box of available)for(const line of box.lines){const prior=contents.get(line.key);contents.set(line.key,{name:line.name,quantity:(prior?.quantity??0)+line.quantity});}
 return <><div className="panel-head"><h3>Boxes & contents</h3><label className="field"><span>Show boxes</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="available">Available ({available.length})</option><option value="all">All ({boxes.length})</option></select></label></div>
 {!event.plan?<p className="loot-alert">This draft needs repacking after stock or price changes. Choose Edit / Repack to generate its box list again.</p>:!shown.length?<p className="empty">No available boxes remain.</p>:<div className="table-wrap"><table><thead><tr><th>Box</th><th>Price / value</th><th>Assigned to</th><th>Contents</th></tr></thead><tbody>{shown.map(box=>{const record=assigned.find(row=>row.boxNumber===box.id);return <tr key={box.id}><td>#{box.id} · {box.tier}</td><td>{formatGold(box.sale)}<small>Contents {formatGold(box.value)}</small></td><td>{record?.userId?customerName(record.userId):"Available"}{record?.openedAt&&<small>Opened</small>}</td><td><details><summary>{box.mainLabel??(box.mainLines.map(line=>line.name).join(", ")||"Other rewards")} · {box.lines.reduce((n,line)=>n+line.quantity,0)} items</summary><ul>{box.lines.map(line=><li key={line.key}>{line.quantity} × {line.name}</li>)}</ul></details></td></tr>;})}</tbody></table></div>}
 <details className="card loot-handover"><summary>Remaining box contents · {available.length} available boxes</summary>{contents.size?<ul>{[...contents.values()].sort((a,b)=>a.name.localeCompare(b.name)).map((line,index)=><li key={index}>{line.quantity} × {line.name}</li>)}</ul>:<p>No contents in the available pool.</p>}</details>
 {!!event.plan?.unallocated?.length&&<details className="card loot-handover"><summary>Unpacked stock · not included in boxes</summary><ul>{event.plan.unallocated.map(line=><li key={line.key}>{line.quantity} × {line.name}</li>)}</ul></details>}
 </>;
}
