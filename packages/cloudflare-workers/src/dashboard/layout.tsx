/**
 * BOTCHA Dashboard Layout + Shared Components
 * Hono JSX components for HTML shells and reusable UI pieces
 * Terminal / ASCII aesthetic
 */

import type { FC, PropsWithChildren } from 'hono/jsx';
import { DASHBOARD_CSS } from './styles';

// ============ CARD COMPONENT ============

/**
 * Reusable card with Turbopuffer-style dotted drop shadow.
 *
 * Structure:
 *   .card
 *     .card-header  (title sits on the border line)
 *     .card-body    (::before = dot shadow)
 *       .card-inner (z-index: 1, white bg covers dots)
 *
 * Usage:
 *   <Card title="Overview" badge="agent required">
 *     ...content...
 *   </Card>
 */
export const Card: FC<PropsWithChildren<{ title: string; badge?: string; class?: string }>> = ({
  children,
  title,
  badge,
  class: className,
}) => {
  return (
    <div class={`card${className ? ` ${className}` : ''}`}>
      <div class="card-header">
        <h3>
          <span class="card-title">{title}</span>
          {badge && <span class="badge-inline">{badge}</span>}
        </h3>
      </div>
      <div class="card-body">
        <div class="card-inner">{children}</div>
      </div>
    </div>
  );
};

/**
 * Divider with centered text, used between sections on auth pages.
 */
export const Divider: FC<{ text: string }> = ({ text }) => (
  <div class="divider">{text}</div>
);

/**
 * Main dashboard layout with navigation
 * Used for authenticated dashboard pages
 */
export const DashboardLayout: FC<PropsWithChildren<{ title?: string; appId?: string }>> = ({ children, title, appId }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title || 'BOTCHA Dashboard'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />
        <script src="https://unpkg.com/htmx.org@2.0.4" />
      </head>
      <body>
        <nav class="dashboard-nav">
          <div class="nav-container">
            <a href="/dashboard" class="nav-logo">
              BOTCHA
            </a>
            {appId && (
              <>
                <span class="nav-app-id">{appId}</span>
                <a href="/dashboard/logout" class="nav-link">
                  Logout
                </a>
              </>
            )}
          </div>
        </nav>
        <main class="dashboard-main">{children}</main>
      </body>
    </html>
  );
};

/**
 * Login/auth layout without navigation
 * Used for login, signup, and other auth pages
 */
export const LoginLayout: FC<PropsWithChildren<{ title?: string }>> = ({ children, title }) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title || 'BOTCHA Login'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: DASHBOARD_CSS }} />
        <script src="https://unpkg.com/htmx.org@2.0.4" />
      </head>
      <body>
        <div class="login-container">
          <div class="login-box">{children}</div>
        </div>
      </body>
    </html>
  );
};
