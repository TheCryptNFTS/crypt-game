export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Account and progression — layout only until backend APIs exist.
        </p>
      </div>

      <div className="rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-6">
        <div className="text-sm text-zinc-400">
          {/* TODO: Load display name when user/session API is exposed */}
          Display name
        </div>
        <div className="mt-4 h-24 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30" />
      </div>

      <div className="rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-6">
        <div className="text-sm text-zinc-400">
          {/* TODO: Show rank or ladder stats when competitive API is exposed */}
          Ranked stats
        </div>
        <div className="mt-4 h-20 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30" />
      </div>

      <div className="rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-6">
        <div className="text-sm text-zinc-400">
          {/* TODO: Wallet-linked inventory when on-chain or custody API is exposed */}
          Linked wallets
        </div>
        <div className="mt-4 h-16 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30" />
      </div>
    </div>
  );
}
