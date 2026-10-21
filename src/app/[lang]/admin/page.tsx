import { Suspense } from "react";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { NUM, TABLE, TD, TH } from "@/components/admin/format";
import { dailyOverview, parseRange, requireAdmin } from "@/lib/server/admin";

export default function AdminOverviewPage(props: PageProps<"/[lang]/admin">) {
  return (
    <Suspense fallback={<p className="text-drift">…</p>}>
      <Overview {...props} />
    </Suspense>
  );
}

async function Overview({ params, searchParams }: PageProps<"/[lang]/admin">) {
  await requireAdmin();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const [{ admin }, rows] = await Promise.all([getDictionary(lang), dailyOverview(parseRange((await searchParams).days))]);
  const t = admin.overview;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-drift">{t.intro}</p>
      {rows.length === 0 ? (
        <p>{admin.empty}</p>
      ) : (
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={TH}>{t.day}</th>
              <th className={`${TH} ${NUM}`}>{t.plays}</th>
              <th className={`${TH} ${NUM}`}>{t.finished}</th>
              <th className={`${TH} ${NUM}`}>{t.avgScore}</th>
              <th className={`${TH} ${NUM}`}>{t.endlessRuns}</th>
              <th className={`${TH} ${NUM}`}>{t.endlessAnswers}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td className={TD}>
                  {new Date(`${r.day}T00:00:00Z`).toLocaleDateString(lang, { dateStyle: "medium", timeZone: "UTC" })}
                </td>
                <td className={`${TD} ${NUM}`}>{r.plays}</td>
                <td className={`${TD} ${NUM}`}>{r.finished}</td>
                <td className={`${TD} ${NUM}`}>{r.avg_score ?? "–"}</td>
                <td className={`${TD} ${NUM}`}>{r.endless_runs}</td>
                <td className={`${TD} ${NUM}`}>{r.endless_answers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
