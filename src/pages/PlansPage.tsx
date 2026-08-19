import React, {
    useEffect,
    useMemo,
    useState,
} from 'react';

import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { Modal } from '../components/common/Modal';
import { supabase } from '../lib/supabaseClient';

import {
    ArrowRight,
    Check,
    CheckCircle2,
    Clock,
    Crown,
    Gift,
    HelpCircle,
    ShieldCheck,
    Star,
    X,
} from 'lucide-react';

/* ============================================================
   TIPOS
============================================================ */

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

type BillingCycle = 'monthly' | 'annually';

type DatabasePlan = 'free' | 'pro' | 'enterprise';

interface TrialResult {
    success: boolean;
    workspace_id: string;
    plan: DatabasePlan;
    trial_used: boolean;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    days: number;
}

interface WorkspaceTrialState {
    plan?: DatabasePlan | string | null;
    planBilling?: BillingCycle | string | null;

    trialUsed?: boolean;
    trial_used?: boolean;

    trialStartedAt?: string | null;
    trial_started_at?: string | null;

    trialEndsAt?: string | null;
    trial_ends_at?: string | null;
}

interface LocalTrialState {
    used: boolean;
    startedAt: string | null;
    endsAt: string | null;
}

interface TrialRpcResponse {
    success?: boolean;

    workspace_id?: string;
    id?: string;

    plan?: DatabasePlan;

    trial_used?: boolean;
    trial_started_at?: string | null;
    trial_ends_at?: string | null;

    days?: number;

    name?: string;
}

/* ============================================================
   MAPA DE PLANOS
============================================================ */

const PLAN_DATABASE_MAP: Record<
    PlanTier['id'],
    DatabasePlan
> = {
    Starter: 'free',
    Pro: 'pro',
    Enterprise: 'enterprise',
};

/* ============================================================
   PLANOS
============================================================ */

const PLAN_TIERS: PlanTier[] = [
    {
        id: 'Starter',
        name: 'Starter / Gratuito',
        tagline:
            'Ideal para freelancers e negócios em fase inicial.',
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
        tagline:
            'Para consultores, agências e PMEs que buscam escala com IA.',
        monthlyPrice: 19.99,
        annualPriceMonthly: 9.99,
        popular: true,
        features: [
            'Clientes e orçamentos ilimitados',
            'Assistente IA Ilimitado (Gemini 2.5/3 Pro)',
            'Links de Pagamento & Cobranças Automáticas',
            'Integrações PIX, PayPal, Stripe e SumUp',
            'Lembretes por WhatsApp & E-mail',
            'Relatórios e Análise Financeira',
            'Suporte Prioritário 24/7',
        ],
        cta: 'Ativar Plano Pro',
        color: 'indigo',
    },

    {
        id: 'Enterprise',
        name: 'Enterprise / Negócios',
        tagline:
            'Para equipas e empresas com altas demandas de automatização.',
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
        cta: 'Ativar Enterprise',
        color: 'violet',
    },
];

/* ============================================================
   COMPONENTE
============================================================ */

export const PlansPage: React.FC = () => {
    const {
        workspace,
        updateWorkspace,
    } = useAuth();

    const [billingCycle, setBillingCycle] =
        useState<BillingCycle>('monthly');

    const [selectedPlan, setSelectedPlan] =
        useState<PlanTier | null>(null);

    const [isTrialModalOpen, setIsTrialModalOpen] =
        useState(false);

    const [isProcessing, setIsProcessing] =
        useState(false);

    const [trialSuccess, setTrialSuccess] =
        useState(false);

    const [trialResult, setTrialResult] =
        useState<TrialResult | null>(null);

    const [errorMessage, setErrorMessage] =
        useState<string | null>(null);

    const [localTrial, setLocalTrial] =
        useState<LocalTrialState>({
            used: false,
            startedAt: null,
            endsAt: null,
        });

    /* ============================================================
       DADOS DO WORKSPACE
    ============================================================ */

    const workspaceTrial =
        (workspace ?? {}) as WorkspaceTrialState;

    const databaseTrialUsed =
        workspaceTrial.trialUsed ??
        workspaceTrial.trial_used ??
        false;

    const databaseTrialStartedAt =
        workspaceTrial.trialStartedAt ??
        workspaceTrial.trial_started_at ??
        null;

    const databaseTrialEndsAt =
        workspaceTrial.trialEndsAt ??
        workspaceTrial.trial_ends_at ??
        null;

    useEffect(() => {
        setLocalTrial({
            used: databaseTrialUsed,
            startedAt: databaseTrialStartedAt,
            endsAt: databaseTrialEndsAt,
        });
    }, [
        databaseTrialUsed,
        databaseTrialStartedAt,
        databaseTrialEndsAt,
    ]);

    /* ============================================================
       TRIAL
    ============================================================ */

    const trialUsed =
        localTrial.used ||
        databaseTrialUsed;

    const trialStartedAt =
        localTrial.startedAt ??
        databaseTrialStartedAt;

    const trialEndsAt =
        localTrial.endsAt ??
        databaseTrialEndsAt;

    const trialIsActive =
        !!trialEndsAt &&
        new Date(trialEndsAt).getTime() >
            Date.now();

    /* ============================================================
       PLANO ATUAL
    ============================================================ */

    const currentPlanId =
        useMemo<PlanTier['id']>(() => {
            const value =
                workspace?.plan ?? 'free';

            switch (value) {
                case 'pro':
                    return 'Pro';

                case 'enterprise':
                    return 'Enterprise';

                case 'free':
                default:
                    return 'Starter';
            }
        }, [workspace?.plan]);

    /* ============================================================
       DIAS RESTANTES
    ============================================================ */

    const trialDaysRemaining =
        useMemo(() => {
            if (!trialEndsAt) {
                return 0;
            }

            const end =
                new Date(trialEndsAt).getTime();

            const now =
                Date.now();

            const diff =
                end - now;

            if (diff <= 0) {
                return 0;
            }

            return Math.ceil(
                diff /
                    (
                        1000 *
                        60 *
                        60 *
                        24
                    )
            );
        }, [trialEndsAt]);

    /* ============================================================
       PREÇO
    ============================================================ */

    const getPlanPrice = (
        plan: PlanTier
    ) => {
        const price =
            billingCycle === 'annually'
                ? plan.annualPriceMonthly
                : plan.monthlyPrice;

        if (price === 0) {
            return 'Gratuito';
        }

        return `€${price.toFixed(2)}`;
    };

    /* ============================================================
       NOTIFICAÇÃO
    ============================================================ */

    const createTrialNotification = (
        plan: PlanTier
    ) => {
        try {
            const notifications =
                notificationService.getNotifications();

            const updatedNotifications =
                Array.isArray(notifications)
                    ? [...notifications]
                    : [];

            updatedNotifications.unshift({
                id:
                    `notif_trial_${Date.now()}`,

                title:
                    'Período de teste iniciado 🎉',

                message:
                    `O plano ${plan.name} foi ativado gratuitamente por 14 dias. ` +
                    `Nenhum pagamento foi realizado agora.`,

                type: 'payment',

                read: false,

                createdAt:
                    new Date().toISOString(),

                link: '/plans',
            });

            localStorage.setItem(
                'stalmind_app_notifications',
                JSON.stringify(
                    updatedNotifications
                )
            );
        } catch (
            notificationError
        ) {
            console.warn(
                '[PlansPage] Não foi possível criar a notificação:',
                notificationError
            );
        }
    };

    /* ============================================================
       INICIAR TRIAL
    ============================================================ */

    const handleStartTrial = async (
        plan: PlanTier
    ) => {
        if (!workspace?.id) {
            setErrorMessage(
                'Não foi possível identificar o workspace atual.'
            );

            return;
        }

        if (plan.id === 'Starter') {
            await handleStarterPlan();
            return;
        }

        if (
            plan.id !== 'Pro' &&
            plan.id !== 'Enterprise'
        ) {
            setErrorMessage(
                'Plano inválido.'
            );

            return;
        }

        if (
            currentPlanId === plan.id &&
            trialIsActive
        ) {
            setErrorMessage(
                'Este plano já possui um período de teste ativo.'
            );

            return;
        }

        if (trialUsed) {
            setErrorMessage(
                'Este workspace já utilizou o período de teste gratuito de 14 dias.'
            );

            return;
        }

        setSelectedPlan(plan);
        setErrorMessage(null);
        setTrialSuccess(false);
        setTrialResult(null);
        setIsTrialModalOpen(true);
    };

    /* ============================================================
       CONFIRMAR TRIAL
    ============================================================ */

    const confirmStartTrial = async () => {
        if (
            !selectedPlan ||
            !workspace?.id
        ) {
            setErrorMessage(
                'Não foi possível identificar o workspace atual.'
            );

            return;
        }

        if (
            selectedPlan.id !== 'Pro' &&
            selectedPlan.id !== 'Enterprise'
        ) {
            setErrorMessage(
                'Plano inválido.'
            );

            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            const selectedPlanForDatabase =
                PLAN_DATABASE_MAP[
                    selectedPlan.id
                ];

            const {
                data,
                error,
            } = await supabase.rpc(
                'start_workspace_trial',
                {
                    target_workspace:
                        workspace.id,

                    selected_plan:
                        selectedPlanForDatabase,
                }
            );

            if (error) {
                console.error(
                    '[PlansPage] Erro ao iniciar trial:',
                    error
                );

                throw error;
            }

            console.log(
                '[PlansPage] Trial iniciado:',
                data
            );

            /* ====================================================
               NORMALIZAR RESPOSTA DA RPC
            ==================================================== */

            const rawResult =
                Array.isArray(data)
                    ? data[0]
                    : data;

            if (
                !rawResult ||
                typeof rawResult !== 'object'
            ) {
                throw new Error(
                    'O Supabase não retornou os dados do período de teste.'
                );
            }

            const result =
                rawResult as TrialRpcResponse;

            console.log(
                '[PlansPage] Resposta normalizada:',
                result
            );

            /* ====================================================
               VALIDAR TRIAL
            ==================================================== */

            const returnedPlan =
                result.plan ??
                selectedPlanForDatabase;

            const trialWasStarted =
                result.trial_used === true &&
                !!result.trial_started_at &&
                !!result.trial_ends_at &&
                (
                    returnedPlan ===
                        selectedPlanForDatabase
                );

            const explicitSuccess =
                result.success === true;

            if (
                !trialWasStarted &&
                !explicitSuccess
            ) {
                console.error(
                    '[PlansPage] Resposta inesperada da RPC:',
                    rawResult
                );

                throw new Error(
                    'O período de teste não foi confirmado pelo Supabase.'
                );
            }

            /* ====================================================
               ATUALIZAR WORKSPACE
            ==================================================== */

            await updateWorkspace({
                plan:
                    selectedPlanForDatabase,

                planBilling:
                    billingCycle,
            });

            /* ====================================================
               NOTIFICAÇÃO
            ==================================================== */

            createTrialNotification(
                selectedPlan
            );

            /* ====================================================
               ATUALIZAR TRIAL LOCAL
            ==================================================== */

            const startedAt =
                result.trial_started_at ??
                new Date().toISOString();

            const endsAt =
                result.trial_ends_at ??
                null;

            setLocalTrial({
                used:
                    result.trial_used ??
                    true,

                startedAt,

                endsAt,
            });

            /* ====================================================
               RESULTADO NORMALIZADO
            ==================================================== */

            const normalizedResult:
                TrialResult = {
                    success: true,

                    workspace_id:
                        result.workspace_id ??
                        result.id ??
                        workspace.id,

                    plan:
                        result.plan ??
                        selectedPlanForDatabase,

                    trial_used:
                        result.trial_used ??
                        true,

                    trial_started_at:
                        startedAt,

                    trial_ends_at:
                        endsAt,

                    days:
                        result.days ??
                        14,
                };

            setTrialResult(
                normalizedResult
            );

            /* ====================================================
               SUCESSO
            ==================================================== */

            setTrialSuccess(
                true
            );

            console.log(
                '[PlansPage] Trial confirmado com sucesso:',
                normalizedResult
            );
        } catch (
            error: unknown
        ) {
            console.error(
                '[PlansPage] Erro completo:',
                error
            );

            let message =
                'Não foi possível iniciar o período de teste.';

            if (
                typeof error === 'object' &&
                error !== null
            ) {
                const errorData =
                    error as {
                        code?: string;
                        status?: number;
                        message?: string;
                        details?: string;
                        hint?: string;
                    };

                if (
                    errorData.code ===
                        'PGRST202' ||
                    errorData.status ===
                        404
                ) {
                    message =
                        'A função start_workspace_trial não foi encontrada ou sua assinatura está incorreta no Supabase.';
                } else if (
                    errorData.code ===
                    '42501'
                ) {
                    message =
                        'Você não possui permissão para iniciar o período de teste neste workspace.';
                } else if (
                    typeof errorData.message ===
                        'string' &&
                    errorData.message.trim()
                ) {
                    message =
                        errorData.message;
                }
            } else if (
                error instanceof Error &&
                error.message.trim()
            ) {
                message =
                    error.message;
            }

            setErrorMessage(
                message
            );
        } finally {
            setIsProcessing(
                false
            );
        }
    };

    /* ============================================================
       PLANO STARTER
    ============================================================ */

    const handleStarterPlan =
        async () => {
            if (!workspace?.id) {
                setErrorMessage(
                    'Workspace não encontrado.'
                );

                return;
            }

            if (
                currentPlanId ===
                'Starter'
            ) {
                return;
            }

            setIsProcessing(true);
            setErrorMessage(null);

            try {
                await updateWorkspace({
                    plan:
                        PLAN_DATABASE_MAP.Starter,

                    planBilling:
                        'monthly',
                });

                setLocalTrial({
                    used:
                        trialUsed,

                    startedAt:
                        trialStartedAt,

                    endsAt:
                        trialEndsAt,
                });

                try {
                    const notifications =
                        notificationService.getNotifications();

                    const updatedNotifications =
                        Array.isArray(
                            notifications
                        )
                            ? [
                                ...notifications,
                            ]
                            : [];

                    updatedNotifications.unshift({
                        id:
                            `notif_plan_${Date.now()}`,

                        title:
                            'Plano alterado',

                        message:
                            'O workspace foi alterado para o Plano Starter Gratuito.',

                        type: 'payment',

                        read: false,

                        createdAt:
                            new Date().toISOString(),

                        link:
                            '/plans',
                    });

                    localStorage.setItem(
                        'stalmind_app_notifications',
                        JSON.stringify(
                            updatedNotifications
                        )
                    );
                } catch {
                    /*
                     * A notificação não deve bloquear
                     * a alteração do plano.
                     */
                }
            } catch (
                error: unknown
            ) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível alterar para o Plano Starter.';

                setErrorMessage(
                    message
                );
            } finally {
                setIsProcessing(
                    false
                );
            }
        };

    /* ============================================================
       FECHAR MODAL
    ============================================================ */

    const closeTrialModal =
        () => {
            if (isProcessing) {
                return;
            }

            setIsTrialModalOpen(
                false
            );

            setSelectedPlan(
                null
            );

            setTrialResult(
                null
            );

            setTrialSuccess(
                false
            );

            setErrorMessage(
                null
            );
        };

    /* ============================================================
       FORMATAR DATA
    ============================================================ */

    const formatTrialDate =
        (
            value:
                | string
                | null
                | undefined
        ) => {
            if (!value) {
                return '—';
            }

            const date =
                new Date(value);

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return '—';
            }

            return date.toLocaleString(
                'pt-PT',
                {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                }
            );
        };

    /* ============================================================
       RENDER
    ============================================================ */

    return (
        <div className="space-y-8 pb-12 max-w-7xl mx-auto">

            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-xs">

                    <Crown className="w-3.5 h-3.5" />

                    <span>
                        Planos Comerciais & Subscrição Corporativa
                    </span>

                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Planos transparentes para cada etapa do seu negócio
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">

                    Escolha o plano ideal para o seu negócio.

                    <br />

                    <strong className="text-emerald-600 dark:text-emerald-400">
                        Pro e Enterprise têm 14 dias grátis.
                    </strong>

                    <br />

                    Não existe cobrança durante o período de teste.

                </p>

                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">

                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />

                    <span>
                        Plano do Espaço de Trabalho Atual:{' '}

                        <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Plano {currentPlanId}
                        </strong>
                    </span>

                </div>

                {trialIsActive && (
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">

                        <Clock className="w-4 h-4" />

                        <span>
                            Período de teste ativo:{' '}

                            <strong>
                                {trialDaysRemaining}{' '}

                                {trialDaysRemaining === 1
                                    ? 'dia'
                                    : 'dias'}{' '}
                                restantes
                            </strong>
                        </span>

                    </div>
                )}

                <div className="pt-4 flex items-center justify-center gap-3">

                    <button
                        type="button"
                        onClick={() =>
                            setBillingCycle(
                                'monthly'
                            )
                        }
                        className={`text-xs sm:text-sm font-semibold transition-colors ${
                            billingCycle ===
                            'monthly'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        Faturação Mensal
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setBillingCycle(
                                billingCycle ===
                                    'monthly'
                                    ? 'annually'
                                    : 'monthly'
                            )
                        }
                        aria-label="Alternar ciclo de faturação"
                        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                            billingCycle ===
                            'annually'
                                ? 'bg-indigo-600'
                                : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition duration-200 ${
                                billingCycle ===
                                'annually'
                                    ? 'translate-x-7'
                                    : 'translate-x-0'
                            }`}
                        />
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setBillingCycle(
                                'annually'
                            )
                        }
                        className={`flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-semibold ${
                            billingCycle ===
                            'annually'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                        }`}
                    >
                        <span>
                            Faturação Anual
                        </span>

                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                            Poupe até 20%
                        </span>
                    </button>

                </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">

                {PLAN_TIERS.map(
                    (plan) => {
                        const isCurrent =
                            currentPlanId ===
                            plan.id;

                        const isPopular =
                            plan.popular ===
                            true;

                        const isPaid =
                            plan.id !==
                            'Starter';

                        const trialAvailable =
                            isPaid &&
                            !trialUsed &&
                            !trialIsActive;

                        const disabled =
                            isCurrent ||
                            isProcessing ||
                            (
                                isPaid &&
                                (
                                    trialUsed ||
                                    trialIsActive
                                )
                            );

                        return (
                            <div
                                key={
                                    plan.id
                                }
                                className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${
                                    isPopular
                                        ? 'bg-gradient-to-b from-indigo-900/10 via-slate-900/90 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 dark:from-indigo-950/40 dark:to-slate-900'
                                        : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-lg'
                                }`}
                            >

                                {isPopular && (
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

                                        {isCurrent && (
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
                                                {getPlanPrice(
                                                    plan
                                                )}
                                            </span>

                                            {plan.monthlyPrice >
                                                0 && (
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                                    /mês
                                                </span>
                                            )}

                                        </div>

                                        {billingCycle ===
                                            'annually' &&
                                            plan.monthlyPrice >
                                                0 && (
                                                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                                    Faturado anualmente (€{(
                                                        plan.annualPriceMonthly *
                                                        12
                                                    ).toFixed(2)}
                                                    /ano)
                                                </p>
                                            )}

                                        {isPaid && (
                                            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">

                                                <Gift className="w-3 h-3" />

                                                14 DIAS GRÁTIS

                                            </div>
                                        )}

                                    </div>

                                    <div className="space-y-3">

                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                                            O que está incluído:
                                        </p>

                                        <ul className="space-y-2.5">

                                            {plan.features.map(
                                                (
                                                    feature,
                                                    index
                                                ) => (
                                                    <li
                                                        key={
                                                            index
                                                        }
                                                        className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300"
                                                    >

                                                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />

                                                        <span>
                                                            {
                                                                feature
                                                            }
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
                                            handleStartTrial(
                                                plan
                                            )
                                        }
                                        disabled={
                                            disabled
                                        }
                                        className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                                            disabled
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                : isPopular
                                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer'
                                                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white cursor-pointer'
                                        }`}
                                    >

                                        {isCurrent ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />

                                                Plano Atual Ativo
                                            </>
                                        ) : isPaid &&
                                            trialIsActive ? (
                                            <>
                                                <Clock className="w-4 h-4" />

                                                Teste em Andamento
                                            </>
                                        ) : isPaid &&
                                            trialUsed ? (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />

                                                Teste Já Utilizado
                                            </>
                                        ) : (
                                            <>
                                                <span>
                                                    {isPaid
                                                        ? 'Começar 14 Dias Grátis'
                                                        : plan.cta}
                                                </span>

                                                <ArrowRight className="w-4 h-4" />
                                            </>
                                        )}

                                    </button>

                                    {isPaid &&
                                        trialAvailable && (
                                            <p className="text-center text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                                                Sem cobrança agora • 14 dias grátis
                                            </p>
                                        )}

                                </div>

                            </div>
                        );
                    }
                )}

            </div>

            <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 border border-slate-800 shadow-xl">

                <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                    <div className="space-y-2 text-center md:text-left">

                        <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">

                            <Gift className="w-4 h-4" />

                            14 dias grátis

                        </div>

                        <h3 className="text-lg sm:text-xl font-bold">
                            Teste o Pro ou Enterprise sem pagar agora
                        </h3>

                        <p className="text-xs text-slate-400 max-w-2xl">
                            Escolha o plano, ative o período de teste gratuito e tenha acesso imediato às funcionalidades. Nenhum pagamento é realizado durante os 14 dias.
                        </p>

                    </div>

                    <div className="flex flex-col items-center gap-2 shrink-0">

                        <div className="px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold">
                            14 DIAS
                        </div>

                        <span className="text-[10px] text-slate-500">
                            Sem cobrança durante o trial
                        </span>

                    </div>

                </div>

            </div>

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
                            Ao escolher o Pro ou Enterprise, o plano é ativado imediatamente e você recebe 14 dias gratuitos para testar todas as funcionalidades incluídas no plano.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            Vou pagar alguma coisa agora?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Não. A ativação do período de teste não realiza nenhum pagamento.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            O que acontece depois dos 14 dias?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Quando o período terminar, você poderá continuar com o plano mediante contratação e pagamento correspondente.
                        </p>

                    </div>

                    <div className="space-y-1">

                        <h4 className="font-bold text-slate-900 dark:text-white">
                            Posso escolher Pro ou Enterprise?
                        </h4>

                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sim. Cada workspace pode utilizar uma única vez o período de teste gratuito de 14 dias para um plano pago.
                        </p>

                    </div>

                </div>

            </div>

            <Modal
                isOpen={
                    isTrialModalOpen
                }
                onClose={
                    closeTrialModal
                }
                title={
                    trialSuccess
                        ? 'Período de teste ativado'
                        : `Ativar ${selectedPlan?.name ?? 'Plano'}`
                }
            >

                {errorMessage &&
                    !trialSuccess && (
                        <div className="mb-5 p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs">

                            <div className="flex items-start gap-2">

                                <X className="w-4 h-4 shrink-0 mt-0.5" />

                                <span>
                                    {
                                        errorMessage
                                    }
                                </span>

                            </div>

                        </div>
                    )}

                {trialSuccess ? (

                    <div className="text-center py-5 space-y-5">

                        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center mx-auto">

                            <CheckCircle2 className="w-11 h-11" />

                        </div>

                        <div className="space-y-2">

                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                                14 dias grátis ativados!
                            </h3>

                            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">

                                O seu workspace agora está no plano{' '}

                                <strong className="text-indigo-600 dark:text-indigo-400">
                                    {
                                        selectedPlan?.name
                                    }
                                </strong>{' '}

                                sem qualquer cobrança.

                            </p>

                        </div>

                        <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900 text-left space-y-3">

                            <div className="flex justify-between gap-4 text-xs">

                                <span className="text-slate-500 dark:text-slate-400">
                                    Plano
                                </span>

                                <strong className="text-slate-900 dark:text-white">
                                    {
                                        selectedPlan?.name
                                    }
                                </strong>

                            </div>

                            <div className="flex justify-between gap-4 text-xs">

                                <span className="text-slate-500 dark:text-slate-400">
                                    Período
                                </span>

                                <strong className="text-emerald-600 dark:text-emerald-400">
                                    14 dias grátis
                                </strong>

                            </div>

                            <div className="flex justify-between gap-4 text-xs">

                                <span className="text-slate-500 dark:text-slate-400">
                                    Início
                                </span>

                                <strong className="text-slate-900 dark:text-white text-right">

                                    {formatTrialDate(
                                        trialResult?.trial_started_at ??
                                        trialStartedAt
                                    )}

                                </strong>

                            </div>

                            <div className="flex justify-between gap-4 text-xs pt-3 border-t border-emerald-200 dark:border-emerald-900">

                                <span className="text-slate-500 dark:text-slate-400">
                                    Termina em
                                </span>

                                <strong className="text-slate-900 dark:text-white text-right">

                                    {formatTrialDate(
                                        trialResult?.trial_ends_at ??
                                        trialEndsAt
                                    )}

                                </strong>

                            </div>

                        </div>

                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">

                            <div className="flex items-start gap-2">

                                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />

                                <span>
                                    Nenhum pagamento foi realizado. Durante os próximos 14 dias você pode utilizar o plano gratuitamente.
                                </span>

                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={
                                closeTrialModal
                            }
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                            Começar a utilizar o plano
                        </button>

                    </div>

                ) : (

                    <div className="space-y-5">

                        <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">

                            <div className="flex items-start gap-3">

                                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">

                                    <Crown className="w-5 h-5" />

                                </div>

                                <div>

                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        Plano selecionado
                                    </p>

                                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                                        {
                                            selectedPlan?.name
                                        }
                                    </h3>

                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {
                                            selectedPlan?.tagline
                                        }
                                    </p>

                                </div>

                            </div>

                        </div>

                        <div className="space-y-3">

                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">

                                <Gift className="w-5 h-5 text-emerald-500 shrink-0" />

                                <div>

                                    <strong className="block text-sm text-emerald-700 dark:text-emerald-300">
                                        14 dias totalmente grátis
                                    </strong>

                                    <span className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                                        Acesso imediato ao plano.
                                    </span>

                                </div>

                            </div>

                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">

                                <ShieldCheck className="w-5 h-5 text-indigo-500 shrink-0" />

                                <div>

                                    <strong className="block text-sm text-slate-800 dark:text-slate-200">
                                        Nenhum pagamento agora
                                    </strong>

                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        O período de teste começa imediatamente.
                                    </span>

                                </div>

                            </div>

                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">

                                <Clock className="w-5 h-5 text-indigo-500 shrink-0" />

                                <div>

                                    <strong className="block text-sm text-slate-800 dark:text-slate-200">
                                        Após os 14 dias
                                    </strong>

                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Você poderá continuar com o plano mediante pagamento.
                                    </span>

                                </div>

                            </div>

                        </div>

                        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">

                            <div className="flex justify-between items-center">

                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Valor após o trial
                                </span>

                                <strong className="text-lg font-black text-slate-900 dark:text-white">

                                    {selectedPlan &&
                                        getPlanPrice(
                                            selectedPlan
                                        )}

                                    <span className="text-xs font-normal text-slate-500">
                                        /mês
                                    </span>

                                </strong>

                            </div>

                            {billingCycle ===
                                'annually' &&
                                selectedPlan &&
                                selectedPlan.monthlyPrice >
                                    0 && (
                                    <p className="text-[10px] text-indigo-500 mt-1 text-right">

                                        Ciclo anual: €{(
                                            selectedPlan.annualPriceMonthly *
                                            12
                                        ).toFixed(2)}
                                        /ano

                                    </p>
                                )}

                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">

                            <button
                                type="button"
                                onClick={
                                    closeTrialModal
                                }
                                disabled={
                                    isProcessing
                                }
                                className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={
                                    confirmStartTrial
                                }
                                disabled={
                                    isProcessing
                                }
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                            >

                                {isProcessing ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />

                                        Ativando 14 dias grátis...
                                    </>
                                ) : (
                                    <>
                                        <Gift className="w-4 h-4" />

                                        Ativar 14 Dias Grátis
                                    </>
                                )}

                            </button>

                        </div>

                    </div>
                )}

            </Modal>

        </div>
    );
};