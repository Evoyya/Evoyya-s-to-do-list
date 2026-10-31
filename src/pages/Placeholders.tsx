// Заглушки страниц: наполняются на следующих этапах roadmap

function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (
    <section>
      <h1 className="mb-2 text-xl font-medium">{title}</h1>
      <p className="text-text-muted">Появится на этапе {stage}.</p>
    </section>
  )
}

export const ArchivePage = () => <Placeholder title="Архив" stage="7" />
export const LabelsPage = () => <Placeholder title="Ярлыки" stage="6" />
