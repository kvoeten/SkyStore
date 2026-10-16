export type PackingItem = { key: string; name: string; quantity: number; role: string; value: number | null; container: string; leading?:boolean };
export type PackingSettings = { count: number; margin: number; general: number; premium: number; exclusive: number; leaderBundles?:LeadingBundle[]; leadersOnly?:boolean; minimumPotions?:number; winPercent?: number; winValuePercent?: number; boxTypes?: {tier:"General"|"Premium"|"Exclusive";count:number;price:number}[] };
export type PackedBox = { id: string; tier: string; sale: number; value: number; profit: number; margin: number; status: string; leadOnly?:boolean; mainLabel: string | null; mainLines: PackingItem[]; lines: PackingItem[]; materials: number; special: boolean };
export type PackingResult = { boxes: PackedBox[]; settings: PackingSettings; unallocated?:PackingItem[]; stockValue?:number; odds?: {tier:string;total:number;winners:number;percent:number}[]; units: number; knownValue: number; missingRows: number; missingUnits: number; blocked?: string; revenue?: number; profit?: number; margin?: number; warnings: string[] };
export const defaultSettings: PackingSettings;
export type LeadingBundle = {id:string;name:string;lines:{key:string;quantity:number}[]};
export function generateAll(items: PackingItem[], settings?: Partial<PackingSettings>, seed?: number): PackingResult;
export function validateAll(items: PackingItem[], plan: PackingResult): boolean;
export function splitRewards(box: PackedBox): { main: PackingItem; mainLines: PackingItem[]; text: string; other: PackingItem[] };
