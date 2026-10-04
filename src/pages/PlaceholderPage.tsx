type PlaceholderPageProps = {
  title: string;
};

function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="card border border-base-content/10 bg-base-200">
        <div className="card-body items-center text-center">
          <h1 className="card-title text-base-content">{title}</h1>
          <p className="text-base-content/60">
            Page en cours de développement.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PlaceholderPage;
