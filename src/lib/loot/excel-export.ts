import ExcelJS from "exceljs";
import type {LootDashboard} from "./service";
import {lootTotals} from "./summary";
type Admin=Extract<LootDashboard,{manage:true}>;
export async function exportLootWorkbook(event:Admin['events'][number],assignments:Admin['assignments'],users:Admin['users'],purchases:Admin['purchases']=[]){
 if(!event.plan)throw Error("Save a box plan before exporting.");
 const workbook=new ExcelJS.Workbook();workbook.creator="SkyStore";workbook.created=new Date();
 const name=(id:string|null)=>users.find(user=>user.id===id)?.displayName??users.find(user=>user.id===id)?.name??"Available";
 const totals=lootTotals(event.plan);
 const summary=workbook.addWorksheet("Event summary");summary.columns=[{width:28},{width:42}];
 summary.addRows([[event.name],["Status",event.status],["Saved at (UTC)",new Date(event.updatedAt).toISOString()],["Boxes",totals.boxes],["Packed cost (g)",totals.cost],["Revenue (g)",totals.revenue],["Profit (g)",totals.profit],["Profit margin",totals.margin],["Profit target",event.settings.margin]]);
 summary.getCell("B8").numFmt="0.0%";summary.getCell("B9").numFmt="0.0%";
 const boxes=workbook.addWorksheet("Boxes");boxes.columns=[{header:"Box",width:12},{header:"Type",width:16},{header:"Main reward",width:48},{header:"Contents value (g)",width:22},{header:"Selling price (g)",width:22},{header:"Profit (g)",width:18},{header:"Profit margin",width:18},{header:"Assigned to",width:28},{header:"Status",width:22}];
 const contents=workbook.addWorksheet("Contents");contents.columns=[{header:"Box",width:12},{header:"Type",width:16},{header:"Item",width:52},{header:"Quantity",width:14},{header:"Unit value (g)",width:20},{header:"Total value (g)",width:22},{header:"Leading quantity",width:20}];
 const people=workbook.addWorksheet("Assignments");people.columns=[{header:"Customer",width:30},{header:"Type",width:16},{header:"Purchased",width:16},{header:"Assigned",width:16},{header:"Still to assign",width:20}];
 for(const purchase of purchases.filter(row=>row.eventId===event.id)){const assigned=assignments.filter(row=>row.eventId===event.id&&row.userId===purchase.userId&&row.contents.tier===purchase.tier).length;people.addRow([name(purchase.userId),purchase.tier,purchase.quantity,assigned,Math.max(0,purchase.quantity-assigned)]);}
 for(const box of event.plan.boxes){
  const assigned=assignments.find(row=>row.eventId===event.id&&row.boxNumber===box.id);
  const status=assigned?.fulfilledAt?"Handed over":assigned?.openedAt?"Opened":assigned?.userId?"Assigned":"Available";
  boxes.addRow([box.id,box.tier,box.mainLabel??box.mainLines.map(line=>`${line.quantity} × ${line.name}`).join(", "),box.value,box.sale,box.sale-box.value,box.sale?(box.sale-box.value)/box.sale:0,name(assigned?.userId??null),status]);
  for(const line of box.lines)contents.addRow([box.id,box.tier,line.name,line.quantity,line.value,line.value==null?null:line.quantity*line.value,box.mainLines.find(main=>main.key===line.key)?.quantity??0]);
 }
 boxes.getColumn(7).numFmt="0.0%";
 for(const sheet of workbook.worksheets){sheet.views=[{state:"frozen",ySplit:1}];sheet.eachRow(row=>{let lines=1;row.eachCell(cell=>{cell.font={name:"Calibri",size:11};cell.alignment={vertical:"middle",wrapText:true};if(typeof cell.value==="string")lines=Math.max(lines,Math.ceil(cell.value.length/(sheet.getColumn(cell.col).width??20)));});row.height=Math.max(22,lines*15);});sheet.getRow(1).font={name:"Calibri",size:11,bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF252B33"}};sheet.getRow(1).height=30;if(sheet!==summary)sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:sheet.columnCount}};}
 // Names are typed string cells, never interpreted as spreadsheet formulas.
 return workbook.xlsx.writeBuffer();
}
