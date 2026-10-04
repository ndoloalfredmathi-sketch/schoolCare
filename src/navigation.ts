import {
  CalendarCheck,
  ChartColumn,
  GraduationCap,
  HeartPulse,
  House,
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

export const navigation: NavigationItem[] = [
  { to: "/", label: "Accueil", icon: House },
  { to: "/classes", label: "Classes", icon: GraduationCap },
  { to: "/eleves", label: "Élèves", icon: Users },
  { to: "/absences", label: "Absences", icon: CalendarCheck },
  { to: "/infirmerie", label: "Infirmerie", icon: HeartPulse },
  { to: "/parents", label: "Parents", icon: UsersRound },
  { to: "/rapports", label: "Rapports", icon: ChartColumn },
  { to: "/parametres", label: "Paramètres", icon: Settings },
];
