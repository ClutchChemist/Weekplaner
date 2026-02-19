import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AuthUserInfo = {
  id: string;
  email: string | null;
};

let supabaseClient: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
}

function getSupabaseAnonKey(): string {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
}

function getCloudAuthRedirectUrl(): string {
  const envRedirect = String(import.meta.env.VITE_SUPABASE_REDIRECT_TO ?? "").trim();
  if (envRedirect) return envRedirect;

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getCloudSyncClient(): SupabaseClient | null {
  if (!isCloudSyncConfigured()) return null;
  if (supabaseClient) return supabaseClient;

  supabaseClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}

export async function getCurrentCloudUser(): Promise<AuthUserInfo | null> {
  const client = getCloudSyncClient();
  if (!client) return null;

  const { data, error } = await client.auth.getUser();
  if (error) throw error;

  const u = data.user;
  if (!u) return null;
  return { id: u.id, email: u.email ?? null };
}

export async function sendCloudMagicLink(email: string): Promise<void> {
  const client = getCloudSyncClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  const target = email.trim();
  if (!target) throw new Error("Missing email address.");

  const redirectTo = getCloudAuthRedirectUrl();
  try {
    new URL(redirectTo);
  } catch {
    throw new Error("Invalid cloud auth redirect URL. Check VITE_SUPABASE_REDIRECT_TO.");
  }

  const { error } = await client.auth.signInWithOtp({
    email: target,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOutCloud(): Promise<void> {
  const client = getCloudSyncClient();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function onCloudAuthStateChange(onEmailChange: (email: string | null) => void): () => void {
  const client = getCloudSyncClient();
  if (!client) return () => {};

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onEmailChange(session?.user?.email ?? null);
  });

  return () => data.subscription.unsubscribe();
}

export async function saveCloudSnapshot(profileId: string, snapshot: unknown): Promise<void> {
  const client = getCloudSyncClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  const user = await getCurrentCloudUser();
  if (!user) throw new Error("No authenticated cloud user.");

  const pid = profileId.trim();
  if (!pid) throw new Error("Missing profile id for cloud sync.");

  const { error } = await client.from("planner_profile_snapshots").upsert(
    {
      user_id: user.id,
      profile_id: pid,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,profile_id" }
  );

  if (error) throw error;
}

export async function loadCloudSnapshot(profileId: string): Promise<{ snapshot: unknown; updatedAt: string | null } | null> {
  const client = getCloudSyncClient();
  if (!client) throw new Error("Cloud sync is not configured.");

  const user = await getCurrentCloudUser();
  if (!user) throw new Error("No authenticated cloud user.");

  const pid = profileId.trim();
  if (!pid) throw new Error("Missing profile id for cloud sync.");

  const { data, error } = await client
    .from("planner_profile_snapshots")
    .select("snapshot, updated_at")
    .eq("user_id", user.id)
    .eq("profile_id", pid)
    .maybeSingle();

  if (error) throw error;
  if (!data?.snapshot) return null;

  return {
    snapshot: data.snapshot,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  };
}
