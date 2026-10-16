import {describe,it,expect} from "vitest";
import ExcelJS from "exceljs";
import {exportLootWorkbook} from "./excel-export";
import {planLoot} from "./planner";
import {lootTotals,sameEventSetup} from "./summary";
import type {LootDashboard} from "./service";
type Admin=Extract<LootDashboard,{manage:true}>;
const settings={count:2,margin:.2,general:100,premium:150,exclusive:200,leadersOnly:true,boxTypes:[{tier:"General" as const,count:2,price:100}]};
const plan=planLoot([{key:"p",name:'=HYPERLINK("https://example.com")',category:"Potion",quantity:4,unitValue:20,reviewed:true,plugin:"test.esp",formId:"1",customName:"",temper:""}],settings);
const event={id:"event",name:"Whiterun event",status:"draft",settings,plan,updatedAt:new Date("2026-10-17T00:00:00Z")} as Admin['events'][number];
describe("saved event export and totals",()=>{
 it("exports a real xlsx with numeric prices, contents, totals and literal names",async()=>{
  const file=await exportLootWorkbook(event,[],[]),book=new ExcelJS.Workbook();await book.xlsx.load(file);
  expect(book.worksheets.map(s=>s.name)).toEqual(["Event summary","Boxes","Contents","Assignments"]);
  expect(book.getWorksheet("Event summary")!.getCell("B7").value).toBe(120);
  expect(book.getWorksheet("Boxes")!.getCell("E2").value).toBe(100);
  const name=book.getWorksheet("Contents")!.getCell("C2");expect(name.value).toBe('=HYPERLINK("https://example.com")');expect(name.type).toBe(ExcelJS.ValueType.String);
  expect(book.getWorksheet("Boxes")!.rowCount).toBe(3);
 });
 it("does not export a missing plan",async()=>expect(exportLootWorkbook({...event,plan:null},[],[])).rejects.toThrow(/Save/));
 it("derives summary from saved boxes, not stale aggregate fields",()=>expect(lootTotals({...plan,revenue:0,profit:0})).toEqual({boxes:2,cost:80,revenue:200,profit:120,margin:.6}));
 it("recognizes saved settings regardless of json key order",()=>{
  expect(sameEventSetup(event.name,settings,{name:event.name,settings:Object.fromEntries(Object.entries(settings).reverse()) as typeof settings})).toBe(true);
  expect(sameEventSetup(event.name,{...settings,margin:.3},event)).toBe(false);
 });
});
