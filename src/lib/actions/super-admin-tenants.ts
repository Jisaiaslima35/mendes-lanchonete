"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { tenantCreateSchema } from "@/lib/validation/admin";
import {
  connectInstance,
  EvolutionError,
  logoutInstance,
  normalizeQrSrc,
} from "@/lib/evolution";
import { actionError, actionOk, toUserMessage, type ActionResult } from "@/lib/errors";
import { slugify } from "@/lib/utils";

/**
 * Server actions do painel /super-admin — operacoes SaaS-level (criar/
 * desativar tenants) que NAO podem ser feitas pelo admin comum.
 *
 * Usa `createAdminSupabase()` (service_role, ignora RLS) porque:
 * 1. O super-admin nao tem `tenant_id` unico — eh owner em todos.
 * 2. As policies de `tenants` exigem `is_admin()` mas o role-check de
 *    "owner" so pode ser feito no app layer.
 *
 * O `requireSuperAdmin()` no topo de cada action garante que o caller
 * eh owner de algum tenant. Se nao for, lanca `UnauthorizedError`.
 */

type CreatedTenant = {
  id: string;
  slug: string;
  subdomain: string | null;
  owner_email?: string | null;
  temp_password?: string | null;
  owner_created?: boolean;
};

export async function createTenant(
  raw: unknown,
): Promise<ActionResult<CreatedTenant>> {
  try {
    await requireSuperAdmin();
  } catch {
    return actionError("Acesso restrito a super-admins.");
  }

  const parsed = tenantCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_root";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return actionError("Verifique os dados informados.", fieldErrors);
  }

  const {
    name,
    slug,
    subdomain,
    owner_phone,
    owner_email,
    owner_password,
    seed_tables,
    seed_categories,
  } = parsed.data;

  // Auto-gera subdomain a partir do slug se nao foi informado.
  const finalSubdomain =
    subdomain && subdomain.length > 0
      ? subdomain.toLowerCase()
      : `${slug}.${(process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "automacaojs.us").toLowerCase()}`;

  const supabase = createAdminSupabase();

  // 1) INSERT tenant com evolution_instance_name default = slug.
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      name,
      slug,
      subdomain: finalSubdomain,
      owner_phone: owner_phone || null,
      owner_email: owner_email || null,
      evolution_instance_name: slug,
      evolution_state: "close",
      evolution_webhook_set: false,
      is_active: true,
      settings: {},
    })
    .select("id, slug, subdomain")
    .single();

  if (tenantError || !tenant) {
    const code = (tenantError as { code?: string } | null)?.code;
    const msg =
      code === "23505"
        ? "Já existe um tenant com esse slug ou subdomínio."
        : toUserMessage(tenantError);
    return actionError(msg);
  }

  // 2) INSERT settings com defaults para produção (tempo de preparo, canais e prefixo).
  const { error: settingsError } = await supabase.from("settings").insert({
    tenant_id: tenant.id,
    business_name: name,
    whatsapp_number: owner_phone || "",
    avg_delivery_minutes: 35,
    avg_pickup_minutes: 20,
    min_order_value: 0,
    accepts_delivery: true,
    accepts_pickup: true,
    manual_closed: false,
    closed_message: "Estamos fechados no momento. Volte mais tarde!",
    payment_pix: true,
    payment_cash: true,
    payment_card: true,
    order_prefix: slug.toUpperCase().slice(0, 4).replace(/[^A-Z0-9]/g, "X"),
  });

  if (settingsError) {
    // Rollback best-effort: se settings falhou, deletar tenant pra nao deixar orfao.
    await supabase.from("tenants").delete().eq("id", tenant.id);
    return actionError(`Tenant criado mas settings falhou: ${toUserMessage(settingsError)}`);
  }

  // 3) INSERT horários de funcionamento (Loja nasce ABERTA - Segunda a Domingo, 18:00 às 23:30).
  const businessHoursSeed = Array.from({ length: 7 }, (_, weekday) => ({
    tenant_id: tenant.id,
    weekday,
    opens_at: "18:00:00",
    closes_at: "23:30:00",
    is_closed: false,
  }));
  const { error: hoursError } = await supabase.from("business_hours").insert(businessHoursSeed);
  if (hoursError) {
    console.error("[super-admin] business_hours seed failed:", hoursError);
  }

  // 4) INSERT mesas 1..5 (se seed_tables=true).
  if (seed_tables) {
    const tables = Array.from({ length: 5 }, (_, i) => ({
      tenant_id: tenant.id,
      number: i + 1,
      label: `Mesa ${i + 1}`,
      active: true,
    }));
    const { error: tablesError } = await supabase.from("tables").insert(tables);
    if (tablesError) {
      console.error("[super-admin] tables seed failed", tablesError);
    }
  }

  // 5) INSERT cardápio modelo funcional (se seed_categories=true):
  // Categorias "Lanches / Hambúrgueres" e "Bebidas", produtos modelo e grupo de adicionais vinculados.
  if (seed_categories) {
    const categoriesSeed = [
      {
        tenant_id: tenant.id,
        name: "Lanches / Hambúrgueres",
        slug: slugify("Lanches"),
        description: "Hambúrgueres artesanais montados com ingredientes selecionados",
        sort_order: 1,
        is_active: true,
      },
      {
        tenant_id: tenant.id,
        name: "Bebidas",
        slug: slugify("Bebidas"),
        description: "Bebidas geladas para acompanhar seu pedido",
        sort_order: 2,
        is_active: true,
      },
    ];

    const { data: insertedCategories, error: catError } = await supabase
      .from("categories")
      .insert(categoriesSeed)
      .select("id, slug");

    if (catError) {
      console.error("[super-admin] categories seed failed", catError);
    } else if (insertedCategories && insertedCategories.length > 0) {
      const lanchesCat = insertedCategories.find((c) => c.slug === "lanches") ?? insertedCategories[0];
      const bebidasCat = insertedCategories.find((c) => c.slug === "bebidas") ?? insertedCategories[1];

      // Inserir produtos modelo
      const productsSeed = [
        {
          tenant_id: tenant.id,
          category_id: lanchesCat.id,
          name: "X-Burger Artesanal",
          slug: "x-burger-artesanal",
          description:
            "Pão brioche selado na manteiga, hambúrguer artesanal 160g grelhado no ponto, queijo prato derretido e maionese especial da casa.",
          price: 24.0,
          promo_price: null,
          is_featured: true,
          is_available: true,
          prep_minutes: 20,
          sort_order: 1,
          is_active: true,
        },
        {
          tenant_id: tenant.id,
          category_id: lanchesCat.id,
          name: "X-Bacon Especial",
          slug: "x-bacon-especial",
          description:
            "Pão brioche, hambúrguer artesanal 160g, fatias crocantes de bacon selecionado, queijo cheddar cremoso e cebola caramelizada.",
          price: 28.0,
          promo_price: null,
          is_featured: true,
          is_available: true,
          prep_minutes: 20,
          sort_order: 2,
          is_active: true,
        },
        ...(bebidasCat
          ? [
              {
                tenant_id: tenant.id,
                category_id: bebidasCat.id,
                name: "Refrigerante Lata 350ml",
                slug: "refrigerante-lata-350ml",
                description: "Refrigerante lata 350ml gelado (Coca-Cola, Guaraná Antarctica ou Fanta).",
                price: 6.0,
                promo_price: null,
                is_featured: false,
                is_available: true,
                prep_minutes: 5,
                sort_order: 1,
                is_active: true,
              },
              {
                tenant_id: tenant.id,
                category_id: bebidasCat.id,
                name: "Água Mineral 500ml",
                slug: "agua-mineral-500ml",
                description: "Água mineral natural sem gás (garrafa 500ml gelada).",
                price: 4.0,
                promo_price: null,
                is_featured: false,
                is_available: true,
                prep_minutes: 5,
                sort_order: 2,
                is_active: true,
              },
            ]
          : []),
      ];

      const { data: insertedProducts, error: prodError } = await supabase
        .from("products")
        .insert(productsSeed)
        .select("id, slug");

      if (prodError) {
        console.error("[super-admin] products seed failed", prodError);
      }

      // Grupo de Adicionais Modelo vinculado aos hambúrgueres
      const { data: optGroup, error: groupError } = await supabase
        .from("option_groups")
        .insert({
          tenant_id: tenant.id,
          name: "Adicionais",
          description: "Turbine seu lanche com ingredientes extras",
          selection_type: "multiple",
          min_select: 0,
          max_select: 5,
          is_required: false,
          sort_order: 1,
          is_active: true,
        })
        .select("id")
        .single();

      if (groupError || !optGroup) {
        console.error("[super-admin] option group seed failed", groupError);
      } else {
        const optionsSeed = [
          { group_id: optGroup.id, name: "Bacon Extra Crocante", price_delta: 4.5, sort_order: 1, is_available: true },
          { group_id: optGroup.id, name: "Queijo Cheddar Extra", price_delta: 3.5, sort_order: 2, is_available: true },
          { group_id: optGroup.id, name: "Hambúrguer Extra 160g", price_delta: 8.0, sort_order: 3, is_available: true },
          { group_id: optGroup.id, name: "Maionese Especial Extra", price_delta: 2.5, sort_order: 4, is_available: true },
        ];
        const { error: optError } = await supabase.from("options").insert(optionsSeed);
        if (optError) {
          console.error("[super-admin] options seed failed", optError);
        }

        if (insertedProducts && insertedProducts.length > 0) {
          const lancheProds = insertedProducts.filter(
            (p) => p.slug === "x-burger-artesanal" || p.slug === "x-bacon-especial",
          );
          const links = lancheProds.map((p) => ({
            product_id: p.id,
            group_id: optGroup.id,
            sort_order: 1,
          }));
          if (links.length > 0) {
            const { error: linkError } = await supabase.from("product_option_groups").insert(links);
            if (linkError) {
              console.error("[super-admin] product_option_groups link failed", linkError);
            }
          }
        }
      }
    }
  }

  // 6) CRIAÇÃO AUTOMÁTICA DO USUÁRIO ADMIN / OWNER
  let ownerCreated = false;
  let tempPasswordResult: string | null = null;

  if (owner_email && owner_email.trim().length > 0) {
    const emailNorm = owner_email.trim().toLowerCase();
    const generatedPassword =
      owner_password && owner_password.length >= 6
        ? owner_password
        : `Mendes@${Math.floor(100000 + Math.random() * 900000)}`;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: emailNorm,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        name,
        tenant_id: tenant.id,
      },
    });

    let userId: string | null = authUser?.user?.id ?? null;

    if (authError || !userId) {
      console.warn("[super-admin] createUser falhou, buscando se usuário já existe:", authError?.message);
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existing = userList?.users?.find((u) => u.email?.toLowerCase() === emailNorm);
      if (existing) {
        userId = existing.id;
      } else {
        console.error("[super-admin] Não foi possível encontrar ou criar usuário auth:", authError);
      }
    } else {
      tempPasswordResult = generatedPassword;
    }

    if (userId) {
      const { error: adminError } = await supabase.from("admins").upsert(
        {
          id: userId,
          tenant_id: tenant.id,
          name: name || "Administrador",
          email: emailNorm,
          role: "owner",
          is_active: true,
          is_super_admin: false,
        },
        { onConflict: "id" },
      );

      if (adminError) {
        console.error("[super-admin] admins upsert failed:", adminError);
      } else {
        ownerCreated = true;
      }
    }
  }

  revalidatePath("/super-admin");
  revalidatePath("/admin");

  return actionOk<CreatedTenant>({
    id: tenant.id,
    slug: tenant.slug,
    subdomain: tenant.subdomain,
    owner_email: owner_email || null,
    temp_password: tempPasswordResult,
    owner_created: ownerCreated,
  });
}

const toggleSchema = z.object({
  tenantId: z.string().uuid(),
  isActive: z.coerce.boolean(),
});

export async function toggleTenantActive(
  raw: unknown,
): Promise<ActionResult<{ tenantId: string; isActive: boolean }>> {
  try {
    await requireSuperAdmin();
  } catch {
    return actionError("Acesso restrito a super-admins.");
  }

  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    return actionError("Dados inválidos.");
  }

  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from("tenants")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.tenantId);

  if (error) {
    return actionError(toUserMessage(error));
  }

  revalidatePath("/super-admin");
  return actionOk({ tenantId: parsed.data.tenantId, isActive: parsed.data.isActive });
}

/**
 * Reinicia a instância Evolution do tenant (logout + connect novo).
 * Usado pelo super-admin quando a loja perde conexão e o dono não
 * consegue resolver sozinho (ex: WhatsApp do dono bloqueou).
 */
const restartSchema = z.object({ tenantId: z.string().uuid() });

export async function restartEvolution(
  raw: unknown,
): Promise<ActionResult<{ qrcode?: string }>> {
  try {
    await requireSuperAdmin();
  } catch {
    return actionError("Acesso restrito a super-admins.");
  }

  const parsed = restartSchema.safeParse(raw);
  if (!parsed.success) return actionError("Dados invalidos.");

  const supabase = createAdminSupabase();
  const { data: tenant, error: lookupError } = await supabase
    .from("tenants")
    .select("id, slug, evolution_instance_name")
    .eq("id", parsed.data.tenantId)
    .single();

  if (lookupError || !tenant) {
    return actionError("Tenant nao encontrado.");
  }

  const instanceName = tenant.evolution_instance_name ?? tenant.slug;

  // 1) Logout best-effort (pode falhar se ja estiver desconectado).
  try {
    await logoutInstance(instanceName);
  } catch (err) {
    if (!(err instanceof EvolutionError) || err.status !== 404) {
      console.warn("[super-admin] logout falhou no restart", {
        instance: instanceName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2) Connect novo pra pegar QR.
  let qrcode: string | undefined;
  try {
    const conn = await connectInstance(instanceName);
    const raw =
      conn?.base64 ?? conn?.qrcode ?? conn?.code ?? undefined;
    qrcode = raw ? normalizeQrSrc(raw) : undefined;
    const stateRaw = (conn as { instance?: { state?: string } } | undefined)?.instance?.state;
    const nextState =
      stateRaw === "open" || stateRaw === "close" || stateRaw === "connecting"
        ? stateRaw
        : "close";
    await supabase
      .from("tenants")
      .update({
        evolution_state: nextState,
        evolution_owner_jid: null,
        evolution_connected_at: nextState === "open" ? new Date().toISOString() : null,
      })
      .eq("id", tenant.id);
  } catch (err) {
    const msg =
      err instanceof EvolutionError
        ? `Evolution respondeu ${err.status}.`
        : err instanceof Error
          ? err.message
          : "Falha desconhecida.";
    return actionError(`Nao consegui reiniciar a instancia: ${msg}`);
  }

  revalidatePath("/super-admin");
  return actionOk({ qrcode });
}
