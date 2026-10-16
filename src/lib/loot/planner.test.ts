import { describe, expect, it } from "vitest";
import { planLoot } from "./planner";
import { validateAll, type PackingSettings } from "./pack-rewards.mjs";
import type { PlannerItem } from "./planner";
const settings: PackingSettings = { count: 100, margin: .2, general: 120, premium: 150, exclusive: 200 };
const item = (key: string, category: string, quantity: number, unitValue: number | null, name = key): PlannerItem => ({ key, name, category, quantity, unitValue, plugin: "test.esp", formId: "00000001", customName: "", temper: "" });
describe("event packing", () => {
  it("never packs an excluded item even when marked as a leader or part of a bundle",()=>{
    const result=planLoot([{...item("Lottery staff","Weapon",1,1500),leading:true,excluded:true},item("Potion","Potion",4,20)],{...settings,leadersOnly:true,leaderBundles:[{id:"reserved",name:"Staff prize",lines:[{key:"Lottery staff",quantity:1}]}],boxTypes:[{tier:"General",count:2,price:100}]});
    expect(result.blocked).toBeUndefined();
    expect(result.boxes.flatMap(box=>box.lines).some(line=>line.key==="Lottery staff")).toBe(false);
    expect(result.units).toBe(4);
  });
  it("keeps sufficient leads alone and leaves surplus stock unallocated",()=>{
    const result=planLoot([{...item("Lead","Armor",1,80),leading:true},item("Potion","Potion",2,20),item("Material","Material",5,1)],{...settings,minimumPotions:1,boxTypes:[{tier:"General",count:1,price:100}]});
    expect(result.blocked).toBeUndefined();
    expect(result.boxes[0].lines.map(line=>line.key)).toEqual(["Lead"]);
    expect(result.knownValue).toBe(80);
    expect(result.profit).toBe(20);
    expect(result.units).toBe(1);
    expect(result.unallocated?.reduce((sum,line)=>sum+line.quantity,0)).toBe(7);
  });
  it("only adds filler to boxes whose leads are below the contents budget",()=>{
    const result=planLoot([{...item("High lead","Armor",1,150),leading:true},{...item("Low lead","Armor",1,20),leading:true},item("Potion","Potion",2,16),item("Material","Material",10,1)],{...settings,minimumPotions:1,boxTypes:[{tier:"General",count:2,price:100}]});
    expect(result.boxes.find(box=>box.mainLines[0].key==="High lead")!.lines).toHaveLength(1);
    expect(result.boxes.find(box=>box.mainLines[0].key==="Low lead")!.lines.length).toBeGreaterThan(1);
    expect(result.unallocated).toEqual([]);
    expect(result.knownValue).toBe(212);
  });
  it("fills all requested boxes with non-leads, including zero-value stock",()=>{
    const result=planLoot([item("Material","Material",10,0)],{...settings,leadersOnly:true,boxTypes:[{tier:"General",count:3,price:10}]});
    expect(result.blocked).toBeUndefined();
    expect(result.boxes).toHaveLength(3);
    expect(result.boxes.every(box=>box.lines.length>0&&box.mainLines.length===0)).toBe(true);
    expect(result.boxes.flatMap(box=>box.lines).reduce((sum,line)=>sum+line.quantity,0)).toBe(10);
    expect(result.warnings).toContain("3 of 3 boxes have no approved leading reward and are filled with other items instead.");
    expect(planLoot([item("Material","Material",1,1)],{...settings,leadersOnly:true,boxTypes:[{tier:"General",count:2,price:10}]}).blocked).toBe("stock");
  });
  it("treats reusable combinations as indivisible leaders without double-using stock",()=>{
    const stock=[item("Ring","Jewellery",2,20),item("Necklace","Jewellery",2,30),item("Potion","Potion",2,20)];
    const result=planLoot(stock,{...settings,leadersOnly:true,minimumPotions:1,leaderBundles:[{id:"set",name:"Jewellery pair",lines:[{key:"Ring",quantity:1},{key:"Necklace",quantity:1}]}],boxTypes:[{tier:"General",count:2,price:100}]});
    expect(result.boxes).toHaveLength(2);
    expect(result.boxes.every(box=>box.mainLabel==="Jewellery pair"&&box.mainLines.length===2)).toBe(true);
    expect(result.units).toBe(6);
    expect(result.knownValue).toBe(140);
  });
  it("never promotes a marked individual book, including expensive books",()=>{
    const bookOnly=planLoot([{...item("Book","Book",2,500),leading:true}],{...settings,leadersOnly:true,boxTypes:[{tier:"General",count:1,price:100}]});
    expect(bookOnly.blocked).toBeUndefined();
    expect(bookOnly.boxes[0].mainLines).toEqual([]);
    const result=planLoot([item("Shield","Armor",1,30),item("Expensive book","Book",1,500)],settings);
    expect(result.boxes.every(box=>box.mainLines.every(line=>line.role!=="Book"))).toBe(true);
  });
  it("keeps the complete book series as one saved lead, even without individual checkboxes",()=>{
    const books=Array.from({length:7},(_,k)=>item(`book${k+1}`,"Book",1,15,`A Dance in Fire, v${k+1}`));
    const result=planLoot(books,{...settings,leaderBundles:[{id:"books",name:"Full book set",lines:books.map(book=>({key:book.key,quantity:1}))}],boxTypes:[{tier:"General",count:1,price:150}]});
    expect(result.boxes).toHaveLength(1);
    expect(result.boxes[0].mainLines).toHaveLength(7);
    expect(result.boxes[0].mainLabel).toBe("Full book set");
    const incomplete=planLoot(books.slice(0,6),{...result.settings});
    expect(incomplete.blocked).toBeUndefined();
    expect(incomplete.boxes[0].mainLines).toEqual([]);
    expect(incomplete.warnings.some(w=>w.includes('no approved leading reward'))).toBe(true);
  });
  it("uses only marked leaders and protects a potion in every box",()=>{
    const stock=[{...item("Approved ring","Jewellery",2,20),leading:true},item("Unapproved sword","Weapon",1,500),item("Potion of Minor Healing","Potion",2,16),item("Ruby","Material",50,3)];
    const result=planLoot(stock,{...settings,minimumPotions:1,boxTypes:[{tier:"General",count:2,price:500}]});
    expect(result.blocked).toBeUndefined();
    expect(result.boxes.every(box=>box.mainLines.every(line=>line.key==="Approved ring"))).toBe(true);
    expect(result.boxes.every(box=>box.lines.filter(line=>line.role==="Potion").reduce((sum,line)=>sum+line.quantity,0)>=1)).toBe(true);
    expect(result.units).toBe(55);
    expect(result.knownValue).toBe(722);
  });
  it("warns about missing leaders but still enforces the potion minimum",()=>{
    const options={...settings,leadersOnly:true,minimumPotions:1,boxTypes:[{tier:"General" as const,count:2,price:100}]};
    const stock=[{...item("Ring","Jewellery",1,20),leading:true},item("Sword","Weapon",3,30),item("Potion","Potion",1,20)];
    const filled=planLoot([...stock.slice(0,2),{...stock[2],quantity:2}],options);
    expect(filled.blocked).toBeUndefined();
    expect(filled.boxes).toHaveLength(2);
    expect(filled.boxes.filter(box=>box.mainLines.length===0)).toHaveLength(1);
    expect(filled.warnings).toContain("1 of 2 boxes have no approved leading reward and are filled with other items instead.");
    expect(planLoot([{...stock[0],quantity:2},stock[1],stock[2]],options).blocked).toBe("potions");
  });
  it("allows an explicitly marked potion to be both leader and guaranteed potion",()=>{
    const result=planLoot([{...item("Potion of Minor Healing","Potion",2,16),leading:true}],{...settings,minimumPotions:1,boxTypes:[{tier:"General",count:2,price:20}]});
    expect(result.boxes).toHaveLength(2);
    expect(result.boxes.every(box=>box.lines.reduce((sum,line)=>sum+line.quantity,0)===1)).toBe(true);
  });
  it("keeps exact custom quantities and prices without extra special boxes",()=>{
    const result=planLoot([item("Shield","Armor",4,30),item("Ruby","Material",50,6),item("Rare sword","Weapon",1,1000)],{...settings,boxTypes:[{tier:"General",count:2,price:100},{tier:"Premium",count:1,price:250}]});
    expect(result.boxes).toHaveLength(3);
    expect(result.boxes.filter(box=>box.tier==="General").map(box=>box.sale)).toEqual([100,100]);
    expect(result.boxes.filter(box=>box.tier==="Premium").map(box=>box.sale)).toEqual([250]);
    expect(result.boxes.some(box=>box.special)).toBe(false);
    expect(result.knownValue).toBe(1420);
    expect(result.profit).toBe(-970);
    expect(result.units).toBe(55);
    expect(result.warnings).toContain("Current stock and reward rules cannot meet the profit target.");
  });
  it("supports exactly two boxes in one type",()=>{
    const result=planLoot([item("Clothes","Clothing",2,20),item("Ruby","Material",20,5)],{...settings,boxTypes:[{tier:"General",count:2,price:100}]});
    expect(result.boxes).toHaveLength(2);
    expect(result.boxes.every(box=>box.tier==="General"&&box.sale===100)).toBe(true);
  });
  it("creates winning and losing boxes with auditable odds without changing total value",()=>{
    const stock=[item("Common Clothes","Clothing",20,20),item("Material","Material",200,6)];
    const options={...settings,count:20,general:100,premium:150,exclusive:200,winPercent:25,winValuePercent:130};
    const result=planLoot(stock,options);
    expect(result.boxes).toHaveLength(20);
    expect(result.boxes.filter(box=>box.value>box.sale)).toHaveLength(5);
    expect(result.boxes.filter(box=>box.value<box.sale)).toHaveLength(15);
    expect(result.odds?.find(row=>row.tier==="General")?.percent).toBe(25);
    expect(result.knownValue).toBe(1600);
    expect(result.profit).toBe(400);
    expect(result.boxes.flatMap(box=>box.lines).reduce((sum,line)=>sum+line.quantity,0)).toBe(220);
    expect(planLoot(stock,options)).toEqual(result);
    const balanced=planLoot(stock,{...options,winPercent:0});
    expect(balanced.boxes.every(box=>box.value<box.sale)).toBe(true);
  });
  it("rejects impossible odds settings",()=>{
    expect(()=>planLoot([item("Shield","Armor",1,23)],{...settings,winPercent:101})).toThrow("Winning odds");
  });
  it("excludes unresolved items without blocking identified stock, but does not invent prices", () => {
    const result=planLoot([item("KzlUnknown", "Review", 1, null),{...item("Shield","Armor",1,23),catalogItemId:"matched"}],settings);
    expect(result.blocked).toBeUndefined();
    expect(result.units).toBe(1);
    expect(result.warnings.some(w=>w.includes("KzlUnknown"))).toBe(true);
    expect(planLoot([{...item("KzlArmor","Review",1,23),catalogItemId:"matched"}],{...settings,boxTypes:[{tier:"General",count:1,price:100}]}).blocked).toBeUndefined();
    expect(planLoot([item("Shield", "Armor", 1, null)], settings).blocked).toBe("pricing");
  });
  it("ignores the internal chest loot book in existing snapshots",()=>{
    const result=planLoot([item("KzlChestLootBook","Review",1,null),item("Shield","Armor",1,23)],settings);
    expect(result.units).toBe(1);
    expect(result.boxes.flatMap(box=>box.lines).some(line=>line.name==="KzlChestLootBook")).toBe(false);
  });
  it("keeps the complete book set together, preserves all stock and uses amulet overrides", () => {
    const stock = [item("Shield", "Armor", 2, 23), item("Potion", "Potion", 30, 20), item("Ruby", "Material", 200, 1), item("amulet", "Jewellery", 1, 1, "Amulet of Mara"), ...Array.from({length:7}, (_,index)=>item(`book-${index}`, "Book", 1, 15, `A Dance in Fire, v${index+1}`))];
    const result = planLoot(stock, settings);
    expect(result.boxes.find((box)=>box.mainLabel)?.mainLines).toHaveLength(7);
    expect(result.boxes.flatMap((box)=>box.lines).find((line)=>line.key==="amulet")?.value).toBe(150);
    expect(validateAll(stock.map((row)=>({key:row.key,name:row.name,quantity:row.quantity,role:row.category,value:row.unitValue,container:"EVENT STORAGE"})), result)).toBe(true);
    expect(result.profit).toBeCloseTo(result.revenue! - result.knownValue);
  });
  it("never treats minor potions as a main reward", () => {
    const result=planLoot([item("Potion of Minor Healing","Potion",20,16), item("Shield","Armor",1,23)],settings);
    expect(result.boxes.every((box)=>box.mainLines.every((line)=>line.name!=="Potion of Minor Healing"))).toBe(true);
  });
  it("keeps joke items and minor potions as extras even if valued above Special thresholds",()=>{
    const result=planLoot([item("Burned Book","Joke",1,500),item("Ice Wraith Essence","Potion",1,500),item("Shield","Armor",1,23)],settings);
    expect(result.boxes).toHaveLength(1);
    expect(result.boxes[0].mainLines.map((line)=>line.name)).toEqual(["Shield"]);
    expect(result.boxes[0].lines.reduce((sum,line)=>sum+line.quantity,0)).toBe(3);
  });
});
