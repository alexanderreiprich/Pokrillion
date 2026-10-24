import { CopyButton } from "./CopyButton";

export function YamlBlock({ title, yaml, copy, copied }: { title: string; yaml: string; copy: string; copied: string }) {
  return (
    <div className="rounded-md border-2 border-line bg-night-950/80">
      <div className="flex items-center justify-between gap-2 border-b-2 border-line px-3 py-1">
        <span className="text-base text-drift">{title}</span>
        <CopyButton text={yaml} label={copy} copiedLabel={copied} />
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-sm leading-relaxed text-moon">{yaml}</pre>
    </div>
  );
}
