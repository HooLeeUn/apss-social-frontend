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
      className="group relative w-full max-w-[220px] rounded-xl border border-white/20 bg-zinc-950/95 p-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70"
    >
      <span
        className={`block h-7 w-full origin-left rounded-lg border border-white/15 bg-[repeating-linear-gradient(135deg,rgba(24,24,27,0.95)_0px,rgba(24,24,27,0.95)_16px,rgba(212,212,216,0.9)_16px,rgba(212,212,216,0.9)_24px)] shadow-[0_6px_14px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-out ${
          isOpen ? "-rotate-[3deg] translate-y-[1px]" : "rotate-0 translate-y-0"
        }`}
      />
      <span className="mt-2 block px-1 text-center text-xs tracking-[0.24em] text-zinc-300/90">
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
    <div ref={menuRef} className="relative w-full max-w-[220px]">
      <DirectorBoardToggle isOpen={isOpen} onClick={onToggle} />

      <div
        id="director-board-panel"
        className={`absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/15 bg-zinc-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition-all duration-300 ${
          isOpen ? "pointer-events-auto max-h-72 translate-y-0 opacity-100" : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
        }`}
      >
        <ul className="divide-y divide-white/10">
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Datos Personales
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Políticas y Términos
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleMenuOptionClick}
              className="w-full px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              Privacidad y Seguridad
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleCloseSessionClick}
              className="w-full px-4 py-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
            >
              Cerrar Sesión
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
