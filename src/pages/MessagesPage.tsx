import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import { customerService } from '../services/customerService';
import { geminiService } from '../services/geminiService';
import { Message, MessageCategory, MessageTemplate, Customer } from '../types';
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  Sparkles,
  Bot,
  Loader2,
  ExternalLink,
  Users,
} from 'lucide-react';

export const MessagesPage: React.FC = () => {
  const { workspace } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory>('quote');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    async function init() {
      if (!workspace) return;
      const custs = await customerService.getCustomers(workspace.id);
      setCustomers(custs);
      if (custs.length > 0) setSelectedCustomer(custs[0]);
    }
    init();
  }, [workspace]);

  const templates = messageService.getTemplatesByCategory(selectedCategory);

  const applyTemplate = (tpl: MessageTemplate) => {
    setTitle(tpl.title);
    let text = tpl.content;
    const clientName = selectedCustomer ? selectedCustomer.name : 'Cliente';
    const compName = workspace ? workspace.name : 'Sua Empresa';

    text = text
      .replace(/{cliente}/g, clientName)
      .replace(/{empresa}/g, compName)
      .replace(/{orcamento}/g, 'ORC-2026-001');

    setContent(text);
  };

  const handleEnhanceWithAI = async () => {
    if (!content.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const prompt = `Reescreva a seguinte mensagem comercial para um tom mais elegante, claro e persuasivo, mantendo o objetivo principal:\n\n"${content}"`;
      const improved = await geminiService.generateResponse(prompt, {
        workspaceName: workspace?.name,
      });
      setContent(improved);
    } catch (e) {
      console.error(e);
    } finally {
      setEnhancing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categories: { id: MessageCategory; label: string }[] = [
    { id: 'quote', label: 'Orçamento' },
    { id: 'followup', label: 'Follow-up' },
    { id: 'billing', label: 'Cobrança' },
    { id: 'thanks', label: 'Agradecimento' },
    { id: 'scheduling', label: 'Agendamento' },
    { id: 'confirmation', label: 'Confirmação' },
  ];

  const getWhatsAppUrl = () => {
    if (!selectedCustomer?.phone) return '';
    const cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    const encodedText = encodeURIComponent(content);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          Central de Mensagens Comerciais
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Prepare e envie comunicações profissionais via e-mail ou WhatsApp com auxílio de IA.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Category & Templates */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              1. Selecionar Cliente
            </label>
            <select
              value={selectedCustomer?.id || ''}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                if (found) setSelectedCustomer(found);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company || 'Pessoa Singular'})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              2. Categorias de Comunicação
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`p-2.5 rounded-xl text-xs font-semibold text-center transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              3. Modelos Recomendados
            </label>
            <div className="space-y-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-colors group"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {tpl.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {tpl.content}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Editor Box */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Editor de Mensagem
              </span>
              <button
                onClick={handleEnhanceWithAI}
                disabled={enhancing || !content.trim()}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {enhancing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>Aperfeiçoar tom com Stalmind AI</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assunto / Título
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Envio do Orçamento ORC-2026-001"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Corpo da Mensagem
              </label>
              <textarea
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escolha um modelo à esquerda ou digite a sua mensagem personalizada..."
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleCopy}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" /> Copiado para a área de transferência!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar Texto
                </>
              )}
            </button>

            {selectedCustomer?.phone && (
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-600/20"
              >
                <span>Enviar via WhatsApp Web</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
