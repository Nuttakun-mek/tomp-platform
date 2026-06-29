export function LoginPanel() {
  return (
    <section className="grid gap-5 rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Login</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Sprint 10 prepares Supabase Auth, project-scoped roles, and UI access awareness. Email and Google login are the first zero-cost options; enterprise SSO is deliberately deferred.
        </p>
      </div>
      <div className="grid gap-3 md:max-w-md">
        <input className="rounded-md border border-slate-300 px-3 py-2" placeholder="Email address" type="email" />
        <button className="rounded-md bg-operation px-4 py-2 text-sm font-semibold text-white" type="button">
          Continue with Email
        </button>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" type="button">
          Continue with Google
        </button>
        <p className="text-xs leading-5 text-slate-500">Authentication is not production-enabled yet. Keycloak and enterprise SSO are planned for a later hardening sprint.</p>
      </div>
    </section>
  );
}

