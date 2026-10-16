export const defaultSettings={count:100,margin:.20,general:120,premium:150,exclusive:200,winPercent:25,winValuePercent:130};
const sum=(xs,f)=>xs.reduce((a,x)=>a+f(x),0);
const goodPotion=i=>i.role==='Potion'&&!/minor|ice wraith essence/i.test(i.name)&&i.value>=20;
const gear=i=>['Armor','Weapon'].includes(i.role);
const fillerOnly=i=>i.role==='Joke'||(i.role==='Potion'&&/minor|ice wraith essence/i.test(i.name));
export function generateAll(items,settings=defaultSettings,seed=42){
 const s={...defaultSettings,...settings},stock=items.filter(i=>i.container==='EVENT STORAGE');
 if(!Number.isInteger(s.count)||s.count<1||s.count>1000)throw Error('Boxes wanted must be a whole number from 1 to 1,000.');
 if(!(s.margin>=0&&s.margin<1))throw Error('Profit target must be from 0% to below 100%.');
 const minimumPotions=s.minimumPotions??0;
 if(!Number.isInteger(minimumPotions)||minimumPotions<0||minimumPotions>10)throw Error('Minimum potions must be a whole number from 0 to 10.');
 if(!Number.isFinite(s.winPercent)||s.winPercent<0||s.winPercent>100||!Number.isFinite(s.winValuePercent)||s.winValuePercent<101||s.winValuePercent>300)throw Error('Winning odds must be 0–100%, and winning contents 101–300% of the box price.');
 if(s.boxTypes){
  if(!Array.isArray(s.boxTypes)||!s.boxTypes.length||s.boxTypes.length>3||new Set(s.boxTypes.map(row=>row.tier)).size!==s.boxTypes.length||s.boxTypes.some(row=>!['General','Premium','Exclusive'].includes(row.tier)||!Number.isInteger(row.count)||row.count<1||!Number.isInteger(row.price)||row.price<1))throw Error('Choose distinct box types with whole positive quantities and prices.');
  s.count=sum(s.boxTypes,row=>row.count);if(s.count>1000)throw Error('Use at most 1,000 boxes.');
 }else if(![s.general,s.premium,s.exclusive].every(x=>Number.isFinite(x)&&x>0)||s.general>s.premium||s.premium>s.exclusive)throw Error('Use positive selling prices, ordered General ≤ Premium ≤ Exclusive.');
 for(const i of stock)if(!Number.isInteger(i.quantity)||i.quantity<0||(i.value!==null&&(!Number.isFinite(i.value)||i.value<0)))throw Error(`Check quantity and price: ${i.name}`);
 const missing=stock.filter(i=>i.quantity>0&&i.value===null),units=stock.flatMap(i=>Array.from({length:i.quantity},()=>i)),knownValue=sum(units,i=>i.value||0);
 if(missing.length)return {boxes:[],settings:s,units:units.length,knownValue,missingRows:missing.length,missingUnits:sum(missing,i=>i.quantity),blocked:'pricing',warnings:[`${missing.length} prices needed`]};
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const pool=units.slice(),bins=[],special=[],warnings=[];
 const take=i=>{const p=pool.indexOf(i);if(p<0)throw Error('Allocation exhausted stock');pool.splice(p,1);return i;};
 const make=(tier,sale,anchors,label)=>({tier,sale,units:anchors.slice(),anchors:anchors.slice(),mainLabel:label||null,value:sum(anchors,i=>i.value),materials:0});
 const chooseLead=()=>{
  for(const bundle of s.leaderBundles??[]){
   const anchors=[];let complete=true;
   for(const line of bundle.lines){const found=pool.filter(i=>i.key===line.key&&!anchors.includes(i)).slice(0,line.quantity);if(found.length!==line.quantity){complete=false;break;}anchors.push(...found);}
   if(complete&&anchors.length){return {anchors:anchors.map(take),label:bundle.name,bundleId:bundle.id};}
  }
  const volumes=Array.from({length:7},(_,k)=>pool.find(i=>i.leading&&new RegExp('^A Dance in Fire, v'+(k+1)+'$','i').test(i.name)));
  if(volumes.every(Boolean))return {anchors:volumes.map(take),label:'A Dance in Fire — complete set (volumes 1–7)',bundleId:null};
  const leader=pool.filter(i=>i.leading&&i.role!=='Book').sort((a,b)=>b.value-a.value)[0];
  return leader?{anchors:[take(leader)],label:null,bundleId:null}:null;
 };
 if(s.boxTypes){
  const slots=s.boxTypes.flatMap(row=>Array.from({length:row.count},()=>({tier:row.tier,sale:row.price}))).sort((a,b)=>b.sale-a.sale);
  const volumes=Array.from({length:7},(_,k)=>pool.find(i=>new RegExp('^A Dance in Fire, v'+(k+1)+'$','i').test(i.name)));
  for(const slot of slots){
   let anchors=[],label=null,bundleId=null;
   if(s.leadersOnly){const lead=chooseLead();if(lead){anchors=lead.anchors;label=lead.label;bundleId=lead.bundleId;}}
   else if(!bins.length&&volumes.every(Boolean)){anchors=volumes.map(take);label='A Dance in Fire — complete set (volumes 1–7)';}
   else {
    const reward=pool.filter(i=>gear(i)||['Clothing','Jewellery'].includes(i.role)).sort((a,b)=>b.value-a.value)[0];
    if(reward)anchors=[take(reward)];
    else {const potions=pool.filter(goodPotion).sort((a,b)=>b.value-a.value);if(potions.length>=2)anchors=potions.slice(0,2).map(take);}
   }
   if(!anchors.length)label='No approved lead — other rewards only';
   const bin=make(slot.tier,slot.sale,anchors,label);bin.leaderBundleId=bundleId;bins.push(bin);
  }
 }else{
 for(const i of pool.slice())if(i.role!=='Book'&&!fillerOnly(i)&&i.value>s.exclusive*1.15){const b=make('Special',Math.ceil(i.value/(1-s.margin)/10)*10,[take(i)]);b.special=true;special.push(b);}
 const volumes=Array.from({length:7},(_,k)=>pool.find(i=>new RegExp('^A Dance in Fire, v'+(k+1)+'$','i').test(i.name)));
 if(volumes.every(Boolean))bins.push(make('Premium',s.premium,volumes.map(take),'A Dance in Fire — complete set (volumes 1–7)'));
 for(const i of pool.slice().sort((a,b)=>b.value-a.value)){
  if(gear(i))bins.push(make('Premium',s.premium,[take(i)]));
  else if(i.role!=='Book'&&i.value>s.general*1.15&&!fillerOnly(i))bins.push(make('Exclusive',s.exclusive,[take(i)]));
 }
 const normalValue=knownValue-sum(special,b=>b.value),fixedSales=sum(bins,b=>b.sale);
 const needed=Math.max(0,Math.ceil((normalValue/(1-s.margin)-fixedSales)/s.general-1e-9));
 const maxFair=Math.max(0,Math.floor((normalValue/.7-fixedSales)/s.general));
 let ng=Math.max(needed,Math.min(maxFair,s.count-bins.length-special.length));
 const ordinary=pool.filter(i=>['Clothing','Jewellery'].includes(i.role)).sort((a,b)=>b.value-a.value);
 const potions=pool.filter(goodPotion).sort((a,b)=>b.value-a.value);
 const capacity=ordinary.length+Math.floor(potions.length/2);
 if(ng>capacity){warnings.push(`Only ${capacity+bins.length+special.length} boxes have a suitable main reward; add equipment or non-minor potions for more.`);ng=capacity;}
 const potionBoxes=Math.min(Math.floor(potions.length/2),ng);
 for(let k=0;k<potionBoxes;k++){const a=take(potions[k*2]),b=take(potions[k*2+1]);bins.push(make('General',s.general,[a,b]));}
 for(let k=0;k<ng-potionBoxes;k++)bins.push(make('General',s.general,[take(ordinary[k])]));
 }
 if(s.leadersOnly&&!s.boxTypes){
  // Re-select automatic-tier leaders from the explicit allowlist, not categories.
  for(const b of [...bins,...special]){pool.push(...b.anchors);b.anchors=[];b.units=[];b.value=0;b.mainLabel=null;}
  for(const b of [...bins,...special]){
   const lead=chooseLead();
   if(!lead){b.mainLabel='No approved lead — other rewards only';continue;}
   b.anchors=lead.anchors;b.mainLabel=lead.label;b.leaderBundleId=lead.bundleId;b.units=b.anchors.slice();b.value=sum(b.anchors,i=>i.value);
  }
 }
 if(!bins.length&&!special.length&&pool.length){for(let k=0;k<Math.min(s.count,units.length);k++)bins.push(make('General',s.general,[],'No approved lead — other rewards only'));}
 for(const b of [...bins,...special]){
  b.leadOnly=b.anchors.length>0&&sum(b.anchors,i=>i.value)>=b.sale*(1-s.margin)-1e-7;
  if(b.leadOnly){b.lockedCount=b.units.length;continue;}
  const present=b.units.filter(i=>i.role==='Potion').length,needed=Math.max(0,minimumPotions-present);
  const available=pool.filter(i=>i.role==='Potion');
  if(available.length<needed)return {boxes:[],settings:s,units:units.length,knownValue,missingRows:0,missingUnits:0,blocked:'potions',warnings:[`Not enough potions to put at least ${minimumPotions} in every box. Reduce the minimum or box count, or add potion stock.`]};
  for(const potion of available.slice(0,needed)){b.units.push(take(potion));b.value+=potion.value;}
  b.lockedCount=b.units.length;
 }
 for(const b of [...bins,...special])if(!b.units.length){
  const filler=pool[0];
  if(!filler)return {boxes:[],settings:s,units:units.length,knownValue,missingRows:0,missingUnits:0,blocked:'stock',warnings:['Not enough item units to fill every requested box. Reduce the box count or add stock.']};
  b.units.push(take(filler));b.value+=filler.value;b.lockedCount=b.units.length;
 }
 const missingLeads=[...bins,...special].filter(b=>!b.anchors.length).length;
 if(missingLeads)warnings.push(`${missingLeads} of ${bins.length+special.length} boxes have no approved leading reward and are filled with other items instead.`);
 const normalValue=knownValue-sum(special,b=>b.value);
 const sale=sum(bins,b=>b.sale),ratio=sale?normalValue/sale:0;
 bins.forEach(b=>b.target=Math.max(b.value,b.sale*ratio*(.96+rand()*.08)));
 if(s.winPercent>0){
  // Pick targets within each price tier; customer allocation remains uniform.
  for(const tier of ['General','Premium','Exclusive']){
   const group=bins.filter(b=>b.tier===tier);
   for(let k=group.length-1;k>0;k--){const j=Math.floor(rand()*(k+1));[group[k],group[j]]=[group[j],group[k]];}
   group.forEach((b,k)=>{b.winner=k<Math.round(group.length*s.winPercent/100);});
  }
  const desired=bins.map(b=>Math.max(0,(b.winner?b.sale*s.winValuePercent/100:b.sale*ratio)-b.value));
  const filler=normalValue-sum(bins,b=>b.value);
  const demand=sum(desired,v=>v);
  bins.forEach((b,k)=>{b.target=b.value+(demand?filler*desired[k]/demand:0);});
  // Fund winning targets first, then share the remainder among other boxes.
  const winningDemand=sum(bins,b=>b.winner?Math.max(0,b.sale*s.winValuePercent/100-b.value):0);
  if(winningDemand<=filler){
   const losingDemand=sum(bins,b=>!b.winner?Math.max(0,b.sale*ratio-b.value):0);
   bins.forEach(b=>{b.target=b.winner?Math.max(b.value,b.sale*s.winValuePercent/100):b.value+(losingDemand?(filler-winningDemand)*Math.max(0,b.sale*ratio-b.value)/losingDemand:0);});
  }
 }
 const nm=pool.filter(i=>i.role==='Material').length;
 const fillerBins=bins.filter(b=>!b.leadOnly);
 fillerBins.forEach((b,k)=>b.quota=Math.floor(nm/fillerBins.length)+(k<nm%fillerBins.length?1:0));
 const add=(b,i)=>{b.units.push(i);b.value+=i.value;if(i.role==='Material')b.materials++;};
 for(const i of pool.slice().sort((a,b)=>b.value-a.value)){
  if(!fillerBins.length)break;
  let candidates=fillerBins;if(i.role==='Material'&&!s.winPercent){const q=fillerBins.filter(b=>b.materials<b.quota);if(q.length)candidates=q;}
  const score=b=>s.winPercent>0?(b.value+i.value-b.target)/b.sale:Math.max(0,b.value+i.value-b.sale*1.15)*1000+(b.value+i.value-b.target)/b.sale;
  let best=candidates[0];for(const b of candidates)if(score(b)<score(best))best=b;add(best,i);
 }
 // Main rewards are locked. Optimisation only swaps or moves filler units.
 const energy=(b,v)=>Math.pow((v-b.target)/b.sale,2)+(s.winPercent>0?0:Math.pow(Math.max(0,b.sale*.7-v),2)*100+Math.pow(Math.max(0,v-b.sale*1.15),2)*100);
 for(let t=0;t<40000&&fillerBins.length>1;t++){
  const a=fillerBins[Math.floor(rand()*fillerBins.length)],b=fillerBins[Math.floor(rand()*fillerBins.length)];if(a===b)continue;
  const ai=a.lockedCount+Math.floor(rand()*(a.units.length-a.lockedCount)),bi=b.lockedCount+Math.floor(rand()*(b.units.length-b.lockedCount));
  const u=a.units[ai],v=b.units[bi];if(!u)continue;
  if(v&&u.role===v.role&&u.value!==v.value){const av=a.value-u.value+v.value,bv=b.value-v.value+u.value;if(energy(a,av)+energy(b,bv)<energy(a,a.value)+energy(b,b.value)-1e-8){a.units[ai]=v;b.units[bi]=u;a.value=av;b.value=bv;}}
  else if(u.role!=='Material'||s.winPercent>0){const av=a.value-u.value,bv=b.value+u.value;if(energy(a,av)+energy(b,bv)<energy(a,a.value)+energy(b,b.value)-1e-8){a.units.splice(ai,1);b.units.push(u);a.value=av;b.value=bv;}}
 }
 const group=us=>{const m=new Map();for(const i of us){if(!m.has(i.key))m.set(i.key,{...i,quantity:0});m.get(i.key).quantity++;}return [...m.values()];};
 const boxes=[...bins,...special].map(b=>({tier:b.tier,sale:b.sale,special:!!b.special,leadOnly:!!b.leadOnly,leaderBundleId:b.leaderBundleId??null,mainLabel:b.mainLabel,mainLines:group(b.anchors),lines:group(b.units),value:sum(b.units,i=>i.value),materials:b.units.filter(i=>i.role==='Material').length}));
 const unallocated=fillerBins.length?[]:group(pool);
 if(unallocated.length)warnings.push(`${sum(unallocated,i=>i.quantity)} item units remain in event storage because all boxes already have sufficient leading rewards.`);
 const rank={General:0,Premium:1,Exclusive:2,Special:3};boxes.sort((a,b)=>rank[a.tier]-rank[b.tier]);
 boxes.forEach((b,k)=>{b.id=String(k+1).padStart(3,'0');b.profit=b.sale-b.value;b.margin=b.profit/b.sale;b.status=s.winPercent>0?(b.value>b.sale+1e-7?'Above price':b.value<b.sale-1e-7?'Below price':'Break even'):b.value<b.sale*.7-1e-7?'Underfilled':b.value>b.sale*1.15+1e-7?'Over value':'Ready';});
 if(boxes.length!==s.count)warnings.push(`${boxes.length} boxes fit the prices and profit target; ${s.count} preferred.`);
 if(bins.length&&nm/bins.length<5)warnings.push(`${nm} materials across ${bins.length} standard boxes: fewer than 5 each.`);
 if(bins.length&&nm/bins.length>15)warnings.push(`${nm} materials across ${bins.length} standard boxes: more than 15 each to allocate all stock.`);
 if(s.winPercent>0&&boxes.some(b=>!b.special&&!b.leadOnly&&(b.materials<5||b.materials>15)))warnings.push('Winning-value distribution puts some boxes outside the usual 5–15 material count. Review their contents.');
 if(!s.winPercent&&boxes.some(b=>b.status!=='Ready'))warnings.push('Some boxes miss the 70–115% value range; review flagged rows.');
 const odds=['General','Premium','Exclusive','Special'].map(tier=>{const group=boxes.filter(b=>b.tier===tier),winners=group.filter(b=>b.value>b.sale+1e-7).length;return {tier,total:group.length,winners,percent:group.length?winners/group.length*100:0};}).filter(row=>row.total);
 if(s.winPercent>0&&odds.some(row=>row.tier!=='Special'&&row.winners!==Math.round(row.total*s.winPercent/100)))warnings.push('Available rewards prevent the requested winning odds. Use the actual odds below before distributing.');
 const allocatedValue=sum(boxes,b=>b.value),revenue=sum(boxes,b=>b.sale),profit=revenue-allocatedValue;
 if(revenue&&profit/revenue<s.margin-1e-9)warnings.push('Current stock and reward rules cannot meet the profit target.');
 const result={boxes,settings:s,odds,unallocated,stockValue:knownValue,units:sum(boxes,b=>sum(b.lines,i=>i.quantity)),knownValue:allocatedValue,missingRows:0,missingUnits:0,revenue,profit,margin:revenue?profit/revenue:0,warnings};validateAll(stock,result);return result;
}
export function validateAll(stock,plan){
 if(plan.blocked)return true;
 const used=new Map();for(const b of plan.boxes){
  if(!b.lines.length)throw Error('Empty box');for(const l of b.lines)used.set(l.key,(used.get(l.key)||0)+l.quantity);
  if(b.leaderBundleId){const bundle=plan.settings.leaderBundles?.find(row=>row.id===b.leaderBundleId);if(!bundle||bundle.lines.length!==b.mainLines.length||bundle.lines.some(line=>!b.mainLines.some(i=>i.key===line.key&&i.quantity===line.quantity)))throw Error('Leading bundle does not match its saved definition');}
  else if(plan.settings.leadersOnly&&b.mainLines.some(i=>!i.leading))throw Error('Leading rewards must be explicitly marked');
  const books=b.mainLines.filter(i=>i.role==='Book');
  if(books.length&&(books.length<2||!b.mainLabel))throw Error('Individual books cannot be leading rewards; use a complete set');
  if(books.some(i=>/^A Dance in Fire, v\d+$/i.test(i.name))&&Array.from({length:7},(_,k)=>k+1).some(k=>!books.some(i=>new RegExp('^A Dance in Fire, v'+k+'$','i').test(i.name))))throw Error('A Dance in Fire needs all seven volumes');
  if(!plan.settings.leadersOnly&&b.mainLines.some(fillerOnly))throw Error('Joke items and minor potions are filler only');
  if(!plan.settings.leadersOnly&&!plan.settings.boxTypes&&b.tier==='Premium'&&!b.mainLabel&&!b.mainLines.some(gear))throw Error('Premium needs equipment');
  if(!plan.settings.leadersOnly&&b.tier==='General'&&b.mainLines.some(i=>i.role==='Potion')&&(sum(b.mainLines,i=>i.quantity)<2||!b.mainLines.every(goodPotion)))throw Error('Potion reward must contain at least two non-minor potions');
  if(b.leadOnly&&(b.lines.length!==b.mainLines.length||b.lines.some(line=>!b.mainLines.some(main=>main.key===line.key&&main.quantity===line.quantity))))throw Error('A sufficient lead must not receive extras');
  if(!b.leadOnly&&sum(b.lines.filter(i=>i.role==='Potion'),i=>i.quantity)<(plan.settings.minimumPotions??0))throw Error('Box does not meet the potion minimum');
  const main=splitRewards(b);if(sum(main.mainLines,i=>i.quantity)+sum(main.other,i=>i.quantity)!==sum(b.lines,i=>i.quantity))throw Error('Reward quantities do not reconcile');
 }
 for(const line of plan.unallocated??[])used.set(line.key,(used.get(line.key)||0)+line.quantity);
 for(const i of stock)if((used.get(i.key)||0)!==i.quantity)throw Error(`Stock mismatch: ${i.name}`);return true;
}
export function splitRewards(box){
 const mainLines=box.mainLines||[{...box.lines[0],quantity:1}],counts=new Map(mainLines.map(l=>[l.key,l.quantity]));
 const other=box.lines.map(l=>({...l,quantity:l.quantity-(counts.get(l.key)||0)})).filter(l=>l.quantity>0);
 return {main:mainLines[0],mainLines,text:box.mainLabel||mainLines.map(l=>`${l.quantity} × ${l.name}`).join('\n'),other};
}
