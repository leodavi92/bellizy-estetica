const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const mercadopago = require("mercadopago");
const { Resend } = require("resend");
const logger = require("firebase-functions/logger");

admin.initializeApp();

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

        const now = admin.firestore.Timestamp.now();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await admin.firestore().collection("establishments").doc(establishmentId).update({
          "subscription.status": "active",
          "subscription.plan": planId,
          "subscription.last_payment_id": id,
          "subscription.last_payment_at": now,
          "subscription.current_period_start": now,
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
