import { useEffect, useRef } from "react";

interface DirectorBoardMenuProps {
  locale?: "es" | "en";
  mobileIconOnly?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCloseSession?: () => void;
  onPrivacySecurityClick?: () => void;
  onPersonalDataClick?: () => void;
  onPoliciesClick?: () => void;
}

interface DirectorBoardToggleProps {
  isOpen: boolean;
  onClick: () => void;
  mobileIconOnly?: boolean;
}

function DirectorBoardToggle({ isOpen, onClick, mobileIconOnly = false }: DirectorBoardToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls="director-board-panel"
      aria-label="Abrir menú de perfil"
      className={`group relative w-full bg-zinc-950/95 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300/70 ${
        mobileIconOnly
          ? "rounded-xl border-0 px-1.5 py-1.5 shadow-none hover:bg-zinc-900/90 lg:rounded-2xl lg:border lg:border-white/20 lg:px-2.5 lg:py-2 lg:shadow-[0_10px_28px_rgba(0,0,0,0.4)] lg:hover:border-white/40"
          : "rounded-2xl border border-white/20 px-2.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] hover:border-white/40"
      }`}
    >
      <span
        className={`mx-auto block ${mobileIconOnly ? "h-3.5 w-10 lg:h-4 lg:w-[calc(100%-12px)]" : "h-4 w-[calc(100%-12px)]"} origin-[10%_15%] rounded-xl border border-white/20 bg-[repeating-linear-gradient(135deg,rgba(24,24,27,0.95)_0px,rgba(24,24,27,0.95)_14px,rgba(212,212,216,0.9)_14px,rgba(212,212,216,0.9)_22px)] shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isOpen ? "-rotate-[10deg] -translate-y-[1px] translate-x-[2px]" : "rotate-0 translate-y-0 translate-x-0"
        }`}
      />
      {!mobileIconOnly ? (
        <span className="mx-auto mt-1.5 block h-6.5 w-[calc(100%-20px)] rounded-lg border border-white/15 bg-zinc-900/95 px-3.5 text-center text-[0.65rem] font-medium leading-[1.65rem] tracking-[0.24em] text-zinc-300/90">
          MENU
        </span>
      ) : null}
    </button>
  );
}

export default function DirectorBoardMenu({
  isOpen,
  onToggle,
  onClose,
  onCloseSession,
  onPrivacySecurityClick,
  onPersonalDataClick,
  onPoliciesClick,
  locale = "es",
  mobileIconOnly = false,
}: DirectorBoardMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-director-board-menu-root]")) return;
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

  const handlePoliciesClick = () => {
    onClose();
    onPoliciesClick?.();
  };

  const handlePersonalDataClick = () => {
    onClose();
    onPersonalDataClick?.();
  };

  const handlePrivacySecurityClick = () => {
    onClose();
    onPrivacySecurityClick?.();
  };

  const handleCloseSessionClick = () => {
    onClose();
    onCloseSession?.();
  };

  return (
    <div ref={menuRef} data-director-board-menu-root className={`relative ${mobileIconOnly ? "w-14 lg:w-[198px]" : "w-[198px]"}`}>
      <DirectorBoardToggle isOpen={isOpen} onClick={onToggle} mobileIconOnly={mobileIconOnly} />

      <div
        id="director-board-panel"
        className={`absolute left-1/2 top-full z-50 mt-2 w-[198px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/15 bg-zinc-950/95 shadow-[0_12px_30px_rgba(0,0,0,0.42)] transition-all duration-300 ${
          isOpen
            ? "pointer-events-auto max-h-80 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-2 opacity-0"
        }`}
      >
        <ul className="divide-y divide-white/10">
          <li>
            <button
              type="button"
              onClick={handlePersonalDataClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              {locale === "en" ? "Personal Data" : "Datos Personales"}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handlePoliciesClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              {locale === "en" ? "Policies & Terms" : "Políticas y Términos"}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handlePrivacySecurityClick}
              className="w-full px-3 py-3 text-left text-sm text-zinc-200 transition-colors hover:bg-white/5"
            >
              {locale === "en" ? "Privacy & Security" : "Privacidad y Seguridad"}
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={handleCloseSessionClick}
              className="w-full px-3 py-3 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
            >
              {locale === "en" ? "Log Out" : "Cerrar Sesión"}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
