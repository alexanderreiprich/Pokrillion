export const pct = (share: number, lang: string) =>
  `${(share * 100).toLocaleString(lang, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;

export const TABLE = "w-full border-collapse text-lg";
export const TH = "border-b-2 border-line px-2 py-1 text-left font-normal text-drift";
export const TD = "border-b border-line/60 px-2 py-1 align-top";
export const NUM = "text-right tabular-nums";
