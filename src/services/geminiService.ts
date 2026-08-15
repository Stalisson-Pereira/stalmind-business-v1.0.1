import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
    });
  } catch {
    aiClient = null;
  }
}

export const geminiService = {
  async generateResponse(
    prompt: string,
    contextInfo?: {
      workspaceName?: string;
      customerCount?: number;
      openQuotesCount?: number;
    }
  ): Promise<string> {
    if (aiClient) {
      try {
        const systemInstruction = `
Você é o Stalmind AI, o assistente virtual do Stalmind Business OS — um sistema operativo inteligente para autónomos, freelancers e pequenas empresas.

Seu objetivo é ser altamente prático, profissional, cortês e focado em resultados de negócios.

Você ajuda o utilizador a:
- Escrever orçamentos e propostas comerciais irresistíveis
- Elaborar e-mails e mensagens de cobrança, follow-up e vendas
- Dar conselhos práticos de gestão financeira
- Ajudar na negociação com clientes
- Apoiar na precificação de serviços
- Analisar a carteira de clientes e indicar ações para retenção
- Apoiar a organização e gestão do negócio

Responda sempre em Português claro, elegante e estruturado.
Use Markdown quando isso melhorar a compreensão.

Empresa do utilizador:
${contextInfo?.workspaceName || 'Sua Empresa'}

Número de clientes:
${contextInfo?.customerCount ?? 0}

Orçamentos em aberto:
${contextInfo?.openQuotesCount ?? 0}

Não invente dados que não estejam disponíveis no contexto.
Quando não possuir informações suficientes, informe claramente o utilizador.
        `.trim();

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch {
        // Silenciosamente utiliza o fallback abaixo.
      }
    }

    // ==========================================================
    // FALLBACK INTELIGENTE
    // ==========================================================

    await new Promise((resolve) => setTimeout(resolve, 800));

    const lower = prompt.toLowerCase();

    // ==========================================================
    // ORÇAMENTOS / PROPOSTAS / PREÇOS / COBRANÇA
    // ==========================================================

    if (
      lower.includes('orçamento') ||
      lower.includes('proposta') ||
      lower.includes('preço') ||
      lower.includes('cobrar')
    ) {
      return `### 💡 Sugestão Estratégica de Orçamento & Precificação

Para criar uma proposta convincente no **Stalmind**:

1. **Estrutura de Valor Escalonada**
   - **Opção Essencial:** Abrange o escopo básico necessário.
   - **Opção Recomendada:** Adiciona acompanhamento de 30 dias e relatórios.
   - **Opção Premium:** Inclui suporte prioritário ou acompanhamento personalizado.

2. **Garantias & Cláusulas Claras**
   - Especifique a validade da proposta, por exemplo, 15 dias.
   - Defina claramente as condições de pagamento.
   - Informe prazos, escopo, exclusões e condições de alteração.

3. **Próximo Passo**
   Você pode utilizar a área de **Orçamentos** do Stalmind para criar a proposta e calcular automaticamente os valores, IVA e totais.`;
    }

    // ==========================================================
    // CLIENTES / MENSAGENS / COBRANÇA
    // ==========================================================

    if (
      lower.includes('mensagem') ||
      lower.includes('cobrança') ||
      lower.includes('cliente') ||
      lower.includes('atraso')
    ) {
      return `### ✉️ Modelo de Comunicação Profissional

Aqui está um modelo equilibrado para contactar o seu cliente sem desgastar a relação comercial:

> **Assunto:** Lembrete de Alinhamento e Atualização de Conta — *${contextInfo?.workspaceName || 'Stalmind'}*
>
> Olá! Espero que esteja a ter uma ótima semana.
>
> Gostaria apenas de confirmar se recebeu os detalhes e a fatura referente aos serviços prestados recentemente.
>
> Caso necessite de algum esclarecimento, ajuste nos dados ou segunda via da documentação, estou à total disposição para ajudar.
>
> Agradeço desde já pela atenção e pela parceria.

**Dica:** Pode utilizar a secção **Mensagens** do Stalmind para guardar modelos reutilizáveis.`;
    }

    // ==========================================================
    // VENDAS / FATURAS / RECEITA / CRESCIMENTO
    // ==========================================================

    if (
      lower.includes('vendas') ||
      lower.includes('fatura') ||
      lower.includes('receita') ||
      lower.includes('crescer')
    ) {
      return `### 📈 Ações Práticas para Aumentar a Receita

Com base no contexto disponível do seu negócio:

- **Follow-up dos Orçamentos Enviados:** acompanhe propostas pendentes de resposta.
- **Venda Cruzada:** ofereça serviços ou produtos complementares aos clientes existentes.
- **Reativação de Clientes:** identifique clientes que não compram há algum tempo.
- **Acompanhamento de Receitas:** analise regularmente as vendas e os valores recebidos.
- **Melhoria da Margem:** reveja preços, custos e condições comerciais antes de aumentar apenas o volume de vendas.

O objetivo é transformar os dados do seu negócio em ações práticas.`;
    }

    // ==========================================================
    // RESPOSTA PADRÃO
    // ==========================================================

    return `Olá! Sou o **Stalmind AI**, o seu assistente executivo inteligente.

Como posso ajudar na gestão do seu negócio hoje?

- 📝 **Criar ou rever um orçamento**
- 💬 **Redigir mensagens estratégicas para clientes**
- 💰 **Ajudar com preços e negociação comercial**
- 📊 **Analisar clientes e orçamentos**
- 📈 **Encontrar oportunidades de crescimento**
- 🏢 **Ajudar na organização administrativa do seu workspace**

Sinta-se à vontade para perguntar qualquer questão relacionada com o seu dia a dia profissional.`;
  },
};
