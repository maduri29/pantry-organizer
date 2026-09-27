import React, { useEffect, useRef } from 'react';

interface HeaderProps {
  online: boolean;
  authCheck: boolean;
  profileOpen: boolean;
  onToggleProfile: () => void;
  onCloseProfile: () => void;
  onExport: () => void;
  onImport?: (file: File) => void;
  onConnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  online,
  authCheck,
  profileOpen,
  onToggleProfile,
  onCloseProfile,
  onExport,
  onImport,
  onConnect
}) => {
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) {
      onImport(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (profileOpen) {
      const item = profileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
      item?.focus();
    }
  }, [profileOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && document.activeElement?.id === 'profile-button') {
        e.preventDefault();
        if (!profileOpen) onToggleProfile();
        setTimeout(() => {
          profileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        }, 10);
        return;
      }
      if (e.key === 'Escape' && profileOpen) {
        e.preventDefault();
        onCloseProfile();
        profileButtonRef.current?.focus();
        return;
      }
      if (
        (e.key === 'ArrowDown' || e.key === 'ArrowUp') &&
        (document.activeElement as HTMLElement)?.matches?.('#profile-menu [role="menuitem"]')
      ) {
        e.preventDefault();
        (document.activeElement as HTMLElement).focus();
      }
    };

    const handleGlobalClick = (e: MouseEvent) => {
      if (profileOpen && !(e.target as HTMLElement).closest('.profile-wrap')) {
        onCloseProfile();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [profileOpen, onToggleProfile, onCloseProfile]);

  return (
    <header>
      <div className="brand">
        <span className="mark">♧</span> pantry<span className="subtitle">a little less waste.</span>
      </div>
      <div className="header-actions">
        <button
          className="icon-button"
          type="button"
          data-action="export"
          aria-label="Export pantry data"
          title="Export pantry data"
          onClick={onExport}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 19h14" />
          </svg>
        </button>
        {onImport && (
          <>
            <button
              className="icon-button"
              type="button"
              data-action="import"
              aria-label="Import pantry backup"
              title="Import pantry backup"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 21v-12m0 0 5 5m-5-5-5 5M5 5h14" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </>
        )}
        <div className="profile-wrap">
          <button
            ref={profileButtonRef}
            id="profile-button"
            className="icon-button"
            type="button"
            data-action="profile"
            aria-label="Profile"
            title="Profile"
            aria-haspopup="menu"
            aria-expanded={profileOpen ? 'true' : 'false'}
            aria-controls="profile-popover"
            onClick={onToggleProfile}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
          </button>
          <div id="profile-popover" className="profile-popover" hidden={!profileOpen}>
            <p
              id="connection-status"
              role="status"
              aria-label="Connection status"
              aria-live="polite"
            >
              {online
                ? 'Shared pantry connected · saves online'
                : authCheck
                  ? 'Checking saved pantry session…'
                  : window.PANTRY_CONFIG?.firebase?.apiKey
                    ? 'Signed out · local demo only'
                    : 'Local demo · Firebase setup needed'}
            </p>
            <div ref={profileMenuRef} id="profile-menu" role="menu" aria-label="Profile">
              <button type="button" role="menuitem" data-action="connect" onClick={onConnect}>
                {online
                  ? 'Sign out'
                  : window.PANTRY_CONFIG?.firebase?.apiKey
                    ? 'Sign in'
                    : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
