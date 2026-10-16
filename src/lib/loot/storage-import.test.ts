import { describe, expect, it } from "vitest";
import { importStorageCsv, readStorageCsv } from "./storage-import";
const header = "container_id,name,count,form_id,source_plugin,captured_utc,session,custom_name,temper_health\n";
const row = (count: number, time = "2026-10-14T12:00:00Z", container = "000C83B1", temper = "") => `${container},Iron Shield,${count},00012E49,Skyrim.esm,${time},session,,${temper}\n`;
describe("storage CSV", () => {
  it("ignores the internal chest loot book on future imports",()=>{
    expect(importStorageCsv(header+row(1).replace("Iron Shield","KzlChestLootBook"),"event").items).toEqual([]);
    expect(importStorageCsv(header+row(1).replace("Iron Shield","").replace("Skyrim.esm","Keizaal.esp").replace("00012E49","08DC4E14"),"event").items).toEqual([]);
  });
  it("reads quoted names without losing identity fields", () => expect(readStorageCsv('name,count\n"A Dance in Fire, v1",2\n')[1]).toEqual(["A Dance in Fire, v1", "2"]));
  it("uses only the latest capture for the chosen container", () => {
    const result = importStorageCsv(header + row(30, "2026-10-13T12:00:00Z") + row(2) + row(80, undefined, "0010D993"), "event");
    expect(result.items).toHaveLength(1); expect(result.items[0].quantity).toBe(2); expect(result.items[0].unitValue).toBeNull();
  });
  it("combines stacks but preserves differently tempered variants", () => {
    const result = importStorageCsv(header + row(2) + row(3) + row(1, undefined, undefined, "1.2"), "event");
    expect(result.items.map((item) => item.quantity)).toEqual([5, 1]);
  });
  it("rejects partial rows, fractional stock and unfinished quotes", () => {
    expect(() => importStorageCsv(header + "000C83B1,Iron", "event")).toThrow("Incomplete");
    expect(() => importStorageCsv(header + row(1.5), "event")).toThrow("quantity");
    expect(() => readStorageCsv('name\n"broken')).toThrow("Incomplete");
  });
  it("does not import personal or the other storage", () => expect(() => importStorageCsv(header + row(2), "store")).toThrow("no store"));
  it("keeps identity stable across load-order changes",()=>{
    const first=importStorageCsv(header+row(2),"event");
    const moved=importStorageCsv(header+row(2).replace("00012E49","08012E49"),"event");
    expect(first.items[0].key).toBe(moved.items[0].key);
  });
});
