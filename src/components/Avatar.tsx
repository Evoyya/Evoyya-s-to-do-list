// Аватар пользователя Google; без картинки — первая буква имени
export function Avatar({
  name,
  url,
  className = 'size-8 text-sm',
}: {
  name: string
  url?: string | null
  className?: string
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        title={name}
        referrerPolicy="no-referrer"
        className={`shrink-0 rounded-full ${className}`}
      />
    )
  }
  return (
    <span
      title={name}
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/30 ${className}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
