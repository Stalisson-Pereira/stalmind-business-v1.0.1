import { GoogleGenAI } from '@google/genai';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const GEMINI_MODEL = 'gemini-3.6-flash';

const apiKey =
  import.meta.env.VITE_GEMINI_API_KEY?.trim() || '';

let aiClient: GoogleGenAI | null = null;

// ============================================================
// INICIALIZAÇÃO DO GEMINI
// ============================================================

if (
  apiKey &&
  apiKey !== 'MY_GEMINI_API_KEY'
) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
    });

    console.info(
      '[StalMind AI] Cliente Gemini inicializado.'
    );

    console.info(
      `[StalMind AI] Modelo: ${GEMINI_MODEL}`
    );
  } catch (error) {
    console.error(
      '[StalMind AI] Falha ao inicializar GoogleGenAI:',
      error
    );

    aiClient = null;
  }
} else {
  console.warn(
    '[StalMind AI] GEMINI API KEY não configurada.'
  );

  console.warn(
    '[StalMind AI] O sistema utilizará o fallback local.'
  );
}

// ============================================================
// TIPOS
// ============================================================

interface AIContextInfo {
  workspaceName?: string;
  customerCount?: number;
  openQuotesCount?: number;
}

// ============================================================
// NORMALIZAÇÃO DE ERROS
// ============================================================

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    try {
      return JSON.stringify(error);
    } catch {
      return 'Erro desconhecido.';
    }
  }

  return String(error);
}

// ============================================================
// IDENTIFICAÇÃO DE ERROS GEMINI
// ============================================================

function getGeminiErrorType(
  error: unknown
): string {
  const message =
    getErrorMessage(error).toLowerCase();

  if (
    message.includes('404') ||
    message.includes('not_found') ||
    message.includes('not found') ||
    message.includes('no longer available')
  ) {
    return 'MODEL_NOT_FOUND';
  }

  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('api key') ||
    message.includes('permission')
  ) {
    return 'AUTHORIZATION';
  }

  if (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted')
  ) {
    return 'RATE_LIMIT';
  }

  if (
    message.includes('400') ||
    message.includes('bad request')
  ) {
    return 'BAD_REQUEST';
  }

  if (
    message.includes('500') ||
    message.includes('internal') ||
    message.includes('503') ||
    message.includes('unavailable')
  ) {
    return 'SERVER_ERROR';
  }

  return 'UNKNOWN';
}

// ============================================================
// SYSTEM INSTRUCTION
// ============================================================

function buildSystemInstruction(
  contextInfo?: AIContextInfo
): string {
  const workspaceName =
    contextInfo?.workspaceName ||
    'Sua Empresa';

  const customerCount =
    typeof contextInfo?.customerCount === 'number'
      ? contextInfo.customerCount
      : null;

  const openQuotesCount =
    typeof contextInfo?.openQuotesCount === 'number'
      ? contextInfo.openQuotesCount
      : null;

  return `
Você é o StalMind AI, o assistente executivo inteligente do StalMind Business OS.

O StalMind Business OS é uma plataforma de gestão empresarial para autónomos, freelancers, empreendedores e pequenas e médias empresas.

Seu objetivo é ajudar o utilizador a tomar decisões melhores, trabalhar mais rápido e gerir o negócio de forma prática e profissional.

PRINCIPAIS ÁREAS DE ATUAÇÃO:

1. Orçamentos e propostas comerciais
- Criar orçamentos profissionais.
- Melhorar propostas comerciais.
- Sugerir estrutura de preços.
- Ajudar na definição de condições de pagamento.
- Criar argumentos de valor.
- Criar follow-ups para propostas enviadas.

2. Clientes
- Criar mensagens profissionais.
- Criar mensagens de follow-up.
- Criar mensagens de cobrança.
- Ajudar na retenção de clientes.
- Sugerir estratégias de relacionamento.
- Ajudar a recuperar clientes inativos.

3. Vendas
- Melhorar conversão.
- Criar estratégias comerciais.
- Identificar oportunidades de cross-selling.
- Criar scripts de vendas.
- Sugerir ações comerciais práticas.

4. Gestão financeira
- Explicar conceitos financeiros de forma simples.
- Ajudar com precificação.
- Ajudar na organização de receitas e despesas.
- Sugerir estratégias para melhorar margem e fluxo de caixa.

5. Gestão empresarial
- Ajudar na organização administrativa.
- Sugerir processos.
- Criar planos de ação.
- Ajudar o utilizador a interpretar indicadores do negócio.

REGRAS DE COMUNICAÇÃO:

- Responda sempre em Português.
- Utilize Português claro, natural e profissional.
- Seja objetivo, mas suficientemente detalhado.
- Não invente dados do negócio.
- Quando não possuir determinada informação, diga claramente que não possui essa informação.
- Use Markdown quando melhorar a organização da resposta.
- Utilize títulos, listas e tabelas quando forem úteis.
- Evite respostas genéricas.
- Sempre que possível, transforme a pergunta em ações práticas.
- Não diga que é um modelo de linguagem.
- Apresente-se como StalMind AI quando necessário.

CONTEXTO ATUAL DO NEGÓCIO:

Empresa/Workspace:
${workspaceName}

Quantidade de clientes conhecida:
${
  customerCount !== null
    ? customerCount
    : 'Não informada'
}

Orçamentos em aberto conhecidos:
${
  openQuotesCount !== null
    ? openQuotesCount
    : 'Não informado'
}

IMPORTANTE:

Os dados acima são apenas o contexto atualmente fornecido pela aplicação.

Não invente clientes, vendas, faturamentos, produtos, valores ou outros dados que não estejam disponíveis no contexto.

Quando o utilizador pedir uma análise baseada em dados que não foram fornecidos, explique quais dados seriam necessários.
`.trim();
}

// ============================================================
// GEMINI SERVICE
// ============================================================

export const geminiService = {

  // ==========================================================
  // GERAR RESPOSTA
  // ==========================================================

  async generateResponse(
    prompt: string,
    contextInfo?: AIContextInfo
  ): Promise<string> {

    const cleanPrompt =
      prompt?.trim();

    console.info(
      '[StalMind AI] ================================='
    );

    console.info(
      '[StalMind AI] Nova solicitação'
    );

    console.info(
      '[StalMind AI] Modelo:',
      GEMINI_MODEL
    );

    console.info(
      '[StalMind AI] Prompt:',
      cleanPrompt
    );

    console.info(
      '[StalMind AI] Workspace:',
      contextInfo?.workspaceName ||
        'Não informado'
    );

    if (!cleanPrompt) {
      console.warn(
        '[StalMind AI] Prompt vazio.'
      );

      return 'Por favor, escreva uma pergunta para que eu possa ajudá-lo.';
    }

    // ========================================================
    // GEMINI
    // ========================================================

    if (aiClient) {

      try {

        console.info(
          '[StalMind AI] Enviando solicitação para Gemini...'
        );

        const systemInstruction =
          buildSystemInstruction(
            contextInfo
          );

        const response =
          await aiClient.models.generateContent({

            model:
              GEMINI_MODEL,

            contents:
              cleanPrompt,

            config: {
              systemInstruction,
            },

          });

        const text =
          response.text?.trim();

        console.info(
          '[StalMind AI] Resposta recebida do Gemini.'
        );

        if (text) {

          console.info(
            '[StalMind AI] Resposta válida.'
          );

          console.info(
            '[StalMind AI] ================================='
          );

          return text;
        }

        console.warn(
          '[StalMind AI] Gemini respondeu sem conteúdo.'
        );

      } catch (error) {

        const errorType =
          getGeminiErrorType(error);

        const errorMessage =
          getErrorMessage(error);

        console.error(
          '[StalMind AI] Falha na API Gemini.'
        );

        console.error(
          '[StalMind AI] Tipo:',
          errorType
        );

        console.error(
          '[StalMind AI] Mensagem:',
          errorMessage
        );

        switch (errorType) {

          case 'MODEL_NOT_FOUND':

            console.error(
              `[StalMind AI] O modelo ${GEMINI_MODEL} não está disponível para esta configuração.`
            );

            break;

          case 'AUTHORIZATION':

            console.error(
              '[StalMind AI] Verifique a GEMINI API KEY e as permissões do projeto.'
            );

            break;

          case 'RATE_LIMIT':

            console.error(
              '[StalMind AI] Limite ou quota da API Gemini atingido.'
            );

            break;

          case 'BAD_REQUEST':

            console.error(
              '[StalMind AI] A requisição enviada para Gemini é inválida.'
            );

            break;

          case 'SERVER_ERROR':

            console.error(
              '[StalMind AI] O serviço Gemini apresentou um erro temporário.'
            );

            break;

          default:

            console.error(
              '[StalMind AI] Erro não identificado na API Gemini.'
            );
        }

        console.warn(
          '[StalMind AI] Ativando fallback local.'
        );
      }

    } else {

      console.warn(
        '[StalMind AI] Cliente Gemini indisponível.'
      );

      console.warn(
        '[StalMind AI] Utilizando fallback local.'
      );
    }

    // ========================================================
    // FALLBACK
    // ========================================================

    console.info(
      '[StalMind AI] Executando fallback empresarial...'
    );

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 500)
    );

    const lower =
      cleanPrompt.toLowerCase();

    // ========================================================
    // ORÇAMENTOS / PROPOSTAS / PREÇOS
    // ========================================================

    if (
      lower.includes('orçamento') ||
      lower.includes('orcamento') ||
      lower.includes('proposta') ||
      lower.includes('preço') ||
      lower.includes('preco') ||
      lower.includes('cobrar')
    ) {

      return `
### 💡 Sugestão Estratégica de Orçamento e Precificação

Para criar uma proposta comercial mais forte no **StalMind Business OS**, recomendo estruturar a oferta em três níveis:

#### 1. Essencial
Inclua apenas o escopo principal necessário para resolver o problema do cliente.

#### 2. Recomendado
Adicione benefícios complementares, acompanhamento ou suporte adicional.

Essa deve ser a opção que apresenta a melhor relação entre valor e preço.

#### 3. Premium
Inclua atendimento prioritário, maior acompanhamento, personalização ou serviços adicionais.

### Condições comerciais

- Defina claramente o prazo de validade da proposta.
- Especifique as condições de pagamento.
- Descreva exatamente o que está incluído.
- Informe o prazo de execução.
- Evite deixar custos importantes implícitos.

### Próximo passo

No StalMind, utilize a área de **Orçamentos** para estruturar a proposta, calcular impostos e apresentar os valores ao cliente.
      `.trim();
    }

    // ========================================================
    // CLIENTES / COBRANÇA / MENSAGENS
    // ========================================================

    if (
      lower.includes('mensagem') ||
      lower.includes('cobrança') ||
      lower.includes('cobranca') ||
      lower.includes('cliente') ||
      lower.includes('atraso') ||
      lower.includes('follow-up')
    ) {

      const company =
        contextInfo?.workspaceName ||
        'Sua Empresa';

      return `
### ✉️ Modelo de Comunicação Profissional

**Assunto:** Acompanhamento e atualização

Olá!

Espero que esteja tudo bem.

Gostaria de fazer um breve acompanhamento relativamente aos serviços/documentação enviados anteriormente.

Caso tenha alguma dúvida, necessite de algum esclarecimento ou precise de uma segunda via dos documentos, estou totalmente disponível para ajudar.

Agradeço desde já pela atenção e pela parceria.

Com os melhores cumprimentos,  
**${company}**
      `.trim();
    }

    // ========================================================
    // VENDAS / FATURAÇÃO / RECEITA
    // ========================================================

    if (
      lower.includes('vendas') ||
      lower.includes('venda') ||
      lower.includes('fatura') ||
      lower.includes('faturação') ||
      lower.includes('faturacao') ||
      lower.includes('receita') ||
      lower.includes('crescer')
    ) {

      return `
### 📈 Ações Práticas para Aumentar a Receita

Algumas ações que podem gerar impacto comercial:

#### 1. Follow-up de orçamentos

Não deixe propostas enviadas sem acompanhamento.

Crie uma rotina para contactar o cliente alguns dias após o envio.

#### 2. Venda cruzada

Analise os serviços ou produtos que os clientes atuais já utilizam e identifique soluções complementares.

#### 3. Reativação

Identifique clientes que deixaram de comprar e crie uma campanha específica para reativação.

#### 4. Acompanhe os indicadores

Monitore regularmente:

- Vendas
- Receita
- Margem
- Clientes ativos
- Clientes inativos
- Orçamentos enviados
- Orçamentos convertidos

O objetivo não é apenas vender mais, mas aumentar a rentabilidade do negócio.
      `.trim();
    }

    // ========================================================
    // FALLBACK PADRÃO
    // ========================================================

    return `
Olá! Sou o **StalMind AI**, o seu assistente executivo inteligente.

Posso ajudá-lo com:

- 📝 **Orçamentos e propostas comerciais**
- 💬 **Mensagens e follow-ups para clientes**
- 💰 **Precificação e negociação**
- 📊 **Estratégias de vendas**
- 👥 **Gestão de clientes**
- 📈 **Crescimento e organização do negócio**
- 🏢 **Gestão do seu workspace**

Diga-me o que pretende fazer e vou ajudá-lo a transformar a ideia em uma ação prática.
    `.trim();
  },
};
