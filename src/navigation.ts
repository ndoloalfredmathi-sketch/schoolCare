import {
  CalendarX,
  ChartColumn,
  ChartPie,
  FileVolume,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  ReceiptEuro,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export type NavigationChild = {
  /** Libellé affiché dans le fil d'Ariane. */
  label: string;
  /** Chemin absolu de la sous-page. */
  to: string;
};

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  children?: NavigationChild[];
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    label: "Établissement",
    items: [
      { to: "/", label: "Accueil", icon: LayoutGrid },
      { to: "/classes", label: "Classes", icon: GraduationCap },
      {
        to: "/eleves",
        label: "Élèves",
        icon: Users,
        children: [
          { label: "Liste des élèves", to: "/eleves/liste" },
          { label: "Inscriptions", to: "/eleves/inscriptions" },
          { label: "Dossiers", to: "/eleves/dossiers" },
          { label: "Diplômés", to: "/eleves/diplomes" },
        ],
      },
    ],
  },
  {
    label: "Suivi santé",
    items: [
      { to: "/absences", label: "Absences", icon: CalendarX },
      { to: "/infirmerie", label: "Infirmerie", icon: HeartPulse },
      { to: "/parents", label: "Parents", icon: UsersRound },
    ],
  },
  {
    label: "Logistiques",
    items: [
      { to: "/statistiques", label: "Statistiques", icon: ChartPie },
      { to: "/salaires", label: "Suivi des salaires", icon: ReceiptEuro },
      { to: "/factures", label: "Suivi des factures", icon: FileVolume },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/rapports", label: "Rapports", icon: ChartColumn },
      { to: "/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];

export const navigation: NavigationItem[] = navigationSections.flatMap(
  (section) => section.items,
);
