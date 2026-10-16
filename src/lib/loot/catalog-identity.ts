/** Inventory IDs include a runtime load-order prefix; catalog IDs are plugin-local. */
export function lootCatalogIdentity(plugin:string,formId:string,runtime=false):string {
 const id=formId.replace(/^0x/i,"").toUpperCase();
 const local=runtime?id.slice(id.startsWith("FE")?-3:-6):id;
 return `${plugin.trim().toLowerCase()}:${local.replace(/^0+/,"")||"0"}`;
}
