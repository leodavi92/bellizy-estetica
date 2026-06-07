const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const mercadopago = require("mercadopago");
const logger = require("firebase-functions/logger");

admin.initializeApp();

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
