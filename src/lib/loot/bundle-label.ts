export function bundleLabel(items:{name:string;quantity:number}[]):string {
  if(Array.from({length:7},(_,index)=>`a dance in fire, v${index+1}`).every(name=>items.some(item=>item.name.toLowerCase()===name)))return "A Dance in Fire — complete set";
  const label=items.slice(0,3).map(item=>`${item.quantity} × ${item.name}`).join(" + ")+(items.length>3?` + ${items.length-3} more`:"");
  return label.length>120?label.slice(0,117)+"…":label||"Reward set";
}
