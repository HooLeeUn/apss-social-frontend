import { useEffect, useRef } from "react";

interface DirectorBoardMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCloseSession?: () => void;
}

interface DirectorBoardToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

function DirectorBoardToggle({ isOpen, onClick }: DirectorBoardToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls="director-board-panel"
      aria-label="Abrir menú de perfil"
      className="group relative w-full rounded-2xl border border-white/20 bg-zinc-950/95 px-2.5 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
    >
      <span
        className={`mx-auto block h-4 w-[calc(100%-12px)] origin-[10%_15%] rounded-xl border border-white/20 bg-[repeating-linear-gradient(135deg,rgba(24,24,27,0.95)_0px,rgba(24,24,27,0.95)_14px,rgba(212,212,216,0.9)_14px,rgba(212,212,216,0.9)_22px)] shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "-rotate-[10deg] -translate-y-[1px] translate-x-[2px]" : "rotate-0 translate-y-0 translate-x-0"
        }`}
      />
      <span className="mx-auto mt-1.5 block h-6.5 w-[calc(100%-20px)] rounded-lg border border-white/15 bg-zinc-900/95 px-3.5 text-center text-[0.65rem] font-medium leading-[1.65rem] tracking-[0.24em] text-zinc-300/90">
        MENU
      </span>
    </button>
  );
}

export default function DirectorBoardMenu({ isOpen, onToggle, onClose, onCloseSession }: DirectorBoardMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || menuRef.current?.contains(target)) return;
      onClose();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const handleMenuOptionClick = () => {
    onClose();
  };

  const handleCloseSessionClick = () => {
    onClose();
    onCloseSession?.();
  };

  return (
    <div ref={menuRef} className="relative w-[198px]">
      <DirectorBoardToggle isOpen={isOpen} onClick={onToggle} />

      <div
        id="director-board-panel"
        className={`absolute left-1/2 top-full z-50 mt-2 w-[198px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition-all duration-300 ${
          isOpen ? "pointer-events-auto max-h-80 translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
        }`}
      >
        <ul className="divide-y divide-white/10">
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Datos Personales
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Políticas y Términos
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Privacidad y Seguridad
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleCloseSessionClick}
              className="w-full px-3 py-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
            >
              Cerrar Sesión
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
