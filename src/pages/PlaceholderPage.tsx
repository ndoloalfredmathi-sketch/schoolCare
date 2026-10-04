type PlaceholderPageProps = {
  title: string;
};

function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold text-white">{title}</h1>
      <p className="text-sm text-slate-400">
        Page en cours de développement.
      </p>
    </div>
  );
}

export default PlaceholderPage;
