/** Restore clothing variants without changing stock identity or custom item names. */
export function lootItemLabel(raw:string,catalogName?:string):string {
 const resolved=raw||catalogName||"Unknown item";
 if(!catalogName||!/^Fine Clothes(?:\s|$)/i.test(catalogName)||!/^Fine Clothes(?:\s|$)/i.test(resolved))return resolved;
 const suffix=catalogName.slice("Fine Clothes".length).trim();
 const variant=suffix.replace(/^\((.*)\)$/,"$1");
 if(!variant)return resolved;
 const variantName=variant;
 const tail=resolved.slice("Fine Clothes".length).trim();
 // Preserve deliberate renames: only rewrite generic names or matching variants.
 const quality=/^(?:\s*\((?:Pristine|Fine|Superior|Exquisite|Flawless|Epic|Legendary)\))*$/i;
 let remaining=tail;
 if(suffix&&remaining.toLowerCase().startsWith(suffix.toLowerCase()))remaining=remaining.slice(suffix.length).trim();
 else if(suffix&&remaining.toLowerCase().startsWith(`(${variant.toLowerCase()})`))remaining=remaining.slice(variant.length+2).trim();
 if(!quality.test(remaining))return resolved;
 return `Fine Clothes (${variantName})${remaining?` ${remaining}`:""}`;
}
