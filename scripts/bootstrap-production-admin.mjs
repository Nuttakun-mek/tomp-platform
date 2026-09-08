#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const argv = process.argv.slice(2);

const PERMISSIONS = [
  "project.read",
  "project.create",
  "project.update",
  "project.publish",
  "mission.read",
  "mission.create",
  "mission.update",
  "assignment.read",
  "assignment.create",
  "assignment.update",
  "driver.read",
  "driver.update",
  "vehicle.read",
  "vehicle.update",
  "timeline.read",
  "timeline.create",
  "admin.manage_users"
];

function argValue(name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function loadEnv() {
  const file = argValue("--env") || path.join(ROOT, ".env.vercel.production.local");
  const values = { ...process.env, ...parseEnvFile(file) };
  for (const key of Object.keys(values)) {
    if (values[key] === "") delete values[key];
  }
  return { file, values };
}

function normalizeConnectionString(raw) {
  return raw.replace(/:6543(\/|$|\?)/, ":5432$1");
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

async function findAuthUserByEmail(supabase, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (data.users.length < 100) break;
  }
  return null;
}

async function main() {
  const { file, values } = loadEnv();
  const supabaseUrl = values.SUPABASE_URL || values.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = values.SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SECRET_KEY;
  const dbUrl = values.SUPABASE_DB_URL || values.POSTGRES_URL || values.DATABASE_URL;
  const email = values.TOMP_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = values.TOMP_BOOTSTRAP_ADMIN_PASSWORD?.trim();
  const fullName = values.TOMP_BOOTSTRAP_ADMIN_NAME?.trim() || "ผู้ดูแลระบบ";

  if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
    console.error(`ERROR: ${file} must include SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL.`);
    process.exit(1);
  }
  if (!email) {
    console.error("ERROR: set TOMP_BOOTSTRAP_ADMIN_EMAIL before creating the first account. No account is hardcoded by design.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let user = await findAuthUserByEmail(supabase, email);
  if (!user) {
    const attrs = {
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { tomp_role: "super_admin", tomp_bootstrap: true }
    };
    if (password) attrs.password = password;
    const { data, error } = await supabase.auth.admin.createUser(attrs);
    if (error) throw error;
    user = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: { ...(user.app_metadata || {}), tomp_role: "super_admin", tomp_bootstrap: true }
    });
    if (error) throw error;
    user = data.user;
  }

  const sql = postgres(normalizeConnectionString(dbUrl), {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 20,
    ssl: "require",
    prepare: false,
    onnotice: () => {}
  });

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into public.organizations (id, name, organization_type, status, metadata)
        values ('00000000-0000-4000-8000-000000000001', 'TOMP Operations', 'operator', 'active', '{"bootstrap": true}'::jsonb)
        on conflict (id) do update set name = excluded.name, status = 'active'
      `;
      await tx`
        insert into public.profiles (id, auth_user_id, organization_id, full_name, email, status, metadata)
        values ('00000000-0000-4000-8000-000000000002', ${user.id}, '00000000-0000-4000-8000-000000000001', ${fullName}, ${email}, 'active', '{"bootstrap": true}'::jsonb)
        on conflict (id) do update
          set auth_user_id = excluded.auth_user_id,
              organization_id = excluded.organization_id,
              full_name = excluded.full_name,
              email = excluded.email,
              status = 'active'
      `;
      await tx`
        insert into public.roles (role_key, role_name, description)
        values ('super_admin', 'Super Admin', 'Platform administration')
        on conflict (role_key) do nothing
      `;
      for (const permission of PERMISSIONS) {
        await tx`
          insert into public.permissions (permission_key, permission_name)
          values (${permission}, ${permission})
          on conflict (permission_key) do nothing
        `;
      }
      await tx`
        insert into public.role_permissions (role_id, permission_id)
        select r.id, p.id
        from public.roles r
        cross join public.permissions p
        where r.role_key = 'super_admin'
        on conflict (role_id, permission_id) do nothing
      `;
      await tx`
        insert into public.user_role_assignments (profile_id, organization_id, role_id, status, metadata)
        select '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', r.id, 'active', '{"bootstrap": true}'::jsonb
        from public.roles r
        where r.role_key = 'super_admin'
      `;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`Bootstrap admin ready: ${maskEmail(email)}`);
  console.log(password ? "Password login can be used if Supabase password auth is enabled." : "Magic-link login can be used. No password was stored by this script.");
}

main().catch((error) => {
  console.error(`ERROR: ${error?.message || error}`);
  process.exit(1);
});
