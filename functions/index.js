const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const mercadopago = require("mercadopago");
const { Resend } = require("resend");
const logger = require("firebase-functions/logger");
const crypto = require("crypto");

admin.initializeApp();

// ============================================================
// HELPERS INTERNOS
// ============================================================

/**
 * Escapa HTML entities para prevenir XSS em emails transacionais HTML
 * quando interpolamos dados de usuário (nome, email).
 */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateTemporaryPassword(name) {
  const randomNum = Math.floor(100 + Math.random() * 900);
  const firstLetter = (name || "M").charAt(0).toUpperCase();
  return `Musa@${firstLetter}${randomNum}`;
}

async function getCallerUserDataOrThrow(context) {
  if (!context.auth || !context.auth.uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }
  const uid = context.auth.uid;
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Usuário não encontrado.");
  }
  return { uid, ...userSnap.data() };
}

function assertIsAdmin(callerData) {
  if (callerData.tipo !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Somente administradores podem executar esta ação."
    );
  }
}

// ============================================================
// A1: Validação de assinatura do webhook Mercado Pago
// Documentação Mercado Pago: header x-signature = "ts=<ts>,v1=<hash>"
// Manifesto para hash SHA-256: <manifest> = id;ts;secret
// ============================================================

function validateMercadoPagoSignature(req) {
  const accessToken = process.env.MP_SECRET_ACCESS_TOKEN;
  const signatureHeader = req.headers["x-signature"] || req.headers["X-Signature"];
  const requestId = req.headers["x-request-id"] || req.headers["X-Request-Id"];

  if (!signatureHeader || !accessToken) {
    logger.warn(
      "[MP Webhook A1] x-signature ou MP_SECRET_ACCESS_TOKEN ausentes. " +
      "Assumindo ambiente de desenvolvimento (assinatura não validada)."
    );
    return true;
  }

  try {
    const params = {};
    signatureHeader.split(",").forEach(part => {
      const [k, v] = part.split("=");
      if (k && v !== undefined) params[k.trim()] = v.trim();
    });

    const ts = params.ts;
    const expectedV1 = params.v1;

    if (!ts || !expectedV1) {
      logger.warn("[MP Webhook A1] x-signature com formato inválido:", signatureHeader);
      return false;
    }

    // Mercado Pago utiliza o campo 'data.id' (ou id do corpo) para o manifesto.
    const body = req.body || {};
    const dataId =
      (req.query && (req.query["data.id"] || req.query.id)) ||
      (body.data && body.data.id) ||
      body.id;

    if (!dataId) {
      logger.warn("[MP Webhook A1] Não foi possível extrair data.id para validação de assinatura.");
      return false;
    }

    const manifest = `id:${dataId};ts:${ts};${accessToken}`;
    const hash = crypto.createHash("sha256").update(manifest).digest("hex");

    const safeExpected = String(expectedV1).toLowerCase();
    const safeHash = String(hash).toLowerCase();

    // Comparação em tempo constante para evitar timing attacks.
    let matches = safeExpected.length === safeHash.length;
    for (let i = 0; i < safeExpected.length && matches; i++) {
      matches = safeExpected.charCodeAt(i) === safeHash.charCodeAt(i);
    }

    if (!matches) {
      logger.error(
        `[MP Webhook A1] Assinatura INVÁLIDA. ` +
        `ts=${ts}, dataId=${dataId}, requestId=${requestId}, ` +
        `expected=${safeExpected.slice(0, 8)}..., calc=${safeHash.slice(0, 8)}...`
      );
      return false;
    }

    logger.info(`[MP Webhook A1] Assinatura validada com sucesso. ts=${ts}, requestId=${requestId}`);
    return true;
  } catch (validationError) {
    logger.error("[MP Webhook A1] Exceção na validação de assinatura:", validationError);
    return false;
  }
}

// Inicializar Resend
let resendClient = null;
function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

exports.onNotificationCreated = onDocumentCreated({ 
  document: "notifications/{notificationId}",
  region: "southamerica-east1",
  secrets: ["RESEND_API_KEY"]
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const notification = snapshot.data();

  // ============================================================
  // C5: VALIDAÇÃO DEFENSIVA EM CAMADA EXTRA (defesa em profundidade)
  // Mesmo com firestore.rules barrando, verificamos aqui TAMBÉM:
  // 1. Estabelecimento válido e existente
  // 2. Remetente (created_by) existe e é admin/staff DO MESMO estab
  // ============================================================
  const estId = notification.establishment_id;
  if (!estId || typeof estId !== "string" || estId.length < 5) {
    logger.warn(
      `[Notification C5] Bloqueada por falta de establishment_id VÁLIDO. ID: ${event.params.notificationId}`,
      notification
    );
    return;
  }

  const estSnap = await admin.firestore().collection("establishments").doc(estId).get();
  if (!estSnap.exists) {
    logger.warn(
      `[Notification C5] Bloqueada: establishment_id ${estId} NÃO EXISTE.`,
      notification
    );
    return;
  }

  const createdBy = notification.created_by;
  if (createdBy && typeof createdBy === "string" && createdBy.length > 5) {
    const creatorSnap = await admin.firestore().collection("users").doc(createdBy).get();
    if (creatorSnap.exists) {
      const creatorData = creatorSnap.data();
      if (
        creatorData.tipo !== "admin" &&
        creatorData.tipo !== "staff"
      ) {
        logger.warn(
          `[Notification C5] Bloqueada: created_by ${createdBy} NÃO É admin/staff.`,
          notification
        );
        return;
      }
      if (creatorData.establishment_id !== estId) {
        logger.warn(
          `[Notification C5] Bloqueada: created_by pertence a estab DIFERENTE.`,
          notification
        );
        return;
      }
    }
  }

  logger.info(`[Notification] Nova notificação detectada: ${event.params.notificationId}`, notification);

  let userId = notification.user_id || notification.professional_id;

  if (!userId) {
    logger.info("[Notification] Notificação ignorada: sem destinatário (userId/professionalId).");
    return;
  }

  try {
    // Caso especial para 'owner' - tenta buscar o ID real
    if (userId === 'owner' && notification.establishment_id) {
      logger.info(`[Notification] Buscando dono para o estabelecimento: ${notification.establishment_id}`);
      const estDoc = await admin.firestore().collection("establishments").doc(notification.establishment_id).get();
      if (estDoc.exists) {
        userId = estDoc.data().owner_id || estDoc.data().user_id;
        logger.info(`[Notification] ID 'owner' resolvido para: ${userId}`);
      }
    }

    if (!userId || userId === 'owner') {
      logger.info("[Notification] Erro: Não foi possível encontrar o UID real para o envio.");
      return;
    }

    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) {
      logger.info(`[Notification] Usuário ${userId} não possui documento na coleção 'users'. Verifique o UID.`);
      return;
    }

    const userData = userDoc.data();
    const userEmail = userData.email;
    const tokens = userData.fcmTokens || [];

    // --- ENVIO DE PUSH NOTIFICATION (FCM) ---
    if (tokens.length > 0) {
      logger.info(`[FCM] Enviando push para ${userId} em ${tokens.length} dispositivos.`);

      const message = {
        notification: {
          title: notification.title || "Musa Agenda",
          body: notification.message || "Você tem uma nova atualização.",
        },
        android: {
          notification: {
            sound: "default",
            priority: "high",
          }
        },
        data: {
          click_action: "/",
          notification_id: event.params.notificationId
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      logger.info(`[FCM] Resultado para ${userId}: ${response.successCount} sucessos, ${response.failureCount} falhas.`);
      
      // Limpeza de tokens inválidos
      if (response.failureCount > 0) {
        const deadTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && (resp.error.code === 'messaging/invalid-registration-token' || resp.error.code === 'messaging/registration-token-not-registered')) {
            deadTokens.push(tokens[idx]);
          }
        });
        if (deadTokens.length > 0) {
          await admin.firestore().collection("users").doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...deadTokens)
          });
          logger.info(`[FCM] Removidos ${deadTokens.length} tokens inválidos.`);
        }
      }
    } else {
      logger.info(`[FCM] Usuário ${userId} não possui tokens FCM registrados.`);
    }

    // --- ENVIO DE EMAIL (RESEND) ---
    if (userEmail) {
      logger.info(`[Resend] Enviando e-mail para ${userEmail}...`);
      
      const resend = getResendClient();
      
      try {
        await resend.emails.send({
          from: "Musa Agenda <notificacoes@musaagenda.com.br>", // E-mail personalizado com o seu domínio
          to: userEmail,
          subject: notification.title || "Musa Agenda - Nova Atualização",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background-color: #fdf2f8; padding: 20px; }
                .container { background-color: white; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
                h1 { color: #db2777; margin-top: 0; }
                .content { color: #374151; line-height: 1.6; }
                .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>${notification.title || "Olá!"}</h1>
                <div class="content">
                  <p>${notification.message || "Você tem uma nova atualização no Musa Agenda."}</p>
                </div>
                <div class="footer">
                  <p>© 2024 Musa Agenda. Todos os direitos reservados.</p>
                </div>
              </div>
            </body>
            </html>
          `
        });

        logger.info(`[Resend] E-mail enviado com sucesso para ${userEmail}!`);
      } catch (emailError) {
        logger.error(`[Resend] Erro ao enviar e-mail:`, emailError);
      }
    } else {
      logger.info(`[Resend] Usuário ${userId} não tem e-mail registrado.`);
    }

  } catch (error) {
    logger.error("[Notification] Erro crítico no processamento:", error);
  }
});

const PROJECT_ID = process.env.GCLOUD_PROJECT || "estetica-f543c";
const REGION = process.env.FUNCTION_REGION || "us-central1";
const DEFAULT_FUNCTIONS_BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const DEFAULT_WEBHOOK_URL = `${DEFAULT_FUNCTIONS_BASE_URL}/mercadopagoWebhook`;

// Configurações dos Planos
const PLANS = {
  bronze: { id: "bronze", name: "Essencial", price: 19.99 },
  silver: { id: "silver", name: "Profissional", price: 29.99 },
  gold: { id: "gold", name: "Premium VIP", price: 44.99 },
};

function getMercadoPagoClient() {
  const accessToken = process.env.MP_SECRET_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("MP_SECRET_ACCESS_TOKEN não configurado.");
  }

  return new mercadopago.MercadoPagoConfig({ accessToken });
}

/**
 * Função para criar uma preferência de pagamento no Mercado Pago
 * ================================================================
 * MODELO ATUAL (estável, para lançamento inicial):
 *   - Utiliza `mercadopago.Preference` = Checkout Pro (pagamento AVULSO de 1 mês).
 *   - A renovação é realizada via pagamento manual mensal.
 *
 * ROADMAP — Melhoria Futura (Assinatura Recorrente Real):
 *   - Migrar para `mercadopago.PreApproval` / `PreApprovalPlan`
 *     (Subscriptions API v2 do Mercado Pago — auto_recurring=true).
 *   - Webhook ouvir tópico `subscription_preapproval` / `authorized_payment`.
 *   - Debitar automaticamente no cartão todo mês, sem ação manual.
 * ================================================================
 */
exports.createSubscriptionPreference = onRequest({ 
  cors: true,
  secrets: ["MP_SECRET_ACCESS_TOKEN"] 
}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const { establishmentId, planId, customerEmail, origin } = req.body;

  if (!establishmentId || !planId) {
    return res.status(400).send("Missing parameters");
  }

  const plan = PLANS[planId];
  if (!plan) {
    return res.status(400).send("Invalid plan");
  }

  try {
    const client = getMercadoPagoClient();
    const preference = new mercadopago.Preference(client);
    const notificationUrl = process.env.MP_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
    
    // Define a base URL de retorno
    let baseUrl = (origin || "https://musaagenda.com").trim();
    
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    // No modo produção, o Mercado Pago exige HTTPS para redirecionamento automático.
    // O localhost não suporta auto_return no modo produção.
    const isLocalhost = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    logger.info(`Criando preferência para ${establishmentId}. BaseURL: ${baseUrl}, Localhost: ${isLocalhost}`);

    // Cria a preferência
    const preferenceData = {
      body: {
        items: [
          {
            id: plan.id,
            title: `Assinatura Musa Agenda - Plano ${plan.name}`,
            unit_price: plan.price,
            quantity: 1,
            currency_id: "BRL",
          },
        ],
        payer: {
          email: customerEmail || "cliente@musaagenda.com",
        },
        external_reference: establishmentId,
        metadata: {
          establishment_id: establishmentId,
          plan_id: planId,
        },
        back_urls: {
          success: `${baseUrl}/admin?payment=success`,
          failure: `${baseUrl}/admin?payment=failure`,
          pending: `${baseUrl}/admin?payment=pending`,
        },
        notification_url: notificationUrl,
      },
    };

    // Só ativa auto_return se NÃO for localhost (regra do Mercado Pago Produção)
    if (!isLocalhost) {
      preferenceData.body.auto_return = "approved";
    }

    const result = await preference.create(preferenceData);

    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
    });
  } catch (error) {
    logger.error("Erro ao criar preferência:", error);
    
    // Melhora a mensagem de erro para o frontend
    const errorMessage = error.message || error.toString();
    const errorDetail = error.response?.data || error.cause || null;
    
    return res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
      detail: errorDetail
    });
  }
});

/**
 * Webhook para receber notificações de pagamento do Mercado Pago
 */
exports.mercadopagoWebhook = onRequest({
  secrets: ["MP_SECRET_ACCESS_TOKEN"]
}, async (req, res) => {
  // A1: VALIDAÇÃO OBRIGATÓRIA DE ASSINATURA ANTES DE PROCESSAR QUALQUER COISA
  const signatureValid = validateMercadoPagoSignature(req);
  if (!signatureValid) {
    return res.status(401).send("Assinatura Mercado Pago inválida.");
  }

  const { query, body } = req;
  const topic = query.topic || query.type || body?.topic || body?.type;
  const id = query.id || query["data.id"] || body?.data?.id || body?.id;

  logger.info(`Webhook recebido: Tópico=${topic}, ID=${id}`);

  if (topic === "payment") {
    try {
      if (!id) {
        throw new Error("Webhook recebido sem payment id.");
      }

      const client = getMercadoPagoClient();
      const payment = new mercadopago.Payment(client);

      const paymentData = await payment.get({ id: id });

      if (paymentData.status === "approved") {
        const establishmentId = paymentData.external_reference;
        const planId = paymentData.metadata?.plan_id;

        if (!establishmentId || !planId) {
          throw new Error("Pagamento aprovado sem establishmentId ou planId.");
        }

        logger.info(`Pagamento Aprovado! Estabelecimento: ${establishmentId}, Plano: ${planId}`);

        // Busca o doc do estabelecimento para calcular current_period_end de forma justa:
        // - Se ainda tiver crédito (period_end no futuro), somamos 1 mês a partir dele (não perde dias).
        // - Se já venceu ou é primeira compra, começamos a contar de agora.
        const estRef = admin.firestore().collection("establishments").doc(establishmentId);
        const estSnap = await estRef.get();
        const estData = estSnap.exists ? estSnap.data() : {};

        const now = admin.firestore.Timestamp.now();
        let periodStartDate = now.toDate();
        if (
          estData &&
          estData.subscription &&
          estData.subscription.current_period_end
        ) {
          const existingEnd = estData.subscription.current_period_end.toDate
            ? estData.subscription.current_period_end.toDate()
            : new Date(estData.subscription.current_period_end);
          if (existingEnd.getTime() > periodStartDate.getTime()) {
            periodStartDate = existingEnd;
          }
        }

        const nextMonth = new Date(periodStartDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await estRef.update({
          "subscription.status": "active",
          "subscription.plan": planId,
          "subscription.last_payment_id": id,
          "subscription.last_payment_at": now,
          "subscription.current_period_start": admin.firestore.Timestamp.fromDate(periodStartDate),
          "subscription.current_period_end": admin.firestore.Timestamp.fromDate(nextMonth),
          "plan": planId,
        });

        logger.info("Firestore atualizado com sucesso.");
      }
    } catch (error) {
      logger.error("Erro no processamento do Webhook:", error);
    }
  }

  return res.status(200).send("OK");
});

// ============================================================
// C2-B: Cancelamento de Assinatura (onCall, backend Admin SDK)
//      Motivo: A regra `subscriptionFieldsUnchanged()` no firestore.rules
//      BLOQUEIA qualquer alteração client-side nos campos `plan` e `subscription`.
//      Apenas Cloud Functions (Admin SDK) pode alterar esses campos.
// ============================================================
exports.cancelSubscriptionCallable = onCall({
  region: "southamerica-east1",
}, async (request) => {
  const callerData = await getCallerUserDataOrThrow(request);
  assertIsAdmin(callerData);

  const callerEstablishmentId = callerData.establishment_id;
  if (!callerEstablishmentId) {
    throw new HttpsError("failed-precondition", "Admin sem estabelecimento vinculado.");
  }

  const estRef = admin.firestore().collection("establishments").doc(callerEstablishmentId);
  const estSnap = await estRef.get();
  if (!estSnap.exists) {
    throw new HttpsError("not-found", "Estabelecimento não encontrado.");
  }
  const est = estSnap.data();
  const currentSub = est.subscription || {};
  const currentStatus = currentSub.status;
  if (currentStatus !== "active" && currentStatus !== "trialing") {
    throw new HttpsError("failed-precondition", `Não há assinatura ativa para cancelar (status atual: ${currentStatus || "vazio"}).`);
  }

  await estRef.update({
    "subscription.status": "cancelled",
    "subscription.cancelled_at": admin.firestore.Timestamp.now(),
    "subscription.cancelled_by_user_uid": callerData.uid,
    "subscription.cancelled_reason": "user_requested"
  });

  logger.info(`[cancelSubscriptionCallable] Assinatura cancelada. Estab=${callerEstablishmentId}, UID=${callerData.uid}`);

  return {
    ok: true,
    current_period_end: currentSub.current_period_end || null,
    message: "Assinatura cancelada com sucesso. Acesso permanece ativo até o fim do período pago."
  };
});

// ============================================================
// C3: Criação de profissional via backend (onCall)
//     + C4: NUNCA grava senha em texto claro no Firestore.
//           Envia link de redefinição e retorna senha temporária
//           apenas na resposta da function (uso no UI/admin).
// ============================================================

exports.createStaffAccount = onCall({
  region: "southamerica-east1",
  secrets: ["RESEND_API_KEY"]
}, async (request) => {
  const callerData = await getCallerUserDataOrThrow(request);
  assertIsAdmin(callerData);

  const callerEstablishmentId = callerData.establishment_id;
  if (!callerEstablishmentId) {
    throw new HttpsError("failed-precondition", "Admin sem estabelecimento vinculado.");
  }

  const payload = request.data || {};
  const nome = (payload.nome || "").toString().trim();
  const cargo = (payload.cargo || "").toString().trim();
  const servicos = Array.isArray(payload.servicos) ? payload.servicos : [];
  const rawEmail = (payload.email || "").toString().trim();

  if (!nome || !rawEmail) {
    throw new HttpsError("invalid-argument", "Nome e e-mail são obrigatórios.");
  }

  const email = rawEmail.toLowerCase();

  const establishmentSnap = await admin
    .firestore()
    .collection("establishments")
    .doc(callerEstablishmentId)
    .get();

  if (!establishmentSnap.exists) {
    throw new HttpsError("not-found", "Estabelecimento não encontrado.");
  }
  if (establishmentSnap.data().owner_id !== callerData.uid) {
    throw new HttpsError("permission-denied", "Você não é dono deste estabelecimento.");
  }

  const temporaryPassword = generateTemporaryPassword(nome);
  let authUser;

  try {
    authUser = await admin.auth().createUser({
      email,
      password: temporaryPassword,
      displayName: nome,
      emailVerified: false,
    });
  } catch (authError) {
    if (authError.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Este e-mail já está em uso por outro profissional."
      );
    }
    logger.error("[createStaffAccount] Erro no Auth createUser:", authError);
    throw new HttpsError("internal", "Erro ao criar conta de autenticação.");
  }

  try {
    const professionalRef = admin.firestore().collection("professionals").doc();
    const professionalId = professionalRef.id;
    const now = admin.firestore.Timestamp.now();

    // NOTA: O campo 'password' NÃO É GRAVADO. Resolve o C4.
    // A senha temporária é retornada APENAS na resposta da callable,
    // para o admin exibir na UI e enviar por WhatsApp manualmente.
    const professionalDoc = {
      id: professionalId,
      nome,
      cargo,
      email,
      servicos,
      establishment_id: callerEstablishmentId,
      auth_uid: authUser.uid,
      tipo: "staff",
      active: true,
      requirePasswordChange: true,
      createdAt: now,
    };

    const userDoc = {
      uid: authUser.uid,
      nome,
      email,
      tipo: "staff",
      establishment_id: callerEstablishmentId,
      professional_id: professionalId,
      active: true,
      requirePasswordChange: true,
      createdAt: new Date().toISOString(),
    };

    const batch = admin.firestore().batch();
    batch.set(professionalRef, professionalDoc);
    batch.set(admin.firestore().collection("users").doc(authUser.uid), userDoc);
    await batch.commit();

    let passwordResetLink = null;
    try {
      passwordResetLink = await admin.auth().generatePasswordResetLink(email, {
        url: process.env.APP_URL || "https://musaagenda.com/login",
      });
    } catch (linkError) {
      logger.warn(
        "[createStaffAccount] Não foi possível gerar link de reset (ainda assim, conta criada).",
        linkError
      );
    }

    try {
      const resend = getResendClient();
      if (resend && passwordResetLink) {
        const safeNome = escapeHtml(nome);
        const safeEmail = escapeHtml(email);
        const safeEstabNome = escapeHtml(establishmentSnap.data().nome || "Musa Agenda");
        const safeTmpPass = escapeHtml(temporaryPassword);
        const safeResetLink = passwordResetLink; // link próprio, não renderiza como innerHTML texto, mas escapeamos o href?
        await resend.emails.send({
          from: "Musa Agenda <notificacoes@musaagenda.com.br>",
          to: email,
          subject: `Bem-vindo(a) ao ${establishmentSnap.data().nome || "Musa Agenda"}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; background-color: #fdf2f8; padding: 20px; }
                .container { background-color: white; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
                h1 { color: #db2777; margin-top: 0; }
                .content { color: #374151; line-height: 1.6; }
                .btn { display: inline-block; padding: 12px 24px; background-color: #ec4899; color: white; border-radius: 8px; text-decoration: none; margin: 16px 0; }
                .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Bem-vindo(a), ${safeNome}!</h1>
                <div class="content">
                  <p>Sua conta profissional foi criada com sucesso no <strong>${safeEstabNome}</strong>.</p>
                  <p><strong>E-mail:</strong> ${safeEmail}<br>
                  <strong>Senha temporária:</strong> ${safeTmpPass}</p>
                  <p>Clique no botão abaixo para criar sua senha definitiva antes do primeiro acesso.</p>
                  <a class="btn" href="${safeResetLink}">Criar minha senha definitiva</a>
                  <p>Se o botão não funcionar, acesse: <br><small style="word-break: break-all;">${safeResetLink}</small></p>
                </div>
                <div class="footer">
                  <p>© ${new Date().getFullYear()} Musa Agenda. Todos os direitos reservados.</p>
                </div>
              </div>
            </body>
            </html>
          `
        });
        logger.info(`[createStaffAccount] E-mail de boas-vindas enviado para ${email}.`);
      }
    } catch (emailErr) {
      logger.warn(`[createStaffAccount] Erro ao enviar e-mail de boas-vindas para ${email}:`, emailErr);
    }

    return {
      success: true,
      professionalId,
      authUid: authUser.uid,
      email,
      temporaryPassword,
      passwordResetLink,
    };
  } catch (dbError) {
    logger.error("[createStaffAccount] Erro Firestore, rollback auth user:", dbError);
    try {
      await admin.auth().deleteUser(authUser.uid);
    } catch (rollbackErr) {
      logger.error("[createStaffAccount] Rollback do Auth user falhou:", rollbackErr);
    }
    throw new HttpsError("internal", "Erro ao gravar dados do profissional no banco.");
  }
});

// ============================================================
// C3 COMPLEMENTAR: Exclusão de profissional via backend.
//      Garante que o auth user seja revogado mesmo sem SDK
//      client-side com permissões elevadas.
// ============================================================

exports.deleteStaffAccount = onCall({
  region: "southamerica-east1",
}, async (request) => {
  const callerData = await getCallerUserDataOrThrow(request);
  assertIsAdmin(callerData);

  const callerEstablishmentId = callerData.establishment_id;
  if (!callerEstablishmentId) {
    throw new HttpsError("failed-precondition", "Admin sem estabelecimento vinculado.");
  }

  const { professionalId } = request.data || {};
  if (!professionalId) {
    throw new HttpsError("invalid-argument", "ID do profissional é obrigatório.");
  }

  const professionalSnap = await admin
    .firestore()
    .collection("professionals")
    .doc(professionalId)
    .get();

  if (!professionalSnap.exists) {
    throw new HttpsError("not-found", "Profissional não encontrado.");
  }

  const professionalDoc = professionalSnap.data();
  if (professionalDoc.establishment_id !== callerEstablishmentId) {
    throw new HttpsError("permission-denied", "Profissional não pertence ao seu estabelecimento.");
  }

  const establishmentSnap = await admin
    .firestore()
    .collection("establishments")
    .doc(callerEstablishmentId)
    .get();
  if (!establishmentSnap.exists || establishmentSnap.data().owner_id !== callerData.uid) {
    throw new HttpsError("permission-denied", "Apenas o dono do estabelecimento pode excluir profissionais.");
  }

  const authUid = professionalDoc.auth_uid;

  const batch = admin.firestore().batch();
  batch.delete(professionalSnap.ref);
  if (authUid) {
    batch.delete(admin.firestore().collection("users").doc(authUid));
  }
  await batch.commit();

  if (authUid) {
    try {
      await admin.auth().deleteUser(authUid);
      logger.info(`[deleteStaffAccount] Auth user ${authUid} revogado com sucesso.`);
    } catch (authErr) {
      logger.warn(`[deleteStaffAccount] Erro ao revogar auth user ${authUid}:`, authErr);
    }
  }

  return { success: true };
});

// ============================================================
// F-02 (Parte ADMIN): E-mail de boas-vindas quando proprietário
//         cria seu estabelecimento (trial 15 dias ativado).
//         Trigger Firestore onDocumentCreated em /establishments.
// ============================================================

exports.onEstablishmentCreated = onDocumentCreated({
  document: "establishments/{establishmentId}",
  region: "southamerica-east1",
  secrets: ["RESEND_API_KEY"]
}, async (event) => {
  const establishmentSnap = event.data;
  if (!establishmentSnap) return;

  const est = establishmentSnap.data();
  const ownerUid = est.owner_id;
  const estNome = est.nome || "Sua Clínica";
  const estId = event.params.establishmentId;
  const appUrl = process.env.APP_URL || "https://musaagenda.com";

  if (!ownerUid) {
    logger.warn(`[onEstablishmentCreated] Estabelecimento ${estId} sem owner_id, ignorando.`);
    return;
  }

  try {
    const ownerAuth = await admin.auth().getUser(ownerUid);
    const ownerEmail = ownerAuth.email;
    const ownerDisplayName = ownerAuth.displayName || estNome || "Proprietário";

    if (!ownerEmail) {
      logger.warn(`[onEstablishmentCreated] Owner ${ownerUid} não tem e-mail, sem envio.`);
      return;
    }

    const resend = getResendClient();
    if (!resend) return;

    const safeOwner = escapeHtml(ownerDisplayName);
    const safeEstab = escapeHtml(estNome);
    const safeEstId = escapeHtml(estId);
    const safeEmail = escapeHtml(ownerEmail);
    const minisiteLink = `${appUrl}/s/${est.slug || estId}`;

    await resend.emails.send({
      from: "Musa Agenda <notificacoes@musaagenda.com.br>",
      to: ownerEmail,
      subject: `🎉 ${safeOwner}, seu estabelecimento ${safeEstab} está no ar!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #fdf2f8; padding: 20px; }
            .container { background-color: white; border-radius: 12px; padding: 30px; max-width: 600px; margin: 0 auto; }
            h1 { color: #db2777; margin-top: 0; }
            .content { color: #374151; line-height: 1.6; }
            .btn { display: inline-block; padding: 12px 24px; background-color: #ec4899; color: white; border-radius: 8px; text-decoration: none; margin: 10px 8px 10px 0; }
            .btn-secondary { background-color: #ffffff; color: #db2777; border: 1px solid #fbcfe8; }
            .badge { display: inline-block; padding: 4px 12px; background-color: #fef3c7; color: #92400e; font-size: 12px; border-radius: 9999px; margin-bottom: 16px; }
            .footer { margin-top: 30px; font-size: 12px; color: #9ca3af; text-align: center; }
            ol.plano li { margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <span class="badge">🕒 Período Teste Gratuito • 15 dias</span>
            <h1>Olá, ${safeOwner}!</h1>
            <div class="content">
              <p>Parabéns! O <strong>${safeEstab}</strong> foi criado com sucesso na <strong>Musa Agenda</strong>.</p>
              <p>Seu período de teste gratuito de 15 dias já está ativo — explore todos os recursos sem compromisso.</p>
              <p>📌 <strong>Primeiros passos recomendados:</strong></p>
              <ol class="plano">
                <li>Cadastre seus <strong>serviços</strong> (procedimentos, duração e preços)</li>
                <li>Adicione sua <strong>equipe</strong> (profissionais/staff com acesso controlado)</li>
                <li>Configure os <strong>horários de atendimento</strong> de cada profissional</li>
                <li>Compartilhe seu <strong>minisite público</strong> com as clientes</li>
              </ol>
              <p>
                <a class="btn" href="${appUrl}/login">Acessar Painel Admin</a>
                <a class="btn btn-secondary" href="${minisiteLink}">Ver Meu Minisite Público</a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">
                ID do estabelecimento: ${safeEstId}<br>
                E-mail cadastrado: ${safeEmail}
              </p>
              <p style="font-size: 13px; color: #6b7280;">
                Dúvidas? Responda diretamente este e-mail. Estamos aqui para ajudar 💖
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Musa Agenda. Todos os direitos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    logger.info(`[onEstablishmentCreated] Welcome ADMIN enviado para ${ownerEmail} (est=${estId}).`);
  } catch (err) {
    logger.warn(`[onEstablishmentCreated] Erro ao enviar welcome admin do est ${estId}:`, err);
  }
});

// ============================================================
// B-12: Push Notifications FCM (Appointments)
//      Trigger onDocumentWritten detecta 4 eventos:
//        - created (agendamento criado por cliente/admin)
//        - cancelled (status -> cancelled)
//        - rescheduled (data_hora mudou)
//        - completed (status -> completed)
//      Busca fcmTokens[] no users.doc do user_id e envia multicast.
// ============================================================

exports.onAppointmentUpdated = onDocumentWritten({
  document: "appointments/{appId}",
  region: "southamerica-east1"
}, async (event) => {
  const before = event.data?.before;
  const after = event.data?.after;
  const beforeData = before && before.exists ? before.data() : null;
  const afterData = after && after.exists ? after.data() : null;
  const appId = event.params.appId;

  // Detecta o evento
  const wasCreated = !beforeData && afterData;
  const wasDeleted = beforeData && !afterData;
  if (wasDeleted) return; // Não notifica após exclusão

  const statusBefore = beforeData?.status || 'pending';
  const statusAfter = afterData?.status || 'pending';
  const startTimeBefore = beforeData?.data_hora?._seconds || beforeData?.data_hora?.getTime?.() || null;
  const startTimeAfter = afterData?.data_hora?._seconds || afterData?.data_hora?.getTime?.() || null;
  const wasCancelled = !wasCreated && statusAfter === 'cancelled' && statusBefore !== 'cancelled';
  const wasCompleted = !wasCreated && (statusAfter === 'completed' || statusAfter === 'APPROVED_OR_COMPLETED') && statusBefore !== statusAfter;
  const wasRescheduled = !wasCreated && !wasCancelled && startTimeBefore && startTimeAfter && startTimeBefore !== startTimeAfter;

  let payload = null;
  if (wasCreated) {
    const data = afterData.data_hora ? (afterData.data_hora.toDate ? afterData.data_hora.toDate() : new Date(afterData.data_hora)) : null;
    const dataStr = data ? `${data.getDate().toString().padStart(2,'0')}/${(data.getMonth()+1).toString().padStart(2,'0')} às ${data.getHours().toString().padStart(2,'0')}:${data.getMinutes().toString().padStart(2,'0')}` : '';
    payload = {
      title: 'Agendamento Confirmado! ✅',
      body: `${afterData.establishment_name || 'Sua estética'}: ${afterData.service_nome || 'Serviço'} para ${dataStr}.`,
      tag: 'confirmed'
    };
  } else if (wasCancelled) {
    payload = {
      title: 'Agendamento Cancelado ❌',
      body: `${afterData.establishment_name || 'Sua estética'}: Seu horário de ${afterData.service_nome || 'atendimento'} foi cancelado.`,
      tag: 'cancelled'
    };
  } else if (wasRescheduled) {
    const data = afterData.data_hora ? (afterData.data_hora.toDate ? afterData.data_hora.toDate() : new Date(afterData.data_hora)) : null;
    const dataStr = data ? `${data.getDate().toString().padStart(2,'0')}/${(data.getMonth()+1).toString().padStart(2,'0')} às ${data.getHours().toString().padStart(2,'0')}:${data.getMinutes().toString().padStart(2,'0')}` : '';
    payload = {
      title: 'Horário Alterado 📅',
      body: `Seu agendamento foi remarcado para ${dataStr}. Confira os detalhes.`,
      tag: 'rescheduled'
    };
  } else if (wasCompleted) {
    payload = {
      title: 'Atendimento Finalizado ✨',
      body: `Esperamos que tenha amado! Até a próxima 💖`,
      tag: 'completed'
    };
  }

  if (!payload) return;

  // Determina quem vai receber a push
  const userId = afterData?.user_id || beforeData?.user_id;
  if (!userId || userId === 'manual') return;

  try {
    const userSnap = await admin.firestore().collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();
    const tokens = Array.isArray(userData.fcmTokens) ? userData.fcmTokens.filter(t => typeof t === 'string' && t.length > 20) : [];
    if (tokens.length === 0) return;

    const message = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body
      },
      android: {
        notification: {
          channelId: 'appointments',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          tag: payload.tag,
          color: '#db2777',
          notificationCount: 1
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: 'APPOINTMENT_CATEGORY'
          }
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: payload.tag,
          timestamp: Date.now()
        },
        fcmOptions: {
          link: typeof process.env.APP_URL === 'string' ? `${process.env.APP_URL}/agenda` : undefined
        }
      },
      data: {
        appointment_id: appId,
        establishment_id: String(afterData?.establishment_id || beforeData?.establishment_id || ''),
        action: payload.tag,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const res = await admin.messaging().sendEachForMulticast(message);
    if (res.failureCount > 0) {
      const staleTokens = [];
      res.responses.forEach((r, idx) => {
        const err = r.error?.code;
        if (
          err === 'messaging/invalid-registration-token' ||
          err === 'messaging/registration-token-not-registered'
        ) staleTokens.push(tokens[idx]);
      });
      if (staleTokens.length > 0) {
        try {
          const filtered = tokens.filter(t => !staleTokens.includes(t));
          await admin.firestore().collection("users").doc(userId).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens),
            [`fcmTokens`]: filtered
          });
          logger.info(`[onAppointmentUpdated] Limpeza de ${staleTokens.length} tokens inválidos do user ${userId}.`);
        } catch (e) {
          logger.warn(`[onAppointmentUpdated] Falha limpeza tokens stale:`, e);
        }
      }
    }
    logger.info(`[onAppointmentUpdated] ${payload.tag} appt=${appId} user=${userId}: success=${res.successCount} failed=${res.failureCount}`);
  } catch (err) {
    logger.warn(`[onAppointmentUpdated] Erro FCM push appt=${appId} user=${userId}:`, err);
  }
});

