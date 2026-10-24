import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { NUM, TABLE, TD, TH } from "@/components/admin/format";
import { parseRange, questionStats, requireAdmin } from "@/lib/server/admin";

export default function QuestionsPage(props: PageProps<"/[lang]/admin/questions">) {
  return (
    <Suspense fallback={<p className="text-drift">…</p>}>
      <Questions {...props} />
    </Suspense>
  );
}

async function Questions({ params, searchParams }: PageProps<"/[lang]/admin/questions">) {
  await requireAdmin();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const range = parseRange((await searchParams).days);
  const [{ admin, categories }, rows] = await Promise.all([getDictionary(lang), questionStats(range)]);
  const t = admin.questions;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-drift">{t.intro}</p>
      <div className="overflow-x-auto">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>{t.question}</th>
              <th className={`${TH} ${NUM}`}>{t.answers}</th>
              <th className={`${TH} ${NUM}`}>{t.played}</th>
              <th className={`${TH} ${NUM}`}>{t.misses}</th>
              <th className={`${TH} ${NUM}`}>{t.avgPoints}</th>
              <th className={`${TH} ${NUM}`}>{t.distinct}</th>
              <th className={`${TH} ${NUM}`}>{t.wrong}</th>
              <th className={`${TH} ${NUM}`}>{t.unknown}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.active ? undefined : "opacity-50"}>
                <td className={TD}>
                  <Link
                    href={`/${lang}/admin/questions/${encodeURIComponent(r.id)}?days=${range}`}
                    className="text-moonlight hover:underline"
                  >
                    {r.prompt[lang]}
                  </Link>
                  <span className="ml-2 text-base text-drift">
                    {categories[r.category]}
                    {!r.active && ` · ${admin.inactive}`}
                  </span>
                </td>
                <td className={`${TD} ${NUM}`}>{r.answerCount}</td>
                <td className={`${TD} ${NUM}`}>{r.answered}</td>
                <td className={`${TD} ${NUM}`}>{r.answered ? `${Math.round((100 * r.misses) / r.answered)} %` : "–"}</td>
                <td className={`${TD} ${NUM}`}>{r.avgPoints ?? "–"}</td>
                <td className={`${TD} ${NUM}`}>{r.distinctAnswers}</td>
                <td className={`${TD} ${NUM}`}>{r.wrong}</td>
                <td className={`${TD} ${NUM}`}>{r.unknown}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
