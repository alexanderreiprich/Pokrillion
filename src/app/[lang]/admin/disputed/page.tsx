import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { NUM, TABLE, TD, TH } from "@/components/admin/format";
import { YamlBlock } from "@/components/admin/YamlBlock";
import { disputedAnswers, parseRange, requireAdmin } from "@/lib/server/admin";

export default function DisputedPage(props: PageProps<"/[lang]/admin/disputed">) {
  return (
    <Suspense fallback={<p className="text-drift">…</p>}>
      <Disputed {...props} />
    </Suspense>
  );
}

async function Disputed({ params, searchParams }: PageProps<"/[lang]/admin/disputed">) {
  await requireAdmin();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const range = parseRange((await searchParams).days);
  const [{ admin }, rows] = await Promise.all([getDictionary(lang), disputedAnswers(range)]);
  const t = admin.disputed;

  // One include-list per question, for copy & paste into content/questions/*.yaml.
  const byQuestion = new Map<string, string[]>();
  for (const r of rows) byQuestion.set(r.question.id, [...(byQuestion.get(r.question.id) ?? []), r.entity.id]);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-drift">{t.intro}</p>
      {rows.length === 0 ? (
        <p>{admin.empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>{t.question}</th>
                  <th className={TH}>{t.guess}</th>
                  <th className={`${TH} ${NUM}`}>{t.count}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.question.id}|${r.entity.id}`}>
                    <td className={TD}>
                      <Link
                        href={`/${lang}/admin/questions/${encodeURIComponent(r.question.id)}?days=${range}`}
                        className="text-moonlight hover:underline"
                      >
                        {r.question.prompt[lang]}
                      </Link>
                    </td>
                    <td className={TD}>
                      {r.entity.names[lang]} <span className="text-drift">({r.entity.id})</span>
                    </td>
                    <td className={`${TD} ${NUM}`}>{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[...byQuestion.entries()].map(([questionId, ids]) => (
            <YamlBlock
              key={questionId}
              title={fill(t.yaml, { question: questionId })}
              yaml={`include: [${ids.join(", ")}]`}
              copy={admin.copy}
              copied={admin.copied}
            />
          ))}
        </>
      )}
    </section>
  );
}
