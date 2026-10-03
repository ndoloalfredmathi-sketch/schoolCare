import { TitleBarButton } from "./TitleBarButton";
import { Copy, Minus, Square, X } from "lucide-react";
import { useIsMaximized } from "../hooks/useIsMaximized";

function TitleBar() {
  const isMaximized = useIsMaximized();

  const handleMaximize = () => {
    window.electronWindow.maximize();
  };

  return (
    <header className="flex h-10 select-none items-center border-b border-slate-700 bg-[#181818] text-sm text-slate-300">
      {/* Zone déplaçable */}
      <div className="flex h-full flex-1 items-center gap-3 px-3 [-webkit-app-region:drag]">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
          S
        </div>

        <span className="font-medium">
          SchoolCare
        </span>

        <span className="text-slate-500">
          —
        </span>

        <span className="text-slate-400">
          Tableau de bord
        </span>
      </div>

      {/* Boutons non déplaçables */}
      <div className="flex h-full [-webkit-app-region:no-drag]">
        <TitleBarButton
          label="Réduire"
          onClick={() => window.electronWindow.minimize()}
          icon={<Minus className="h-5 w-5" strokeWidth={1.5} />}
        />

        <TitleBarButton
          label={isMaximized ? "Restaurer" : "Agrandir"}
          onClick={handleMaximize}
          icon={
            isMaximized ? (
              <Copy className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Square className="h-4 w-4" strokeWidth={1.5} />
            )
          }
        />

        <TitleBarButton
          label="Fermer"
          variant="danger"
          onClick={() => window.electronWindow.close()}
          icon={<X className="h-5 w-5" strokeWidth={1.5} />}
        />
      </div>
    </header>
  );
}

export default TitleBar;
