import { platformOf } from '@/lib/platform';

const badgeColors = {
  sns: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  dev: 'bg-stone-200 text-stone-800 dark:bg-stone-500/20 dark:text-stone-200',
  blog: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  web: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
} as const;

type Props = {
  id: string;
  title: string;
  url: string;
};

export default function LinkCard({ id, title, url }: Props) {
  const p = platformOf(url);

  return (
    <a
      href={`/go/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 pr-4 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${badgeColors[p.kind]}`}
      >
        {p.abbr}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{title || p.name}</span>
        <span className="truncate text-xs text-stone-500 dark:text-stone-400">
          {p.name} · {p.host}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700 dark:group-hover:text-stone-200"
      >
        →
      </span>
    </a>
  );
}
