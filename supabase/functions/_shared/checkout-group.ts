// A cart checkout creates several `sales` rows (one per multitrack/bundle)
// sharing one `checkout_group_id`, backed by a single Asaas PIX payment.
// These helpers let the webhook/verify-payment/resend-download flows treat a
// single-item purchase and a multi-item cart purchase the same way.

export async function getGroupSales(supabase: any, checkoutGroupId: string) {
  const { data, error } = await supabase
    .from("sales")
    .select("*, multitrack:multitracks(*), bundle:bundles(*)")
    .eq("checkout_group_id", checkoutGroupId);
  if (error) throw error;
  return data ?? [];
}

// Asaas reports one value/netValue for the whole payment - split the fee
// across the group's rows proportionally to each row's charged amount, so
// per-sale financial reporting (see AdminFinancial) still adds up correctly.
// The last row absorbs the rounding remainder so the split sums exactly.
export function distributeFee(rows: any[], grossValue: number, netValue: number) {
  const feeTotal = grossValue - netValue;
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  // A 100%-off coupon can make totalAmount 0 - avoid dividing by zero (which
  // would write NaN into asaas_fee/net_amount).
  if (totalAmount === 0) {
    return rows.map((row) => ({ id: row.id, asaas_fee: 0, net_amount: 0 }));
  }
  let allocated = 0;

  // Sort by id first - `rows` comes straight from a Supabase query with no
  // ORDER BY, so its order isn't guaranteed stable across calls. Since the
  // last row absorbs the rounding remainder, an unstable order would assign
  // a different row a different fee/net split on every re-run (e.g. a retried
  // webhook) even though the group total stays the same.
  const sortedRows = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return sortedRows.map((row, index) => {
    let fee: number;
    if (index === sortedRows.length - 1) {
      fee = Math.round((feeTotal - allocated) * 100) / 100;
    } else {
      fee = Math.round((feeTotal * (Number(row.amount) / totalAmount)) * 100) / 100;
      allocated += fee;
    }
    return { id: row.id, asaas_fee: fee, net_amount: Number(row.amount) - fee };
  });
}

// Human-readable label for audit logs and the Asaas payment description.
export function describeGroup(rows: any[]): string {
  const names = rows.map((row) =>
    row.multitrack ? `${row.multitrack.artist_name} - ${row.multitrack.song_name}` : row.bundle?.name ?? "Item"
  );
  if (names.length <= 1) return names[0] ?? "Item";
  return `${names[0]} e mais ${names.length - 1} item(ns)`;
}
