import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CopyButton } from "@/components/copy-button";
import { requireSessionUser } from "@/server/session";
import { revokeApiToken } from "./actions";
import { CreateTokenForm } from "./token-form";

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export default async function SettingsPage() {
  const user = await requireSessionUser("/settings");
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  const openApiUrl = `${protocol}://${host}/mcp-openapi.json`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-semibold">設定</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold">APIトークン(ChatGPT連携用)</h2>
        <p className="mb-4 text-sm leading-6 text-[#4b4b45]">
          ChatGPTのCustom GPT Action から StoryCanon に接続する際に、Bearer トークンとして使用します。
        </p>
        <CreateTokenForm />
      </section>

      <section className="mb-8 rounded border border-[#dedbd2] bg-white p-6">
        <h2 className="mb-3 text-xl font-semibold">ChatGPTとの接続方法</h2>
        <p className="mb-3 text-sm leading-6 text-[#4b4b45]">
          StoryCanonは現時点ではChatGPTの「コネクタ」「MCPサーバー」設定には対応していません(将来対応予定)。
          今は<strong>Custom GPTのActions機能</strong>を使って接続します。
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[#4b4b45]">
          <li>上のフォームでAPIトークンを発行し、値をコピーする。</li>
          <li>ChatGPTで「GPTを作成する(Create a GPT)」を開き、「Configure」タブに移動する。</li>
          <li>
            「Actions」→「Create new action」→「Import from URL」を選び、次のURLを貼り付ける。
            <span className="mt-1 flex items-center gap-2">
              <code className="block flex-1 break-all rounded bg-[#f7f7f4] p-2 text-xs">{openApiUrl}</code>
              <CopyButton value={openApiUrl} />
            </span>
          </li>
          <li>
            「Authentication」を「API Key」に設定し、Auth Typeを「Bearer」にして、手順1でコピーしたトークンを貼り付ける。
          </li>
          <li>保存すれば、そのGPTから作品の作成・状態取得・本文保存などが行えるようになる。</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">発行済みトークン</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-[#4b4b45]">発行済みのトークンはありません。</p>
        ) : (
          <ul className="space-y-3">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between rounded border border-[#dedbd2] bg-white p-4"
              >
                <div>
                  <p className="font-medium text-[#1d1d1b]">{token.name}</p>
                  <p className="mt-1 text-xs text-[#4b4b45]">
                    {token.tokenPrefix}… ・作成日 {formatDate(token.createdAt)}
                    {token.lastUsedAt ? ` ・最終使用 ${formatDate(token.lastUsedAt)}` : ""}
                    {token.revokedAt ? ` ・失効済み(${formatDate(token.revokedAt)})` : ""}
                  </p>
                </div>
                {!token.revokedAt ? (
                  <form action={revokeApiToken}>
                    <input type="hidden" name="id" value={token.id} />
                    <button
                      className="rounded border border-red-600 px-3 py-2 text-sm text-red-600"
                      type="submit"
                    >
                      失効
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
