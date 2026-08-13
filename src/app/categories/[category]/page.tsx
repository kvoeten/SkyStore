/* eslint-disable @next/next/no-img-element -- catalog images are local, validated web assets. */
import { notFound } from "next/navigation";
import { AppShell, PageHeading, Status } from "@/components/app-shell";
import { resolveStaffPageStore, staffShellIdentity } from "@/components/staff-page-context";
import { getAccessContext } from "@/lib/authorization";
import { marketCategoryBySlug } from "@/lib/catalog/market-categories";
import { formatGold } from "@/lib/money";
import { getMarketCategoryItems } from "@/lib/services/category-queries";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ storeId?: string; view?: string }> }) {
  const category = marketCategoryBySlug((await params).category);
  if (!category) notFound();
  const query = await searchParams;
  const context = await getAccessContext();
  const requestedPublicView = query.view === "public" || !context;
  const store = requestedPublicView ? null : await resolveStaffPageStore(query.storeId);
  const publicView = requestedPublicView || !store;
  const items = await getMarketCategoryItems(category.slug, store?.id);
  const itemHref = (itemId: string) => store ? `/items/${itemId}${store.storeQuery}` : `/guide/items/${itemId}`;
  const content = <div className="page">
    <PageHeading eyebrow="QUICK CATEGORY" title={category.label}><p>{category.description}</p></PageHeading>
    <section className="panel">
      <div className="panel-head"><h2>Items</h2><Status kind="good">{items.length} entries</Status></div>
      <div className="table-wrap"><table><thead><tr><th>Item</th>{store && <th>Store buying price</th>}<th>Store Price</th></tr></thead><tbody>{items.map((item) => <tr key={item.itemId}>
        <td><a className="item-name" href={itemHref(item.itemId)}><img src={item.imageUrl} alt="" width="38" height="38"/><span>{item.name}{item.variantCount > 1 && <small>{item.variantCount} collapsed variants</small>}</span></a></td>
        {store && <td>{item.buyingPrice == null ? "Not priced" : formatGold(item.buyingPrice)}</td>}
        <td>{item.sellingPrice == null ? "Not priced" : formatGold(item.sellingPrice)}</td>
      </tr>)}</tbody></table></div>
    </section>
    {!store && <p className="market-footnote">Public price information can be up to 7 days behind on real market trends. Visit your local store for up-to-date pricing information.</p>}
  </div>;
  return publicView
    ? <AppShell current={`/categories/${category.slug}`} publicView publicAccount={Boolean(context)} searchPublicView={query.view === "public"}>{content}</AppShell>
    : <AppShell current={`/categories/${category.slug}`} identity={staffShellIdentity(store!)}>{content}</AppShell>;
}
