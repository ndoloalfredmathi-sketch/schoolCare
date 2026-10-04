import clsx from "clsx";
import {
  CalendarCheck,
  CalendarX,
  Clock,
  HeartPulse,
  TriangleAlert,
  Users,
} from "lucide-react";
import MetricCard from "../components/MetricCard";

type AlertTone = "error" | "warning" | "info" | "secondary";

type Alert = {
  tone: AlertTone;
  title: string;
  source: string;
  time: string;
};

const dotClass: Record<AlertTone, string> = {
  error: "bg-error",
  warning: "bg-warning",
  info: "bg-info",
  secondary: "bg-secondary",
};

const alerts: Alert[] = [
  {
    tone: "error",
    title: "3 élèves fièvreux signalés",
    source: "Infirmerie",
    time: "il y a 12 min",
  },
  {
    tone: "warning",
    title: "12 absences non justifiées depuis 3 jours",
    source: "Absences",
    time: "il y a 1 h",
  },
  {
    tone: "info",
    title: "8 dossiers de vaccination manquants",
    source: "Dossiers santé",
    time: "ce matin",
  },
  {
    tone: "secondary",
    title: "Réunion parents-classe mercredi 18h",
    source: "Communication",
    time: "hier",
  },
];

function HomePage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Élèves inscrits"
          value="842"
          detail="34 classes · 3 niveaux"
          delta="+12 ce mois"
          icon={Users}
          tone="success"
        />

        <MetricCard
          label="Présences du jour"
          value="96,4 %"
          detail="812 présents sur 842"
          icon={CalendarCheck}
          tone="info"
        />

        <MetricCard
          label="Absences à valider"
          value="17"
          detail="5 depuis plus de 3 jours"
          icon={CalendarX}
          tone="error"
        />

        <MetricCard
          label="Infirmerie"
          value="6"
          detail="visites aujourd'hui · 2 en cours"
          icon={HeartPulse}
          tone="warning"
        />
      </div>

      <section className="card border border-base-content/10 bg-base-200">
        <div className="card-body p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-base-content">
              <TriangleAlert className="h-4 w-4 text-warning" strokeWidth={1.5} />
              Alertes
            </h2>

            <span className="badge badge-ghost text-base-content/60">
              {alerts.length} en attente
            </span>
          </div>

          <ul className="divide-y divide-base-content/10">
            {alerts.map(({ tone, title, source, time }) => (
              <li key={title} className="flex items-center gap-3 py-3">
                <span
                  className={clsx("h-2 w-2 shrink-0 rounded-full", dotClass[tone])}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-base-content">
                    {title}
                  </p>
                  <p className="text-xs text-base-content/50">{source}</p>
                </div>

                <span className="flex shrink-0 items-center gap-1 text-xs text-base-content/40">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {time}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
