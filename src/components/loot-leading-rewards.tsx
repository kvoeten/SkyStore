"use client";
import { useState } from "react";
import type { PlannerItem } from "@/lib/loot/planner";
import type { LootCommand } from "@/lib/loot/commands";
import { formatGold } from "@/lib/money";

type Bundle={id:string;name:string;enabled:boolean;lines:{key:string;quantity:number}[]};
export function LootLeadingRewards({items,bundles,busy,save}:{items:PlannerItem[];bundles:Bundle[];busy:boolean;save:(command:LootCommand,success?:string)=>Promise<unknown>}){
  const [id,setId]=useState<string|undefined>(),[enabled,setEnabled]=useState(true);
  const [lines,setLines]=useState([{key:"",quantity:1}]);
  const available=items.filter(item=>!item.excluded);
  const bookSet=Array.from({length:7},(_,k)=>available.find(item=>item.name.toLowerCase()===`a dance in fire, v${k+1}`));
  const reset=()=>{setId(undefined);setEnabled(true);setLines([{key:"",quantity:1}]);};
  return <section className="panel"><div className="panel-head"><h2>Leading rewards</h2><span>Reusable reward bundles</span></div>
    <p className="fine">Define combinations that count as one lead. Every component stays together. Individual books never lead; A Dance in Fire needs all seven volumes. For other book sets, include every volume in your definition. Individual non-book leaders can still be marked in Event storage.</p>
    <div className="table-wrap"><table><thead><tr><th>Reward</th><th>Contents</th><th>Combined value</th><th>Available sets</th><th>Enabled</th><th>Actions</th></tr></thead><tbody>{bundles.map(bundle=>{
      const entries=bundle.lines.map(line=>({line,item:items.find(item=>item.key===line.key)}));
      const copies=Math.min(...entries.map(({line,item})=>Math.floor((item&&!item.excluded?item.quantity:0)/line.quantity)));
      const priced=entries.every(({item})=>item?.unitValue!=null);
      return <tr key={bundle.id}><td><b>{bundle.name}</b></td><td>{entries.map(({line,item})=><small key={line.key}>{line.quantity} × {item?.name??"Item not in current stock"}</small>)}</td><td>{priced?formatGold(entries.reduce((sum,{line,item})=>sum+line.quantity*item!.unitValue!,0)):"Unknown"}</td><td>{copies}</td><td>{bundle.enabled?"Yes":"No"}</td><td><div className="button-row"><button className="outline" disabled={busy} onClick={()=>{setId(bundle.id);setEnabled(bundle.enabled);setLines(bundle.lines.map(line=>({...line})));}}>Edit</button><button className="outline" disabled={busy} onClick={()=>{if(confirm(`Remove the leading reward “${bundle.name}”? Distributed boxes will not change.`))void save({action:"deleteBundle",id:bundle.id},"Leading reward removed. Repack draft events.");}}>Remove</button></div></td></tr>;
    })}</tbody></table></div>{!bundles.length&&<p className="empty">No bundles yet. Build a complete book set, armor set, potion pair, or another combination below.</p>}
    <h3>{id?"Edit leading reward":"Build a leading reward"}</h3>{bookSet.every(Boolean)&&<button type="button" className="outline" disabled={busy} onClick={()=>{reset();setLines(bookSet.map(item=>({key:item!.key,quantity:1})));}}>Fill in A Dance in Fire set</button>}<form onSubmit={async event=>{event.preventDefault();const result=await save({action:"bundle",id,enabled,lines},"Leading reward saved. Repack draft events to use it.");if(result)reset();}}>
      {lines.map((line,index)=><div className="loot-bundle-line" key={index}><label className="field"><span>Item {index+1}</span><select required value={line.key} disabled={busy} onChange={event=>setLines(lines.map((row,k)=>k===index?{...row,key:event.target.value}:row))}><option value="">Choose event item</option>{line.key&&!available.some(item=>item.key===line.key)&&<option value={line.key}>Item not in current stock</option>}{available.map(item=><option value={item.key} key={item.key}>{item.name} · {item.quantity} available</option>)}</select></label><label className="field"><span>Quantity {index+1}</span><input type="number" required min="1" max="1000" step="1" disabled={busy} value={line.quantity} onChange={event=>setLines(lines.map((row,k)=>k===index?{...row,quantity:Number(event.target.value)}:row))}/></label><button type="button" className="outline" disabled={busy||lines.length===1} onClick={()=>setLines(lines.filter((_,k)=>k!==index))}>Remove item {index+1}</button></div>)}
      <div className="button-row"><button type="button" className="outline" disabled={busy||lines.length>=50} onClick={()=>setLines([...lines,{key:"",quantity:1}])}>Add component</button><label><input type="checkbox" checked={enabled} disabled={busy} onChange={event=>setEnabled(event.target.checked)}/> Enabled for generation</label><button className="button" disabled={busy}>{busy?"Saving…":"Save leading reward"}</button>{id&&<button type="button" className="outline" disabled={busy} onClick={reset}>Cancel edit</button>}</div>
    </form>
  </section>;
}
