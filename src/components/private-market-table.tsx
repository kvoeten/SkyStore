/* eslint-disable @next/next/no-img-element -- image paths are validated local catalog assets. */
import { formatHighestUnitGold } from "@/lib/money";

type PriceRule = {
  minimumSeptims: number;
  maximumSeptims: number;
  quantity: number;
  maximumQuantity: number;
};

type PrivateGuideRow = {
  itemId: string;
  displayName: string;
  category: string;
  imageUrl: string | null;
  storePays: PriceRule | null;
  customerPays: PriceRule | null;
  lastSale: { occurrenceAt: Date; quantity: number; totalSeptims: number } | null;
};

function bundle(rule: PriceRule | null): string {
  if (!rule) return "—";
  return formatHighestUnitGold(rule.maximumSeptims, rule.quantity);
}

export function PrivateMarketTable({ rows, storeId, searched }: { rows: readonly PrivateGuideRow[]; storeId: string; searched: boolean }) {
  if (!rows.length) return <div className="empty"><b>No matching items.</b><p>{searched ? "Try another item name or category." : "Items appear here once they have a current price or a recent approved store sale."}</p></div>;
  return <div className="table-wrap"><table><thead><tr><th>Item</th><th>Store buying price</th><th>Store selling price</th><th>Latest store sale</th></tr></thead><tbody>{rows.map((row) => <tr key={row.itemId}><td><a href={`/items/${row.itemId}?storeId=${encodeURIComponent(storeId)}`} className="item-name">{row.imageUrl ? <img src={row.imageUrl} alt="" width="38" height="38" style={{ flex: "0 0 auto", objectFit: "contain", padding: 4, border: "1px solid #9f7b42", borderRadius: 2, background: "#252b33" }}/> : <span className="item-dot">◇</span>}<span>{row.displayName}<br/><small>{row.category}</small></span></a></td><td>{bundle(row.storePays)}</td><td>{bundle(row.customerPays)}</td><td>{row.lastSale ? <>{formatHighestUnitGold(row.lastSale.totalSeptims, row.lastSale.quantity)}<br/><small>{row.lastSale.occurrenceAt.toLocaleDateString()}</small></> : "—"}</td></tr>)}</tbody></table></div>;
}
