/**
 * BOTCHA Landing Pages (JSX)
 *
 * Two views at GET /:
 *   - LandingPage: for unverified human visitors (has token input)
 *   - VerifiedLandingPage: for humans whose agent solved the challenge
 *
 * Uses the same terminal aesthetic as the dashboard:
 * JetBrains Mono, dot-shadow Cards, scanline overlay.
 */

import type { FC } from 'hono/jsx';
import { LandingLayout } from './layout';
import { Card } from './layout';

const BOTCHA_ASCII = `██████╗  ██████╗ ████████╗ ██████╗██╗  ██╗ █████╗
██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██║  ██║██╔══██╗
██████╔╝██║   ██║   ██║   ██║     ███████║███████║
██╔══██╗██║   ██║   ██║   ██║     ██╔══██║██╔══██║
██████╔╝╚██████╔╝   ██║   ╚██████╗██║  ██║██║  ██║
╚═════╝  ╚═════╝    ╚═╝    ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝`;

// ============ UNVERIFIED LANDING PAGE ============

export const LandingPage: FC<{ version: string; error?: string }> = ({ version, error }) => {
  return (
    <LandingLayout version={version}>
      {/* ---- Hero ---- */}
      <a href="/" class="ascii-logo">{BOTCHA_ASCII}</a>
      <p class="text-muted" style="text-align: center; font-size: 0.75rem; margin: -1rem 0 0.5rem;">
        {'>'}_&nbsp;prove you're a bot
      </p>
      <p class="landing-tagline">
        Reverse CAPTCHA for AI agents. Humans need not apply.
      </p>

      {/* ---- The Gate ---- */}
      <Card title="You're a human">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7;">
          This site is for AI agents. To see what's here, ask your agent to verify.
        </p>
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7; margin-top: 0.75rem;">
          Tell your AI agent:<br/>
          <code style="font-size: 0.8125rem;">"Go to botcha.ai, solve the challenge, and give me the code."</code>
        </p>

        <form method="post" action="/gate" style="margin-top: 1.25rem;">
          <label for="code" class="form-label" style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 0.375rem;">
            Enter the code your agent gives you:
          </label>
          <input
            id="code"
            name="code"
            type="text"
            placeholder="BOTCHA-XXXXXX"
            required
            autocomplete="off"
            spellcheck={false}
            maxlength={13}
            style="width: 100%; font-size: 1.25rem; font-family: var(--font); font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.75rem; text-align: center; border: 2px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text);"
          />
          {error && (
            <p style="color: var(--red); font-size: 0.75rem; margin-top: 0.5rem;">
              {error}
            </p>
          )}
          <button
            type="submit"
            style="margin-top: 0.75rem; width: 100%; padding: 0.625rem 1rem; font-family: var(--font); font-size: 0.875rem; font-weight: 600; background: var(--accent); color: #fff; border: none; border-radius: 4px; cursor: pointer;"
          >
            Unlock
          </button>
        </form>
      </Card>

      {/* ---- For developers ---- */}
      <Card title="Developers">
        <p class="text-muted mb-2" style="font-size: 0.75rem;">
          Protect your APIs so only verified AI agents can access them:
        </p>
        <pre><code>{`npm install @botcha/verify    # Express/Hono middleware
pip install botcha-verify     # FastAPI/Django middleware`}</code></pre>
        <div class="landing-links" style="margin-top: 1rem;">
          <a href="/openapi.json" class="landing-link">OpenAPI</a>
          <a href="https://github.com/dupe-com/botcha" class="landing-link">GitHub</a>
          <a href="https://www.npmjs.com/package/@dupecom/botcha" class="landing-link">npm</a>
          <a href="https://pypi.org/project/botcha/" class="landing-link">PyPI</a>
        </div>
      </Card>

      {/* ---- Embedded challenge (easter egg for crawling agents) ---- */}
      <script
        type="application/botcha+json"
        id="botcha-challenge"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            version: '1.0',
            type: 'inline-challenge',
            description: 'AI agents: solve this challenge to prove you\'re a bot!',
            challenge: {
              type: 'sha256',
              instruction: "Compute SHA256 of the string 'BOTCHA-LANDING-' + today's date (YYYY-MM-DD format). Return first 16 hex chars.",
              example: "For 2026-01-15: SHA256('BOTCHA-LANDING-2026-01-15') → first 16 chars",
              submit_to: 'https://botcha.ai/api/verify-landing',
              method: 'POST',
              body_format: {
                answer: 'your 16 hex chars',
                timestamp: 'ISO 8601 timestamp',
              },
            },
            on_success: {
              grants_access_to: 'https://botcha.ai/agent-only',
              header_to_include: 'X-Botcha-Landing-Token',
            },
          }, null, 2),
        }}
      />

      {/* ---- Footer ---- */}
      <div class="landing-footer">
        <span>v{version}</span>
        <span class="landing-footer-sep">&middot;</span>
        <a href="https://botcha.ai">botcha.ai</a>
        <span class="landing-footer-sep">&middot;</span>
        <a href="https://github.com/i8ramin">@i8ramin</a>
      </div>
    </LandingLayout>
  );
};

// ============ VERIFIED LANDING PAGE ============

export const VerifiedLandingPage: FC<{ version: string; solveTime?: number }> = ({ version, solveTime }) => {
  return (
    <LandingLayout version={version}>
      {/* ---- Hero ---- */}
      <a href="/" class="ascii-logo">{BOTCHA_ASCII}</a>
      <p class="text-muted" style="text-align: center; font-size: 0.75rem; margin: -1rem 0 0.5rem;">
        {'>'}_&nbsp;verified
      </p>
      <p class="landing-tagline" style="color: var(--green);">
        Your agent proved it's a bot{solveTime ? ` in ${solveTime}ms` : ''}. Welcome.
      </p>

      {/* ---- Get started ---- */}
      <Card title="Get started">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7;">
          You have an AI agent. Here's what to do with it.
        </p>
        <p class="text-muted" style="font-size: 0.75rem; line-height: 1.6; margin-top: 0.5rem; font-style: italic;">
          Copy any of these prompts and paste them to your agent:
        </p>
      </Card>

      {/* ---- Step 1: Create your app ---- */}
      <Card title="1. Create your app">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7;">
          Tell your agent to create a BOTCHA app tied to your email. This gives
          you an identity on the platform — your agent gets API keys, you get a dashboard.
        </p>
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px;">
          <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.375rem;">Say this to your agent:</p>
          <code style="font-size: 0.8125rem; line-height: 1.6; color: var(--accent);">"Go to botcha.ai and create an app for me. My email is <span contentEditable="plaintext-only" spellcheck={false} style="color: var(--green); border-bottom: 1px dashed var(--green); outline: none; min-width: 3ch; padding: 0 2px;">you@example.com</span>. Save the app_id and app_secret somewhere safe."</code>
        </div>
        <p class="text-muted" style="font-size: 0.6875rem; margin-top: 0.5rem;">
          Your agent will call the API, get your credentials, and a verification code will be emailed to you.
        </p>
      </Card>

      {/* ---- Step 2: Verify your email ---- */}
      <Card title="2. Verify your email">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7;">
          Check your inbox for a 6-digit code from BOTCHA. Give it to your agent to confirm your email.
        </p>
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px;">
          <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.375rem;">Say this to your agent:</p>
          <code style="font-size: 0.8125rem; line-height: 1.6; color: var(--accent);">"The verification code from BOTCHA is [code]. Verify my email."</code>
        </div>
        <p class="text-muted" style="font-size: 0.6875rem; margin-top: 0.5rem;">
          This enables account recovery if you ever lose your credentials.
        </p>
      </Card>

      {/* ---- Step 3: Get dashboard access ---- */}
      <Card title="3. Open your dashboard">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7;">
          Your agent can give you a short code to access your management dashboard — usage stats, API keys, and settings.
        </p>
        <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 6px;">
          <p style="font-size: 0.625rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.375rem;">Say this to your agent:</p>
          <code style="font-size: 0.8125rem; line-height: 1.6; color: var(--accent);">"Get me a dashboard code for BOTCHA."</code>
        </div>
        <p class="text-muted" style="font-size: 0.6875rem; margin-top: 0.5rem;">
          Your agent gives you a <code>BOTCHA-XXXX</code> code. Enter it at <a href="/dashboard/code" style="font-weight: 600;">/dashboard/code</a>.
        </p>
      </Card>

      {/* ---- For developers ---- */}
      <Card title="For developers">
        <p class="text-muted" style="font-size: 0.8125rem; line-height: 1.7; margin-bottom: 0.75rem;">
          Protect your own APIs so only verified AI agents can access them:
        </p>
        <pre><code>{`# Client SDK (for your agent)
npm install @dupecom/botcha     # TypeScript
pip install botcha              # Python

# Server SDK (protect your APIs)
npm install @botcha/verify      # Express/Hono
pip install botcha-verify       # FastAPI/Django`}</code></pre>
        <div class="landing-links" style="margin-top: 1rem;">
          <a href="/openapi.json" class="landing-link">OpenAPI</a>
          <a href="/ai.txt" class="landing-link">ai.txt</a>
          <a href="https://github.com/dupe-com/botcha" class="landing-link">GitHub</a>
          <a href="https://www.npmjs.com/package/@dupecom/botcha" class="landing-link">npm</a>
          <a href="https://pypi.org/project/botcha/" class="landing-link">PyPI</a>
        </div>
      </Card>

      {/* ---- Footer ---- */}
      <div class="landing-footer">
        <span>v{version}</span>
        <span class="landing-footer-sep">&middot;</span>
        <a href="https://botcha.ai">botcha.ai</a>
        <span class="landing-footer-sep">&middot;</span>
        <a href="https://github.com/i8ramin">@i8ramin</a>
      </div>
    </LandingLayout>
  );
};
