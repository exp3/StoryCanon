import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getDictionary } from "@/lib/i18n";
import { getSessionUser } from "@/server/session";
import { canonicalResource, isRegisteredRedirectUri, normalizeScope } from "@/server/oauth";
import { serverOrigin } from "@/server/oauth-http";
import { findClient } from "@/server/oauth-store";
import { approveAuthorization, denyAuthorization } from "./actions";

/**
 * The OAuth 2.1 authorization endpoint and its consent screen.
 *
 * Validation happens in two stages on purpose. Anything wrong with the client
 * or the redirect URI is shown on this page and never redirected anywhere —
 * the request has not proven where it came from. Only once the redirect URI is
 * known-registered may an error be handed back to it.
 */

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function ErrorPage({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-10">
      <section className="w-full rounded border border-red-300 bg-red-50 p-6">
        <h1 className="text-xl font-semibold text-red-800">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-red-700">{detail}</p>
      </section>
    </main>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const origin = serverOrigin(new Request(`${proto}://${host}/oauth/authorize`, { headers: headerList }));

  const user = await getSessionUser();
  const t = getDictionary(user?.locale ?? "en").oauthConsent;

  const clientId = one(params, "client_id") ?? "";
  const redirectUri = one(params, "redirect_uri") ?? "";
  const responseType = one(params, "response_type") ?? "";
  const codeChallenge = one(params, "code_challenge") ?? "";
  const codeChallengeMethod = one(params, "code_challenge_method") ?? "";
  const state = one(params, "state") ?? "";
  const resource = one(params, "resource") ?? "";
  const scope = normalizeScope(one(params, "scope"));

  // Stage one: never redirect anywhere we have not verified.
  const client = await findClient(clientId);
  if (!client) return <ErrorPage title={t.invalidClientTitle} detail={t.invalidClientDetail} />;
  if (!redirectUri || !isRegisteredRedirectUri(redirectUri, client.redirectUris)) {
    return <ErrorPage title={t.invalidRedirectTitle} detail={t.invalidRedirectDetail} />;
  }

  // Stage two: the redirect URI is registered, so protocol errors go back to it.
  const callbackError = (error: string, description: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    url.searchParams.set("iss", origin);
    redirect(url.toString());
  };

  if (responseType !== "code") callbackError("unsupported_response_type", "Only the code response type is supported.");
  if (codeChallengeMethod !== "S256") callbackError("invalid_request", "code_challenge_method must be S256.");
  if (!codeChallenge) callbackError("invalid_request", "code_challenge is required.");
  if (!scope) callbackError("invalid_scope", "None of the requested scopes are supported.");

  if (!user) {
    // Come back to this exact authorization request after signing in.
    const self = new URL(`${origin}/oauth/authorize`);
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") self.searchParams.set(key, value);
    }
    redirect(`/login?next=${encodeURIComponent(`${self.pathname}${self.search}`)}`);
  }

  const scopeLabels: Record<string, string> = {
    "storycanon:read": t.scopeRead,
    "storycanon:write": t.scopeWrite,
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-md items-center px-6 py-10">
      <section className="w-full rounded border border-[#dedbd2] bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[#1d1d1b]">{t.title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#4b4b45]">
          {t.intro}
          <span className="mt-2 block break-all font-medium text-[#1d1d1b]">{client.clientName || client.clientId}</span>
        </p>

        <ul className="mt-4 space-y-2 rounded border border-[#ece8dd] bg-[#faf9f5] p-4 text-sm leading-6 text-[#4b4b45]">
          {scope.split(" ").map((item) => (
            <li key={item}>・{scopeLabels[item] ?? item}</li>
          ))}
        </ul>

        <p className="mt-4 text-sm leading-6 text-[#4b4b45]">
          {t.accountLabel} <span className="font-medium text-[#1d1d1b]">{user.email}</span>
        </p>
        <p className="mt-2 text-xs leading-5 text-[#666]">{t.redirectLabel}</p>
        <code className="mt-1 block break-all rounded bg-[#f7f7f4] p-2 text-xs">{redirectUri}</code>

        <form className="mt-6 flex gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="code_challenge" value={codeChallenge} />
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="resource" value={canonicalResource(resource) ?? ""} />
          <button
            className="flex-1 rounded border border-[#dedbd2] px-4 py-2 text-sm text-[#1d1d1b]"
            type="submit"
            formAction={denyAuthorization}
          >
            {t.deny}
          </button>
          <button className="flex-1 rounded bg-[#1d1d1b] px-4 py-2 text-sm text-white" type="submit" formAction={approveAuthorization}>
            {t.approve}
          </button>
        </form>

        <p className="mt-4 text-xs leading-5 text-[#666]">{t.revokeHint}</p>
      </section>
    </main>
  );
}
