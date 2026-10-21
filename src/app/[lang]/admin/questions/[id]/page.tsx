import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { NUM, pct, TABLE, TD, TH } from "@/components/admin/format";
import { YamlBlock } from "@/components/admin/YamlBlock";
import { MIN_ANSWERS_FOR_CALIBRATION } from "@/lib/game/calibration";
import { parseRange, questionCalibration, requireAdmin } from "@/lib/server/admin";

export default function QuestionDetailPage(props: PageProps<"/[lang]/admin/questions/[id]">) {
  return (
    <Suspense fallback={<p className="text-drift">…</p>}>
      <QuestionDetail {...props} />
    </Suspense>
  );
}

async function QuestionDetail({ params, searchParams }: PageProps<"/[lang]/admin/questions/[id]">) {
  await requireAdmin();
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const range = parseRange((await searchParams).days);
  const [{ admin, categories }, data] = await Promise.all([
    getDictionary(lang),
    questionCalibration(decodeURIComponent(id), range),
  ]);
  if (!data) notFound();
  const t = admin.detail;

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/${lang}/admin/questions?days=${range}`} className="text-moonlight hover:underline">
        {t.back}
      </Link>
      <div>
        <p className="text-drift">
          {categories[data.category]} · {data.id}
        </p>
        <h2 className="text-3xl leading-tight">{data.prompt[lang]}</h2>
      </div>
      <p className="text-drift">{t.intro}</p>
      {!data.enoughData && (
        <p className="text-electric">{fill(t.tooFew, { n: MIN_ANSWERS_FOR_CALIBRATION, count: data.total })}</p>
      )}

      <div className="overflow-x-auto">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>{t.answer}</th>
              <th className={`${TH} ${NUM}`}>{t.given}</th>
              <th className={`${TH} ${NUM}`}>{t.observed}</th>
              <th className={`${TH} ${NUM}`}>{t.prior}</th>
              <th className={`${TH} ${NUM}`}>{t.familiarity}</th>
              <th className={`${TH} ${NUM}`}>{t.suggested}</th>
              <th className={`${TH} ${NUM}`}>{t.pointsNow}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => {
              const delta = r.suggested === null ? 0 : r.suggested - r.familiarity;
              const deltaColor = Math.abs(delta) < 10 ? "text-drift" : delta > 0 ? "text-hp-high" : "text-hp-low";
              return (
                <tr key={r.entity.id}>
                  <td className={TD}>
                    {r.entity.names[lang]}
                    {r.masterball && <span className="ml-2 text-base text-tier-masterball">{t.masterball}</span>}
                  </td>
                  <td className={`${TD} ${NUM}`}>{r.n}</td>
                  <td className={`${TD} ${NUM}`}>{pct(r.observedShare, lang)}</td>
                  <td className={`${TD} ${NUM}`}>{pct(r.priorShare, lang)}</td>
                  <td className={`${TD} ${NUM}`}>{r.familiarity}</td>
                  <td className={`${TD} ${NUM} ${deltaColor}`}>{r.suggested ?? "–"}</td>
                  <td className={`${TD} ${NUM} text-electric`}>{r.pointsNow}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.enoughData &&
        (Object.keys(data.yaml).length === 0 ? (
          <p className="text-drift">{t.noSuggestions}</p>
        ) : (
          <>
            <p className="text-drift">{t.yamlNote}</p>
            {Object.entries(data.yaml).map(([file, text]) => (
              <YamlBlock key={file} title={fill(t.yaml, { file })} yaml={text} copy={admin.copy} copied={admin.copied} />
            ))}
          </>
        ))}
    </section>
  );
}
