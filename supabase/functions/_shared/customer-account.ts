// Automatically gives a buyer a "Minha Conta" login the moment their payment
// is confirmed - no signup step at checkout. Reuses the exact same
// mechanism manage-admins already uses to invite admins
// (supabase.auth.admin.inviteUserByEmail): it creates the auth user and
// sends Supabase's built-in invite email with a link for the buyer to set
// their OWN password - we never generate or see a password ourselves.
export async function ensureCustomerAccount(supabase: any, email: string) {
  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const exists = usersList.users.some((u: any) => u.email?.toLowerCase() === email.toLowerCase());
  if (exists) return; // Repeat buyer - already has an account, don't re-invite or touch their password.

  const siteUrl = Deno.env.get("SITE_URL");
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl ? `${siteUrl}/minha-conta/definir-senha` : undefined,
  });
  if (inviteError) throw inviteError;
}
