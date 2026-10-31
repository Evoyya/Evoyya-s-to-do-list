// ТР-4: квадратик слева от пункта. Отрицательный отступ увеличивает зону нажатия на телефоне.
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange?: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={!onChange}
      onClick={(e) => {
        e.stopPropagation()
        onChange?.(!checked)
      }}
      className="-m-1.5 shrink-0 p-1.5 text-text-muted hover:text-text disabled:cursor-default disabled:hover:text-text-muted"
    >
      <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="16"
          height="16"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        {checked && (
          <path
            d="M5.5 10.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}

// «1 выполнен», «6 выполнено», «21 выполнен» — как в Keep
export function doneLabel(count: number) {
  const singular = count % 10 === 1 && count % 100 !== 11
  return `${count} ${singular ? 'выполнен' : 'выполнено'}`
}
