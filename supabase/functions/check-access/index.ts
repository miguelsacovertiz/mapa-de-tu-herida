// La app llama a esta función desde el navegador (con la anon/publishable key,
// que no da acceso directo a la tabla "compradores_pagados") para preguntar
// "¿este correo ya pagó?" sin exponer la tabla completa de compradores.
//
// Debe desplegarse con "Verify JWT" DESACTIVADO para que la app pueda llamarla
// directo por fetch() sin pasar un token de sesión de Supabase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "json invalido" }, 400);
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email) {
    return json({ error: "email requerido" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("compradores_pagados")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Error al verificar acceso:", error);
    return json({ error: error.message }, 500);
  }

  return json({ allowed: !!data });
});
