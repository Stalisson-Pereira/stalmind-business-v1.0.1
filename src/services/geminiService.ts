import { GoogleGenAI } from '@google/genai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI with provided key:', err);
  }
}

export const geminiService = {
  async generateResponse(
    prompt: string,
    contextInfo?: { workspaceName?: string; customerCount?: number; openQuotesCount?: number }
  ): Promise<string> {
    if (aiClient) {
      try {
        const systemInstruction = `
Você é o Stalmind AI, o assistente virtual do Stalmind Business OS — um sistema operativo inteligente para autónomos, freelancers e pequenas empresas.
Seu objetivo é ser altamente prático, profissional, cortês e focado em resultados de negócios.
Você ajuda o utilizador a:
- Escrever orçamentos e propostas comerciais irresistíveis
- Elaborar e-mails/mensagens de cobrança, follow-up e vendas
- Dar conselhos práticos de gestão financeira, negociação com clientes e precificação de serviços
- Analisar a carteira de clientes e indicar ações para retenção
Responda sempre em Português claro, elegante e estruturado (usando formatação Markdown quando útil).
Empresa do utilizador: ${contextInfo?.workspaceName || 'Sua Empresa'}
        `.trim();

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch (error) {
        console.warn('Gemini API request failed or key is limited, falling back to business logic:', error);
      }
    }

    // Intelligent Fallback Logic tailored to Small Business prompts
    await new Promise((resolve) => setTimeout(resolve, 800)); // simulate thinking effect

    const lower = prompt.toLowerCase();

    if (lower.includes('orçamento') || lower.includes('proposta') || lower.includes('preço') || lower.includes('cobrar')) {
      return `### 💡 Sugestão Estratégica de Orçamento & Precificação

Para criar uma proposta convincente no **Stalmind**:

1. **Estrutura de Valor Escalonada:**
   - **Opção Essencial:** Abrange o escopo básico necessário.
   - **Opção Recomendada:** Adiciona acompanhamento de 30 dias e relatórios (maior margem).
   - **Opção Premium:** Inclui suporte prioritário 24/7 ou reuniões semanais.

2. **Garantias & Cláusulas Claras:**
   - Especifique a validade da proposta (ex: 15 dias).
   - Defina as condições de pagamento (ex: 50% de sinal no aceite e 50% na entrega).

3. **Próximo Passo:**
   Você pode ir para a aba **Orçamentos** do Stalmind e gerar o PDF diretamente para o seu cliente com calculadoras automáticas de IVA e totais!`;
    }

    if (lower.includes('mensagem') || lower.includes('cobrança') || lower.includes('cliente') || lower.includes('atraso')) {
      return `### ✉️ Modelo de Comunicação Profissional

Aqui está um modelo balanceado para contatar seu cliente sem desgastar a relação comercial:

> **Assunto:** Lembrete de Alinhamento e Atualização de Conta - *${contextInfo?.workspaceName || 'Stalmind'}*
>
> Olá! Espero que esteja a ter uma ótima semana.
>
> Gostaria apenas de verificar se recebeu os detalhes e a fatura referente aos serviços prestados recentemente. Caso precise de qualquer ajuste nos dados ou segunda via, estou à total disposição para ajudar.
>
> Agradeço desde já pelo profissionalismo e parceria de sempre.

*Dica:* Pode ir à secção **Mensagens** no menu lateral para guardar este e outros modelos reutilizáveis!`;
    }

    if (lower.includes('vendas') || lower.includes('fatura') || lower.includes('receita') || lower.includes('crescer')) {
      return `### 📈 Ações Práticas para Aumentar a Receita

Com base no perfil do seu negócio no Stalmind:

- **Follow-up nos Orçamentos Enviados:** Propostas sem acompanhamento perdem 60% da taxa de conversão. Envie um lembrete educado 3 dias após o envio.
- **Venda Cruzada (Cross-selling):** Ofereça serviços complementares aos seus clientes ativos (ex: manutenção mensal para quem comprou um projeto pontual).
- **Relatório de Clientes Inativos:** Identifique clientes que não compram há mais de 6 meses e ofereça uma condição especial de reativação.`;
    }

    return `Olá! Sou o **Stalmind AI**, seu assistente executivo inteligente.

Como posso ajudar no gerenciamento do seu negócio hoje?
- 📝 **Criar ou revisar um orçamento**
- 💬 **Redigir mensagens estratégicas para clientes**
- 💰 **Dicas de precificação e negociação comercial**
- 📊 **Organização administrativa do seu workspace**

Sinta-se à vontade para perguntar qualquer questão sobre o seu dia a dia profissional!`;
  }
};
