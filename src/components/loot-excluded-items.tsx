"use client";
import { useState } from "react";
import type { PlannerItem } from "@/lib/loot/planner";
import type { LootCommand } from "@/lib/loot/commands";
import { formatGold } from "@/lib/money";

export function LootExcludedItems({items,busy,save}:{items:PlannerItem[];busy:boolean;save:(command:LootCommand,success?:string)=>Promise<unknown>}) {
  const [search,setSearch]=useState("");
  const reserved=items.filter(item=>item.excluded&&item.reviewed);
  const unidentified=items.filter(item=>!item.reviewed);
  const eligible=items.filter(item=>!item.excluded&&item.name.toLowerCase().includes(search.toLowerCase()));
  function table(rows:PlannerItem[],excluded:boolean) {
    return <div className="table-wrap"><table><thead><tr><th>Item</th><th>Available</th><th>Unit value</th><th>Action</th></tr></thead><tbody>{rows.map(item=><tr key={item.key}><td><b>{item.name}</b>{item.leading&&<small>Marked as a leading reward</small>}</td><td>{item.quantity}</td><td>{item.unitValue==null?"Unpriced":formatGold(item.unitValue)}</td><td><button className="outline" disabled={busy} aria-label={`${excluded?"Return to boxes":"Set aside"}: ${item.name}`} onClick={()=>void save({action:"exclude",key:item.key,excluded:!excluded},excluded?"Item returned to boxes. Repack draft plans.":"Item set aside. Repack draft plans to remove it from boxes.")}>{excluded?"Return to boxes":"Set aside"}</button></td></tr>)}</tbody></table></div>;
  }
  return <section className="panel"><div className="panel-head"><h2>Excluded items</h2><span>{reserved.reduce((sum,item)=>sum+item.quantity,0)} items set aside</span></div>
    <p className="fine">Keep lottery prizes out of every box, including leading rewards. All available copies of an excluded item stay in event storage. Prices and leading-reward selections are preserved. Already distributed boxes do not change.</p>
    <h3>Set aside for the lottery</h3>{reserved.length?table(reserved,true):<p className="empty">No items set aside yet.</p>}
    <h3>Choose items to exclude</h3><label className="field"><span>Search event items</span><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Dwarven, staff…"/></label>
    {eligible.length?table(eligible,false):<p className="empty">No matching available items.</p>}
    {!!unidentified.length&&<p className="fine">{unidentified.length} unidentified entries are also excluded automatically. Identify them in Event storage before including them.</p>}
  </section>;
}
