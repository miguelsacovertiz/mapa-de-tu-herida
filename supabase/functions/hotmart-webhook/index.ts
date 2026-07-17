// Recibe el Webhook/Postback de Hotmart cuando cambia el estado de una compra.
// Valida el token X-HOTMART-HOTTOK (secreto compartido, configurado en Hotmart
// y guardado aquí como variable de entorno HOTMART_HOTTOK) antes de tocar la base.
//
// - Eventos de compra aprobada/completa -> guarda al comprador (da acceso).
// - Eventos de reembolso/contracargo/cancelación -> borra al comprador (quita acceso).
// - Cualquier otro evento -> se responde 200 sin hacer nada, para que Hotmart
//   no reintente indefinidamente.
//
// Debe desplegarse con "Verify JWT" DESACTIVADO: Hotmart no puede enviar un
// token de Supabase, así que la verificación de identidad es el hottok, no un JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOTMART_HOTTOK = Deno.env.get("HOTMART_HOTTOK");

const GRANT_EVENTS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const REVOKE_EVENTS = new Set([
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_CANCELED",
  "PURCHASE_CANCELLED",
  "PURCHASE_PROTEST",
  "PURCHASE_EXPIRED",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const receivedToken = req.headers.get("X-HOTMART-HOTTOK");
  if (!HOTMART_HOTTOK || receivedToken !== HOTMART_HOTTOK) {
    return json({ error: "hottok invalido" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "json invalido" }, 400);
  }

  const event: string | undefined = body?.event;
  const email: string | undefined = body?.data?.buyer?.email;

  if (!email) {
    return json({ ok: true, skipped: "sin email de comprador" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (event && GRANT_EVENTS.has(event)) {
    const transactionId = body?.data?.purchase?.transaction ?? null;
    const productoNombre = body?.data?.product?.name ?? null;
    const approvedMs = body?.data?.purchase?.approved_date;
    const fechaCompra = approvedMs
      ? new Date(approvedMs).toISOString()
      : new Date().toISOString();

    const { error } = await supabase.from("compradores_pagados").upsert({
      email: normalizedEmail,
      fecha_compra: fechaCompra,
      transaction_id: transactionId,
      producto: productoNombre,
    });

    if (error) {
      console.error("Error al guardar comprador:", error);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true, action: "granted", email: normalizedEmail });
  }

  if (event && REVOKE_EVENTS.has(event)) {
    const { error } = await supabase
      .from("compradores_pagados")
      .delete()
      .eq("email", normalizedEmail);

    if (error) {
      console.error("Error al revocar acceso:", error);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true, action: "revoked", email: normalizedEmail });
  }

  return json({ ok: true, action: "ignored", event: event ?? null });
});
