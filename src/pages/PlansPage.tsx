import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { Modal } from '../components/common/Modal';
import { supabase } from '../lib/supabaseClient';
import {
    Crown,
    Check,
    ShieldCheck,
    ArrowRight,
    HelpCircle,
    Clock,
    CheckCircle2,
    Gift,
    Star,
    AlertCircle,
} from 'lucide-react';

export interface PlanTier {
    id: 'Starter' | 'Pro' | 'Enterprise';
    name: string;
    tagline: string;
    monthlyPrice: number;
    annualPriceMonthly: number;
    popular?: boolean;
    features: string[];
    cta: string;
    color: string;
}

const PLAN_TIERS: PlanTier[] = [
    {
        id: 'Starter',
        name: 'Starter / Gratuito',
        tagline: 'Ideal para freelancers e negócios em fase inicial.',
        monthlyPrice: 0,
        annualPriceMonthly: 0,
        features: [
            'Até 10 clientes cadastrados',
            'Assistente IA (100 mensagens/mês)',
            'Emissão de até 5 orçamentos/mês',
            'Gestão de pagamentos básica',
            'Notificações por E-mail',
            'Suporte via ticket',
        ],
        cta: 'Começar Grátis',
        color: 'slate',
    },
    {
        id: 'Pro',
        name: 'Pro / Profissional',
        tagline: 'Para consultores, agências e PMEs que buscam escala com IA.',
        monthlyPrice: 19.99,
        annualPriceMonthly: 9.99,
        popular: true,
        features: [
            'Clientes e orçamentos ilimitados',
            'Assistente IA Ilimitado',
            'Links de Pagamento & Cobranças Automáticas',
            'Integrações PIX, PayPal, Stripe e SumUp',
            'Lembretes por WhatsApp & E-mail',
            'Relatórios e Análise Financeira',
            'Suporte Prioritário 24/7',
        ],
        cta: 'Experimentar 14 Dias Grátis',
        color: 'indigo',
    },
    {
        id: 'Enterprise',
        name: 'Enterprise / Negócios',
        tagline: 'Para equipas e empresas com altas demandas de automatização.',
        monthlyPrice: 69.99,
        annualPriceMonthly: 49.99,
        features: [
            'Tudo incluído no Plano Pro',
            'Múltiplas sub-contas e gestão de permissões',
            'Relatórios Financeiros Avançados com IA',
            'API Personalizada & Webhooks ilimitados',
            'Exportação contábil automática',
            'Gerente de Conta Dedicado',
            'SLA de suporte garantido em 1h',
        ],
        cta: 'Experimentar 14 Dias Grátis',
        color: 'violet',
    },
];

type TrialPlan = 'pro' | 'business';

interface TrialResult {
    success: boolean;
    workspace_id: string;
    plan: TrialPlan;
    trial_used: boolean;
    trial_started_at: string;
    trial_ends_at: string;
    days: number;
}

interface WorkspaceWithTrial {
    id?: string;
    plan?: string;
    planBilling?: 'monthly' | 'annually';
    trial_used?: boolean;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;
}

const TRIAL_DAYS = 14;

const PLAN_TO_RPC: Record<'Pro' | 'Enterprise', TrialPlan> = {
    Pro: 'pro',
    Enterprise: 'business',
};

export const PlansPage: React.FC = () => {
    const { workspace, updateWorkspace } = useAuth();

    const workspaceWithTrial = workspace as WorkspaceWithTrial | null;

    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>(
        workspaceWithTrial?.planBilling || 'monthly'
    );

    const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
    const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);

    const [isStartingTrial, setIsStartingTrial] = useState(false);
    const [trialStarted, setTrialStarted] = useState(false);
    const [trialResult, setTrialResult] = useState<TrialResult | null>(null);

    const [errorMessage, setErrorMessage] = useState('');

    const currentPlanId = useMemo(() => {
        const plan = workspaceWithTrial?.plan;

        if (!plan) {
            return 'Starter';
        }

        const normalized = String(plan).toLowerCase();

        if (normalized === 'pro') {
            return 'Pro';
        }

        if (
            normalized === 'enterprise' ||
            normalized === 'business'
        ) {
            return 'Enterprise';
        }

        return 'Starter';
    }, [workspaceWithTrial?.plan]);

    const trialEndsAt = useMemo(() => {
        if (!workspaceWithTrial?.trial_ends_at) {
            return null;
        }

        const date = new Date(workspaceWithTrial.trial_ends_at);

        if (Number.isNaN(date.getTime())) {
            return null;
        }

        return date;
    }, [workspaceWithTrial?.trial_ends_at]);

    const isTrialActive = useMemo(() => {
        if (!trialEndsAt) {
            return false;
        }

        return trialEndsAt.getTime() > Date.now();
    }, [trialEndsAt]);

    const trialAlreadyUsed = Boolean(
        workspaceWithTrial?.trial_used
    );

    const getDaysRemaining = (date: Date | null) => {
        if (!date) {
            return 0;
        }

        const difference = date.getTime() - Date.now();

        if (difference <= 0) {
            return 0;
        }

        return Math.ceil(
            difference / (1000 * 60 * 60 * 24)
        );
    };

    const daysRemaining = getDaysRemaining(trialEndsAt);

    useEffect(() => {
        if (!trialEndsAt || !isTrialActive) {
            return;
        }

        const interval = window.setInterval(() => {
            // Atualiza o componente periodicamente para o contador
            // refletir a passagem dos dias sem recarregar a página.
            setTrialResult((current) => current);
        }, 60_000);

        return () => window.clearInterval(interval);
    }, [trialEndsAt, isTrialActive]);

    const formatDate = (value: string | Date | null | undefined) => {
        if (!value) {
            return '';
        }

        const date =
            value instanceof Date
                ? value
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleDateString('pt-PT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const getPlanPrice = (plan: PlanTier) => {
        const price =
            billingCycle === 'annually'
                ? plan.annualPriceMonthly
                : plan.monthlyPrice;

        if (price === 0) {
            return 'Gratuito';
        }

        return `€${price.toFixed(2)}`;
    };

    const getAnnualTotal = (plan: PlanTier) => {
        return (plan.annualPriceMonthly * 12).toFixed(2);
    };

    const isCurrentPlan = (plan: PlanTier) => {
        return currentPlanId === plan.id;
    };

    const canStartTrial = (plan: PlanTier) => {
        if (plan.id === 'Starter') {
            return false;
        }

        if (trialAlreadyUsed) {
            return false;
        }

        if (isTrialActive) {
            return false;
        }

        return true;
    };

    const handleStarterActivation = async () => {
        if (currentPlanId === 'Starter') {
            return;
        }

        try {
            setErrorMessage('');

            await updateWorkspace({
                plan: 'Starter',
                planBilling: 'monthly',
            });

            const notifications =
                notificationService.getNotifications();

            notifications.unshift({
                id: `notif_${Date.now()}`,
                title: 'Plano alterado',
                message:
                    'O espaço de trabalho foi alterado para o Plano Starter Gratuito.',
                type: 'payment',
                read: false,
                createdAt: new Date().toISOString(),
                link: '/plans',
            });

            localStorage.setItem(
                'stalmind_app_notifications',
                JSON.stringify(notifications)
            );
        } catch (error) {
            console.error(
                '[PlansPage] Erro ao ativar Starter:',
                error
            );

            setErrorMessage(
                'Não foi possível alterar para o Plano Starter.'
            );
        }
    };

    const handleOpenPlan = (plan: PlanTier) => {
        setErrorMessage('');
        setTrialStarted(false);
        setTrialResult(null);

        if (plan.id === 'Starter') {
            void handleStarterActivation();
            return;
        }

        if (isCurrentPlan(plan)) {
            return;
        }

        if (trialAlreadyUsed) {
            setSelectedPlan(plan);
            setIsTrialModalOpen(true);
            return;
        }

        setSelectedPlan(plan);
        setIsTrialModalOpen(true);
    };

    const handleStartTrial = async () => {
        if (!selectedPlan || !workspace?.id) {
            setErrorMessage(
                'Não foi possível identificar o espaço de trabalho.'
            );
            return;
        }

        if (selectedPlan.id === 'Starter') {
            return;
        }

        if (trialAlreadyUsed) {
            setErrorMessage(
                'Este espaço de trabalho já utilizou o período de teste gratuito.'
            );
            return;
        }

        if (isTrialActive) {
            setErrorMessage(
                'Este espaço de trabalho já possui um período de teste ativo.'
            );
            return;
        }

        setIsStartingTrial(true);
        setErrorMessage('');

        try {
            const rpcPlan = PLAN_TO_RPC[selectedPlan.id];

            /*
             * IMPORTANTE:
             *
             * A RPC é responsável por:
             * - validar o utilizador;
             * - validar a membership;
             * - impedir segundo trial;
             * - ativar o plano;
             * - marcar trial_used;
             * - registrar trial_started_at;
             * - registrar trial_ends_at;
             * - definir 14 dias.
             *
             * Portanto NÃO fazemos pagamento aqui.
             */
            const { data, error } = await supabase.rpc(
                'start_workspace_trial',
                {
                    target_workspace: workspace.id,
                    selected_plan: rpcPlan,
                }
            );

            if (error) {
                throw error;
            }

            const result = data as TrialResult;

            if (!result?.success) {
                throw new Error(
                    'Não foi possível iniciar o período de teste.'
                );
            }

            /*
             * Mantém o estado global do workspace sincronizado.
             *
             * O banco continua sendo a fonte oficial do trial.
             */
            await updateWorkspace({
                plan: selectedPlan.id,
                planBilling: billingCycle,
            });

            setTrialResult(result);
            setTrialStarted(true);

            const notifications =
                notificationService.getNotifications();

            notifications.unshift({
                id: `notif_${Date.now()}`,
                title: '🎉 Teste gratuito ativado',
                message: `O ${selectedPlan.name} foi ativado por 14 dias gratuitamente. O período termina em ${formatDate(
                    result.trial_ends_at
                )}.`,
                type: 'payment',
                read: false,
                createdAt: new Date().toISOString(),
                link: '/plans',
            });

            localStorage.setItem(
                'stalmind_app_notifications',
                JSON.stringify(notifications)
            );
        } catch (error: any) {
            console.error(
                '[PlansPage] Erro ao iniciar trial:',
                error
            );

            const message =
                error?.message ||
                'Não foi possível iniciar o período de teste gratuito.';

            setErrorMessage(message);
        } finally {
            setIsStartingTrial(false);
        }
    };

    return (
        <div className="space-y-8 pb-12 max-w-7xl mx-auto">

            {/* =====================================================
                CABEÇALHO
            ====================================================== */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Planos Comerciais & Subscrição</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Planos transparentes para cada etapa do seu negócio
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    Escolha o plano ideal, experimente gratuitamente por
                    <strong className="text-indigo-600 dark:text-indigo-400">
                        {' '}14 dias
                    </strong>{' '}
                    e decida depois se quer continuar.
                </p>

                {/* =================================================
                    STATUS DO PLANO / TRIAL
                ================================================== */}
                <div className="flex flex-col items-center gap-3">

                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">

                        <ShieldCheck className="w-4 h-4 text-emerald-500" />

                        <span>
                            Plano atual:{' '}
                            <strong className="text-indigo-600 dark:text-indigo-400">
                                {currentPlanId}
                            </strong>
                        </span>

                    </div>

                    {isTrialActive && trialEndsAt && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">

                            <Gift className="w-4 h-4" />

                            <span>
                                Teste gratuito ativo —{' '}
                                {daysRemaining} dias restantes
                            </span>

                        </div>
                    )}

                    {trialAlreadyUsed && !isTrialActive && (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400">

                            <Clock className="w-4 h-4" />

                            <span>
                                O período de teste gratuito já foi utilizado.
                            </span>

                        </div>
                    )}

                </div>

                {/* =================================================
                    CICLO DE FATURAÇÃO
                ================================================== */}
                <div className="pt-4 flex items-center justify-center gap-3">

                    <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={`text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                            billingCycle === 'monthly'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400'
                        }`}
                    >
                        Faturação Mensal
                    </button>

                    <button
                        type="button"
                        aria-label="Alternar ciclo de faturação"
                        onClick={() =>
                            setBillingCycle(
                                billingCycle === 'monthly'
                                    ? 'annually'
                                    : 'monthly'
                            )
                        }
                        className={`relative inline-flex h-7 w-14 shrink-0 rounded-full transition-colors ${
                            billingCycle === 'annually'
                                ? 'bg-indigo-600'
                                : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-200 ${
                                billingCycle === 'annually'
                                    ? 'translate-x-7'
                                    : 'translate-x-0'
                            }`}
                        />
                    </button>

                    <button
                        type="button"
                        onClick={() => setBillingCycle('annually')}
                        className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${
                            billingCycle === 'annually'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400'
                        }`}
                    >
                        Faturação Anual

                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                            Poupe até 20%
                        </span>
                    </button>

                </div>
            </div>

            {/* =====================================================
                CARDS DOS PLANOS
            ====================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">

                {PLAN_TIERS.map((plan) => {

                    const current = isCurrentPlan(plan);
                    const popular = plan.popular;

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                                popular
                                    ? 'bg-gradient-to-b from-indigo-900/10 via-slate-900/90 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10'
                                    : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-lg'
                            }`}
                        >

                            {popular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    Mais Recomendado
                                </div>
                            )}

                            <div>

                                <div className="flex items-center justify-between gap-2 mb-2">

                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {plan.name}
                                    </h3>

                                    {current && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                            Plano Atual
                                        </span>
                                    )}

                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px]">
                                    {plan.tagline}
                                </p>

                                <div className="my-6 pb-6 border-b border-slate-100 dark:border-slate-800">

                                    <div className="flex items-baseline gap-1">

                                        <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                                            {getPlanPrice(plan)}
                                        </span>

                                        {plan.monthlyPrice > 0 && (
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                /mês
                                            </span>
                                        )}

                                    </div>

                                    {billingCycle === 'annually' &&
                                        plan.monthlyPrice > 0 && (
                                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                                Faturado anualmente (€{getAnnualTotal(plan)}/ano)
                                            </p>
                                        )}

                                </div>

                                <div className="space-y-3">

                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                                        O que está incluído:
                                    </p>

                                    <ul className="space-y-2.5">

                                        {plan.features.map(
                                            (feature, index) => (
                                                <li
                                                    key={index}
                                                    className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300"
                                                >
                                                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                    <span>
                                                        {feature}
                                                    </span>
                                                </li>
                                            )
                                        )}

                                    </ul>

                                </div>

                            </div>

                            <div className="pt-8">

                                <button
                                    type="button"
                                    onClick={() =>
                                        handleOpenPlan(plan)
                                    }
                                    disabled={current}
                                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                                        current
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                            : popular
                                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer'
                                                : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white cursor-pointer'
                                    }`}
                                >

                                    <span>
                                        {current
                                            ? 'Plano Atual Ativo'
                                            : plan.cta}
                                    </span>

                                    {!current && (
                                        <ArrowRight className="w-4 h-4" />
                                    )}

                                </button>

                            </div>

                        </div>
                    );
                })}

            </div>

            {/* =====================================================
                BANNER 14 DIAS
            ====================================================== */}
            <div className="rounded-3xl bg-gradient-to-r from-indigo-950 via-slate-900 to-violet-950 text-white p-6 sm:p-8 border border-indigo-800/50 shadow-xl">

                <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                    <div className="text-center md:text-left">

                        <div className="flex items-center justify-center md:justify-start gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">

                            <Gift className="w-4 h-4" />

                            <span>Teste gratuito</span>

                        </div>

                        <h3 className="text-lg sm:text-xl font-bold mt-2">
                            Experimente o Pro ou Enterprise por 14 dias
                        </h3>

                        <p className="text-xs text-slate-400 max-w-2xl mt-2">
                            Não será cobrado nada ao iniciar o teste.
                            Escolha o plano, ative os 14 dias e decida
                            depois se deseja continuar.
                        </p>

                    </div>

                    <div className="shrink-0 text-center">

                        <div className="text-4xl font-black">
                            14
                        </div>

                        <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                            dias grátis
                        </div>

                    </div>

                </div>

            </div>

            {/* =====================================================
                FAQ
            ====================================================== */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6">

                <div className="flex items-center gap-2">

                    <HelpCircle className="w-5 h-5 text-indigo-500" />

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Dúvidas Frequentes sobre os Planos
                    </h2>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            Como funciona o teste gratuito?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Escolha o Pro ou Enterprise e clique em
                            “Experimentar 14 Dias Grátis”. O plano é
                            ativado imediatamente e você recebe 14 dias
                            de acesso sem cobrança.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            Preciso pagar para iniciar o teste?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Não. O início do período de teste não realiza
                            nenhuma cobrança.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            O que acontece depois dos 14 dias?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Ao terminar o teste, o plano entra no ciclo
                            de cobrança escolhido caso o cliente tenha
                            uma subscrição de pagamento configurada.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            Posso cancelar antes do fim do teste?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sim. O cliente pode cancelar antes do término
                            do período de teste sem pagar pelo período
                            experimental.
                        </p>

                    </div>

                </div>

            </div>

            {/* =====================================================
                MODAL DO TRIAL
            ====================================================== */}
            <Modal
                isOpen={isTrialModalOpen}
                onClose={() => {
                    if (!isStartingTrial) {
                        setIsTrialModalOpen(false);
                    }
                }}
                title={
                    trialStarted
                        ? 'Teste gratuito ativado!'
                        : `Experimentar ${selectedPlan?.name || ''}`
                }
            >

                {trialStarted && trialResult ? (

                    <div className="text-center py-6 space-y-5">

                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <div className="space-y-2">

                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                🎉 Os seus 14 dias começaram!
                            </h3>

                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                                O plano{' '}
                                <strong className="text-indigo-600 dark:text-indigo-400">
                                    {selectedPlan?.name}
                                </strong>{' '}
                                foi ativado gratuitamente.
                            </p>

                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 max-w-sm mx-auto space-y-3">

                            <div className="flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">

                                <Gift className="w-5 h-5" />

                                14 dias gratuitos

                            </div>

                            <div className="text-xs text-slate-600 dark:text-slate-300">

                                <div>
                                    Início:{' '}
                                    <strong>
                                        {formatDate(
                                            trialResult.trial_started_at
                                        )}
                                    </strong>
                                </div>

                                <div className="mt-1">

                                    Término:{' '}

                                    <strong>
                                        {formatDate(
                                            trialResult.trial_ends_at
                                        )}
                                    </strong>

                                </div>

                            </div>

                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">

                            <p>
                                <strong>
                                    Não foi realizado nenhum pagamento.
                                </strong>
                            </p>

                            <p className="mt-1">
                                Você poderá decidir continuar com o plano
                                após o período de teste.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setIsTrialModalOpen(false)
                            }
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                        >
                            Continuar para o Dashboard
                        </button>

                    </div>

                ) : (

                    <div className="space-y-6">

                        {/* RESUMO */}

                        <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">

                            <div className="flex items-start justify-between gap-4">

                                <div>

                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        Teste gratuito
                                    </span>

                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                                        {selectedPlan?.name}
                                    </h4>

                                </div>

                                <div className="text-right">

                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                        €0,00
                                    </div>

                                    <div className="text-[10px] text-slate-500">
                                        durante 14 dias
                                    </div>

                                </div>

                            </div>

                        </div>

                        {/* BENEFÍCIOS */}

                        <div className="space-y-3">

                            <div className="flex items-start gap-3">

                                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                                    <Gift className="w-4 h-4 text-emerald-500" />
                                </div>

                                <div>

                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        14 dias totalmente gratuitos
                                    </h4>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Tenha acesso ao plano escolhido
                                        sem cobrança durante o período
                                        experimental.
                                    </p>

                                </div>

                            </div>

                            <div className="flex items-start gap-3">

                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                </div>

                                <div>

                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Ativação imediata
                                    </h4>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Assim que confirmar, o plano fica
                                        disponível imediatamente.
                                    </p>

                                </div>

                            </div>

                            <div className="flex items-start gap-3">

                                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                </div>

                                <div>

                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                        Sem cobrança agora
                                    </h4>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Nenhum pagamento é processado ao
                                        iniciar o período experimental.
                                    </p>

                                </div>

                            </div>

                        </div>

                        {/* ALERTA */}

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">

                            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />

                            <div className="text-xs text-slate-600 dark:text-slate-300">

                                <strong className="text-slate-900 dark:text-white">
                                    Como funciona:
                                </strong>

                                <p className="mt-1">
                                    Clique em “Começar 14 Dias Grátis”.
                                    O período começa imediatamente.
                                    Depois dos 14 dias, você decide se
                                    quer continuar com a subscrição.
                                </p>

                            </div>

                        </div>

                        {/* ERRO */}

                        {errorMessage && (

                            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">

                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                                <span>
                                    {errorMessage}
                                </span>

                            </div>

                        )}

                        {/* BOTÃO */}

                        <button
                            type="button"
                            onClick={handleStartTrial}
                            disabled={
                                isStartingTrial ||
                                !selectedPlan ||
                                trialAlreadyUsed ||
                                isTrialActive
                            }
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                        >

                            {isStartingTrial ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    A iniciar os 14 dias...
                                </>
                            ) : (
                                <>
                                    <Gift className="w-4 h-4" />
                                    Começar 14 Dias Grátis
                                </>
                            )}

                        </button>

                        {trialAlreadyUsed && (
                            <p className="text-center text-[11px] text-amber-600 dark:text-amber-400">
                                Este workspace já utilizou o período
                                gratuito.
                            </p>
                        )}

                    </div>
                )}

            </Modal>

        </div>
    );
};
