"use client";

import { useActionState, useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { getDictionary, type Locale } from "@/lib/i18n";
import { createApiToken, type CreateApiTokenState } from "@/app/settings/actions";
import { checkMcpConnection } from "@/app/settings/connection-actions";
import type { McpConnection } from "@/server/mcp-connection";

type TabId = "claude" | "claudeCode" | "chatgpt" | "other";

const TAB_ORDER: TabId[] = ["claude", "claudeCode", "chatgpt", "other"];

const initialTokenState: CreateApiTokenState = { error: null, token: null };

/** How often to re-ask whether a client has arrived. */
const POLL_MS = 4000;

type McpConnectProps = {
  locale: Locale;
  mcpUrl: string;
  openApiUrl: string;
  initialConnection: McpConnection;
  /** Hides the endpoint/tabs chrome down to essentials for the onboarding step. */
  compact?: boolean;
};

/**
 * The connection screen, ordered by how little work each route is rather than
 * by how the integrations were built: Claude's connector (paste a URL) comes
 * first, and the Custom GPT flow that needs five manual steps comes last.
 *
 * Two things here are the point. The finished `claude mcp add` command is
 * assembled with the token already in it — the token is shown exactly once, so
 * asking the user to splice it into a command from a paragraph of prose was
 * losing people. And the panel polls for the connection, so following the steps
 * ends in visible confirmation instead of silence.
 */
export function McpConnect({ locale, mcpUrl, openApiUrl, initialConnection, compact = false }: McpConnectProps) {
  const t = getDictionary(locale).settings.connect;
  const common = getDictionary(locale).common;
  const copyLabels = { copy: common.copy, copied: common.copied };

  const [tab, setTab] = useState<TabId>("claude");
  // ChatGPT has two genuinely different routes: developer mode talks MCP over
  // OAuth with nothing to copy, while a Custom GPT calls the REST shim with a
  // pasted token. They share nothing, so they get their own switch.
  const [chatgptMethod, setChatgptMethod] = useState<"oauth" | "actions">("oauth");
  const [tokenState, tokenAction, tokenPending] = useActionState(createApiToken, initialTokenState);
  const [connection, setConnection] = useState(initialConnection);

  // Stop polling once connected: the panel has nothing further to report, and
  // this runs on an interval for as long as the page is open.
  useEffect(() => {
    if (connection.connected) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const next = await checkMcpConnection();
        if (!cancelled && next.connected) setConnection(next);
      } catch {
        // A failed poll is not worth surfacing — the next one is 4s away.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connection.connected]);

  const tabLabels: Record<TabId, string> = {
    claude: t.tabClaude,
    claudeCode: t.tabClaudeCode,
    chatgpt: t.tabChatgpt,
    other: t.tabOther,
  };

  const needsToken =
    tab === "claudeCode" || tab === "other" || (tab === "chatgpt" && chatgptMethod === "actions");
  const command = `claude mcp add --transport http storycanon ${mcpUrl} --header "Authorization: Bearer ${
    tokenState.token ?? "<token>"
  }"`;

  /**
   * Per-tab instructions. Steps are rendered by position rather than spelled
   * out one <li> at a time, so a locale can add or drop a step without the
   * markup having to change with it. `endpointAtStep` / `commandAtStep` say
   * which step gets the copyable URL or the finished command underneath it.
   */
  const tabs: Record<
    TabId,
    {
      note: string;
      steps: readonly string[];
      prereq?: string;
      footnote?: string;
      endpoint?: string;
      endpointAtStep?: number;
      commandAtStep?: number;
    }
  > = {
    claude: {
      note: t.claudeNote,
      steps: t.claudeSteps,
      endpoint: mcpUrl,
      endpointAtStep: 1,
    },
    claudeCode: {
      note: t.claudeCodeNote,
      steps: [t.claudeCodeTokenStep, t.claudeCodeCommandStep],
      commandAtStep: 1,
    },
    chatgpt:
      chatgptMethod === "oauth"
        ? {
            note: t.chatgptOauthNote,
            steps: t.chatgptOauthSteps,
            prereq: t.chatgptOauthPrereq,
            endpoint: mcpUrl,
            endpointAtStep: 2,
          }
        : {
            note: t.chatgptNote,
            steps: t.chatgptSteps,
            prereq: t.chatgptPrereq,
            footnote: t.chatgptMcpNote,
            endpoint: openApiUrl,
            endpointAtStep: 4,
          },
    other: {
      note: t.otherNote,
      steps: t.otherSteps,
      endpoint: mcpUrl,
      endpointAtStep: 0,
    },
  };

  const active = tabs[tab];

  return (
    <div>
      {!compact ? (
        <>
          <h2 className="mb-1 text-xl font-semibold">{t.heading}</h2>
          <p className="mb-5 text-sm leading-6 text-[#4b4b45]">{t.lead}</p>
        </>
      ) : null}

      <ConnectionStatus t={t} connection={connection} />

      <div className="mb-5 mt-5 flex flex-wrap gap-2" role="tablist">
        {TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded border px-3 py-1.5 text-sm ${
              tab === id ? "border-[#1d1d1b] bg-[#1d1d1b] font-bold text-white" : "border-[#dedbd2] text-[#4b4b45]"
            }`}
          >
            {tabLabels[id]}
          </button>
        ))}
      </div>

      <div>
        {tab === "chatgpt" ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["oauth", t.chatgptMethodOauth, t.chatgptMethodRecommended],
                ["actions", t.chatgptMethodActions, null],
              ] as const
            ).map(([id, label, badge]) => (
              <button
                key={id}
                type="button"
                aria-pressed={chatgptMethod === id}
                onClick={() => setChatgptMethod(id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  chatgptMethod === id
                    ? "border-[#46605a] bg-[#e4eee8] font-bold text-[#315247]"
                    : "border-[#dedbd2] text-[#74746e]"
                }`}
              >
                {label}
                {badge ? <span className="ml-1.5 font-normal">({badge})</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">{active.note}</p>

        {active.prereq ? (
          <p className="mb-4 rounded border border-[#e6d9a8] bg-[#fbf7e8] p-3 text-sm leading-6 text-[#5c4f24]">
            {active.prereq}
          </p>
        ) : null}

        <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-[#4b4b45]">
          {active.steps.map((step, i) => (
            <li key={step}>
              {step}
              {active.endpoint && active.endpointAtStep === i ? (
                <Endpoint value={active.endpoint} labels={copyLabels} />
              ) : null}
              {active.commandAtStep === i ? (
                tokenState.token ? (
                  <span className="mt-1 flex items-start gap-2">
                    <code className="block flex-1 whitespace-pre-wrap break-all rounded bg-[#f7f7f4] p-2 text-xs">
                      {command}
                    </code>
                    <CopyButton value={command} labels={copyLabels} />
                  </span>
                ) : (
                  <span className="mt-1 block rounded border border-dashed border-[#dedbd2] p-2 text-xs text-[#74746e]">
                    {t.commandPending}
                  </span>
                )
              ) : null}
            </li>
          ))}
        </ol>

        {active.footnote ? (
          <p className="mt-4 text-xs leading-5 text-[#74746e]">{active.footnote}</p>
        ) : null}
      </div>

      {needsToken ? (
        <form action={tokenAction} className="mt-6 rounded border border-[#dedbd2] bg-[#fafaf8] p-4">
          <h3 className="mb-3 text-sm font-semibold">{t.tokenHeading}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="text-xs text-[#4b4b45]">{getDictionary(locale).settings.tokenNameLabel}</span>
              <input
                className="mt-1 w-full rounded border border-[#dedbd2] px-3 py-2 text-sm"
                name="name"
                placeholder={getDictionary(locale).settings.tokenNamePlaceholder}
                required
              />
            </label>
            <button
              className="rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white disabled:opacity-50"
              type="submit"
              disabled={tokenPending}
            >
              {getDictionary(locale).settings.issueButton}
            </button>
          </div>
          {tokenState.error ? <p className="mt-2 text-sm text-red-600">{tokenState.error}</p> : null}
          {tokenState.token ? (
            <div className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm">
              <p className="font-medium">{getDictionary(locale).settings.revealWarning}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="block flex-1 break-all rounded bg-white p-2 text-xs">{tokenState.token}</code>
                <CopyButton value={tokenState.token} labels={copyLabels} />
              </div>
            </div>
          ) : null}
        </form>
      ) : null}

      <p className="mt-5 text-xs leading-5 text-[#74746e]">{t.helpTip}</p>
    </div>
  );
}

function Endpoint({ value, labels }: { value: string; labels: { copy: string; copied: string } }) {
  return (
    <span className="mt-1 flex items-center gap-2">
      <code className="block flex-1 break-all rounded bg-[#f7f7f4] p-2 text-xs">{value}</code>
      <CopyButton value={value} labels={labels} />
    </span>
  );
}

function ConnectionStatus({
  t,
  connection,
}: {
  t: ReturnType<typeof getDictionary>["settings"]["connect"];
  connection: McpConnection;
}) {
  if (connection.connected) {
    return (
      <div className="rounded border border-[#9bbcae] bg-[#f0f5f2] p-4">
        <p className="text-sm font-semibold text-[#315247]">{t.statusConnected}</p>
        {connection.label ? (
          <p className="mt-1 text-xs text-[#4b4b45]">
            {t.statusConnectedVia} <span className="font-medium">{connection.label}</span>
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-[#4b4b45]">{t.statusNext}</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-[#dedbd2] bg-[#fafaf8] p-4">
      <p className="flex items-center gap-2 text-sm text-[#4b4b45]">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#c9a227]" aria-hidden />
        {t.statusWaiting}
      </p>
      <p className="mt-1 text-xs text-[#74746e]">{t.statusWaitingHint}</p>
    </div>
  );
}
