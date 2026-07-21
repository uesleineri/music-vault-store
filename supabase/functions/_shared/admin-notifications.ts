// Writes a durable admin_notifications row so the admin panel's bell/badge
// survives a closed tab and captures events that happened while no admin was
// online - unlike the old client-side-only notification state. Called once
// per checkout-group action (not per sales row), from create-payment (new
// order) and asaas-webhook/verify-payment (payment confirmed).

const formatAmount = (amount: number) => `R$ ${Number(amount).toFixed(2).replace(".", ",")}`;

export async function notifyAdmins(
  supabase: any,
  type: "new_sale" | "payment_confirmed",
  rows: any[],
  buyerEmail: string
) {
  try {
    const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const itemsLabel = rows.length > 1 ? ` (${rows.length} itens)` : "";
    const message =
      type === "new_sale"
        ? `Novo pedido de ${formatAmount(total)}${itemsLabel} - ${buyerEmail}`
        : `Pagamento confirmado: ${formatAmount(total)}${itemsLabel} - ${buyerEmail}`;

    const { error } = await supabase.from("admin_notifications").insert({
      type,
      message,
      checkout_group_id: rows[0]?.checkout_group_id ?? null,
    });
    if (error) throw error;
  } catch (error) {
    // Never fail the payment/order flow over a notification row.
    console.error("Failed to insert admin notification:", error);
  }
}
