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

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
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
      { to: "/eleves", label: "Élèves", icon: Users },
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

export const periodTabs = ["Aujourd'hui", "Semaine", "Mois"];
