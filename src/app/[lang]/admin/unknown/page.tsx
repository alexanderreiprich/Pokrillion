import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { NUM, TABLE, TD, TH } from "@/components/admin/format";
import { YamlBlock } from "@/components/admin/YamlBlock";
import { aliasYaml, parseRange, requireAdmin, unknownInputs } from "@/lib/server/admin";

export default function UnknownInputsPage(props: PageProps<"/[lang]/admin/unknown">) {
  return (
    <Suspense fallback={<p className="text-drift">…</p>}>
      <UnknownInputs {...props} />
    </Suspense>
  );
}

async function UnknownInputs({ params, searchParams }: PageProps<"/[lang]/admin/unknown">) {
  await requireAdmin();
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const range = parseRange((await searchParams).days);
  const [{ admin }, items] = await Promise.all([getDictionary(lang), unknownInputs(range)]);
  const t = admin.unknown;
  const yaml = aliasYaml(items);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-drift">{t.intro}</p>
      {items.length === 0 ? (
        <p>{admin.empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>{t.input}</th>
                  <th className={`${TH} ${NUM}`}>{t.count}</th>
                  <th className={TH}>{t.suggestion}</th>
                  <th className={TH}>{t.where}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.normalized}>
                    <td className={`${TD} text-electric`}>{item.sample}</td>
                    <td className={`${TD} ${NUM}`}>{item.n}</td>
                    <td className={TD}>
                      {item.elsewhere ? (
                        <span className="text-drift">
                          {fill(t.elsewhere, { name: item.elsewhere.names[lang], id: item.elsewhere.id })}
                        </span>
                      ) : item.suggestions.length === 0 ? (
                        <span className="text-drift">{t.none}</span>
                      ) : (
                        item.suggestions.map((s) => (
                          <span key={s.id} className="mr-3 inline-block">
                            {s.names[lang]}{" "}
                            <span className="text-drift">
                              ({s.id}, Δ{s.distance})
                            </span>
                          </span>
                        ))
                      )}
                    </td>
                    <td className={`${TD} text-base`}>
                      {item.questions.map((q) => (
                        <Link
                          key={q.id}
                          href={`/${lang}/admin/questions/${encodeURIComponent(q.id)}?days=${range}`}
                          className="mr-2 inline-block text-moonlight hover:underline"
                        >
                          {q.prompt[lang]}
                        </Link>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.entries(yaml).map(([file, text]) => (
            <YamlBlock key={file} title={fill(t.yaml, { file })} yaml={text} copy={admin.copy} copied={admin.copied} />
          ))}
        </>
      )}
    </section>
  );
}
