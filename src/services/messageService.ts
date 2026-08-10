import { Message, MessageTemplate, MessageCategory } from '../types';

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl_1',
    category: 'quote',
    title: 'Envio de Proposta / Orçamento',
    content: 'Olá {cliente},\n\nEspero que esteja bem! Conforme conversado, envio em anexo a nossa proposta de orçamento ({orcamento}) para a sua apreciação.\n\nFico à total disposição para esclarecer qualquer dúvida ou ajustar os pontos do projeto.\n\nCom os melhores cumprimentos,\n{empresa}',
  },
  {
    id: 'tpl_2',
    category: 'followup',
    title: 'Acompanhamento de Proposta',
    content: 'Olá {cliente},\n\nGostaria de saber se teve oportunidade de analisar a proposta de orçamento ({orcamento}) enviada recentemente.\n\nPodemos agendar uma rápida chamada de 10 minutos para alinhar os detalhes e dar início aos trabalhos?\n\nUm abraço,\n{empresa}',
  },
  {
    id: 'tpl_3',
    category: 'billing',
    title: 'Lembrete Amigável de Pagamento',
    content: 'Estimado(a) {cliente},\n\nEsperamos que esteja a ter uma ótima semana.\n\nLembramos que a fatura/prestação do serviço em curso atinge o vencimento brevemente. Caso necessite de segunda via ou dados para transferência, não hesite em solicitar.\n\nMuito obrigado pelo profissionalismo e parceria.\n{empresa}',
  },
  {
    id: 'tpl_4',
    category: 'thanks',
    title: 'Agradecimento & Boas-Vindas',
    content: 'Olá {cliente},\n\nMuito obrigado por confiar na {empresa}! Estamos entusiasmados por começar a trabalhar no seu projeto e garantir os melhores resultados para o seu negócio.\n\nEm breve enviaremos os próximos passos.\n\nAtenciosamente,\n{empresa}',
  },
  {
    id: 'tpl_5',
    category: 'scheduling',
    title: 'Agendamento de Reunião',
    content: 'Olá {cliente},\n\nGostaria de agendar uma reunião de alinhamento para discutirmos os próximos passos do projeto. Quais dos seguintes horários funcionam melhor para si?\n\n1. Terça-feira às 10:00\n2. Quarta-feira às 15:00\n3. Quinta-feira às 11:30\n\nAguardamos a sua confirmação.\n{empresa}',
  },
  {
    id: 'tpl_6',
    category: 'confirmation',
    title: 'Confirmação de Serviço / Entrega',
    content: 'Olá {cliente},\n\nConfirmamos com satisfação a conclusão da fase/entrega do serviço acordado. Agradecemos a colaboração e permanecemos à disposição para suporte contínuo.\n\nAtenciosamente,\n{empresa}',
  },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg_01',
    workspaceId: 'ws_01',
    customerName: 'Mariana Costa (Nexus Tech)',
    customerEmail: 'mariana.costa@nexustech.pt',
    category: 'quote',
    title: 'Envio do Orçamento ORC-2026-001',
    content: 'Olá Mariana,\n\nConforme combinado, envio a proposta ORC-2026-001 para a consultoria de estratégia digital.\n\nCumprimentos,\nAlex Silva',
    status: 'sent',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'msg_02',
    workspaceId: 'ws_01',
    customerName: 'Inês Ferreira (Bloom Arquitetura)',
    customerEmail: 'ines@bloomarq.pt',
    category: 'followup',
    title: 'Follow-up de Diagnóstico Inicial',
    content: 'Olá Inês,\n\nConseguiu rever os detalhes da proposta para automação do CRM?\n\nAbraço,\nAlex',
    status: 'draft',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const STORAGE_KEY = 'stalmind_messages';

function getLocalMessages(): Message[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MESSAGES));
  return INITIAL_MESSAGES;
}

function saveLocalMessages(list: Message[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export const messageService = {
  async getMessages(workspaceId: string): Promise<Message[]> {
    return getLocalMessages().filter((m) => m.workspaceId === workspaceId || !m.workspaceId);
  },

  async addMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const list = getLocalMessages();
    const newMsg: Message = {
      ...data,
      id: `msg_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    list.unshift(newMsg);
    saveLocalMessages(list);
    return newMsg;
  },

  getTemplatesByCategory(category?: MessageCategory): MessageTemplate[] {
    if (!category) return MESSAGE_TEMPLATES;
    return MESSAGE_TEMPLATES.filter((t) => t.category === category);
  }
};
