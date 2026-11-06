// ТР-13: классы кнопок и полей светлой вкладки «Банка»

export const jarButton = {
  primary:
    'rounded-full bg-jar-rose px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-jar-rose/30 transition-colors hover:bg-[#c2416e] disabled:opacity-40',
  secondary:
    'rounded-full border border-jar-line bg-white px-4 py-2 text-sm text-jar-ink transition-colors hover:bg-jar-pink-soft disabled:opacity-40',
  quiet:
    'rounded-full px-3 py-1.5 text-sm text-jar-ink-muted transition-colors hover:bg-jar-pink-soft hover:text-jar-ink',
}

export const jarField =
  'w-full rounded-xl border border-jar-line bg-white px-3 py-2 text-base text-jar-ink outline-none placeholder:text-jar-ink-muted/70 focus:border-jar-rose'
