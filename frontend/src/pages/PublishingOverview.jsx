import React from 'react';

const navItems = [
  'Dashboard',
  'Statistics',
  'Publishing overview',
  'Protected with Play',
  'Test and release',
  'Monitor and improve',
  'Grow users',
  'Monetize with Play',
];

function AppLogo() {
  return (
    <div className="play-console-brand" aria-label="Google Play Console logo">
      <span className="play-console-logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path d="M3.6 4.2c-.4.4-.7 1-.7 1.7v12.2c0 .7.3 1.3.7 1.7l8.4-8.2-8.4-8.4Zm9.8 8.9 3.6-3.5-8.7-5-3.8 3.7 8.9 4.8Zm5.1-2.8 2.8-1.5c1.3-.7 1.3-2.4 0-3.1l-2.9-1.6-3.1 3 3.2 3.2Zm-3.2 3.1-3.6 3.5 8.9 4.8 3.8-3.7-9.1-4.6Z" />
        </svg>
      </span>
      <span className="play-console-brand-text">Google Play Console</span>
    </div>
  );
}

function ToolbarIcon({ children }) {
  return <span className="play-console-toolbar-icon">{children}</span>;
}

export default function PublishingOverview() {
  return (
    <div className="play-console-shell">
      <header className="play-console-topbar">
        <div className="play-console-topbar-left">
          <AppLogo />
        </div>

        <div className="play-console-topbar-right">
          <button type="button" className="play-console-header-action play-console-header-action--ghost">
            <ToolbarIcon>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6 6 0 0 0-6 6v1.2c0 .6-.2 1.1-.6 1.5L4 12.5V14h16v-1.5l-1.4-1.3c-.4-.4-.6-.9-.6-1.5V8.5a6 6 0 0 0-6-6Zm0 19a2.8 2.8 0 0 1-2.7-2h5.4A2.8 2.8 0 0 1 12 21.5Z" /></svg>
            </ToolbarIcon>
            <span>Unread notifications</span>
          </button>

          <div className="play-console-account-badge" aria-label="User account">
            <div className="play-console-account-avatar">LPG</div>
            <div className="play-console-account-meta">
              <span className="play-console-account-name">LPG Fleet Driver</span>
            </div>
          </div>
        </div>
      </header>

      <div className="play-console-layout">
        <aside className="play-console-sidebar">
          <button type="button" className="play-console-back-button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3 8.9 12l5.8 5.7-1.4 1.4-7.2-7.1 7.2-7.1 1.4 1.4Z" /></svg>
            All apps
          </button>

          <nav className="play-console-nav" aria-label="Main menu">
            {navItems.map((item, index) => {
              const isActive = item === 'Publishing overview';
              const isMuted = item === 'Dashboard' || item === 'Statistics';
              return (
                <button
                  key={item}
                  type="button"
                  className={`play-console-nav-item ${isActive ? 'is-active' : ''} ${isMuted ? 'is-muted' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item === 'Dashboard' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zm9 0h7v4h-7zm0 6h7v10h-7zM4 13h7v7H4z" /></svg>
                  ) : item === 'Statistics' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.5V10h2v8.5zm6 0V5h2v13.5zm6 0V8h2v10.5z" /></svg>
                  ) : item === 'Publishing overview' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v15A2.5 2.5 0 0 1 16.5 22h-9A2.5 2.5 0 0 1 5 19.5v-15Zm2.5 2.2h9M7.5 9h9m-9 3.5h9m-9 3.5h5.5" /></svg>
                  ) : item === 'Protected with Play' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 18 5v5.4c0 3.9-2.2 7.6-6 9.2-3.8-1.6-6-5.3-6-9.2V5l6-2.5Zm0 4.5 2.7 2.2-1 2.8-2.7-1.4-2.7 1.4-1-2.8L12 7Z" /></svg>
                  ) : item === 'Test and release' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a8 8 0 0 1 8 8v4.2l2.4 4.8h-6.7A3.5 3.5 0 0 1 12 19a3.5 3.5 0 0 1-3.7 3.5H2.6L5 15.5V10.5a8 8 0 0 1 7-8Zm0 4.8a3.7 3.7 0 0 0-3.7 3.7v5.5h7.4v-5.5A3.7 3.7 0 0 0 12 7.3Z" /></svg>
                  ) : item === 'Monitor and improve' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5h16M7 15l3.2-4.6 2.5 2.7L17 7l2 1.2-5 7.1-2.6-2.8L7 18.5Z" /></svg>
                  ) : item === 'Grow users' ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10.5A2.5 2.5 0 1 0 7 5.5a2.5 2.5 0 0 0 0 5Zm10 0A2.5 2.5 0 1 0 17 5.5a2.5 2.5 0 0 0 0 5Zm-10 1.7c-2.3 0-4 1.4-4 3.6V18h8v-2.2c0-2.2-1.7-3.6-4-3.6Zm10 0c-1.9 0-3.4 1-4 2.3.7.6 1.8 1.4 4 1.4s3.3-.8 4-1.4c-.6-1.3-2.1-2.3-4-2.3Z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 1 0 9.5 9.5A9.5 9.5 0 0 0 12 2.5Zm0 3.2a1.6 1.6 0 1 1-1.6 1.6A1.6 1.6 0 0 1 12 5.7Zm1.6 11.8h-3.2v-1.8h1.2V10.7H10.4V9h2.6v6.7h1.6Z" /></svg>
                  )}
                  <span>{item}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="play-console-main">
          <section className="play-console-headline">
            <h1>Publishing overview</h1>
            <p>
              See an overview of the changes made to your app, and control when changes are sent for review or published.
              <button type="button" className="play-console-inline-link">Show more</button>
            </p>
          </section>

          <div className="play-console-toolbar">
            <button type="button" className="play-console-primary-action">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a7.5 7.5 0 0 1 7.5 7.5v1.5H19V10a7 7 0 1 0-14 0v1.5h-.5V10A7.5 7.5 0 0 1 12 2.5ZM7 16.5h10a2 2 0 0 1 2 2v1.5H5v-1.5a2 2 0 0 1 2-2Z" /></svg>
              Managed publishing
              <svg className="play-console-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 9.5 12 14l4.6-4.5 1.4 1.4L12 16.8 6 10.9l1.4-1.4Z" /></svg>
            </button>

            <div className="play-console-published-meta">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 1 1-9.5 9.5A9.5 9.5 0 0 1 12 2.5Zm.5 4.2v6.1l4.8 2.8-1 1.7-5.8-3.3V6.7Z" /></svg>
              <span>Last published on October 17, 2026</span>
              <button type="button" className="play-console-link-button">Submission activity →</button>
            </div>
          </div>

          <section className="play-console-section">
            <div className="play-console-section-header">
              <h2>Changes ready to publish</h2>
              <button type="button" className="play-console-ghost-action">
                Show
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 9.5 12 14l4.6-4.5 1.4 1.4L12 16.8 6 10.9l1.4-1.4Z" /></svg>
              </button>
            </div>
          </section>

          <section className="play-console-section play-console-section--review">
            <div className="play-console-review-row">
              <h2>Changes not yet submitted for review</h2>
              <button type="button" className="play-console-submit-button">
                Submit change for review
              </button>
            </div>

            <div className="play-console-review-info">
              <div className="play-console-review-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a9.5 9.5 0 1 1-9.5 9.5A9.5 9.5 0 0 1 12 2.5Zm1 6.2h-2V14h2Zm0 6.6h-2v2h2Z" /></svg>
              </div>
              <p>
                Your changes can now be sent for review. We may find additional issues when reviewing your app.
              </p>
              <button type="button" className="play-console-link-button">Learn more</button>
            </div>

            <div className="play-console-table-wrap">
              <table className="play-console-table" aria-label="Changes pending review">
                <thead>
                  <tr>
                    <th>Item changed</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="play-console-item-cell">
                      <span className="play-console-item-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M11 3.5h2v3h-2zm0 13.5h2v3h-2zM3.5 11h3v2h-3zm13.5 0h3v2h-3zM5.3 7.5l1.4-1.4 1.4 1.4-1.4 1.4zm10.6 9.1 1.4-1.4 1.4 1.4-1.4 1.4zm-1.4-10.7 1.4 1.4-1.4 1.4-1.4-1.4zm-9.1 9.1 1.4 1.4-1.4 1.4-1.4-1.4Z" /></svg>
                      </span>
                      <span>Production</span>
                    </td>
                    <td className="play-console-version-cell">
                      <span className="play-console-version-label">15 (1.0.0)</span>
                      <span>Start full rollout</span>
                    </td>
                    <td className="play-console-action-cell">
                      <button type="button" className="play-console-table-menu" aria-label="More actions">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.3a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm0 6.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm0 6.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" /></svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
