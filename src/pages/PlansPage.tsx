import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { notificationService } from '../services/notificationService';
import { Modal } from '../components/common/Modal';
import {
    Crown,
    Check,
    Zap,
    ShieldCheck,
    CreditCard,
    QrCode,
    Copy,
    CheckCircle2,
    Lock,
    ArrowRight,
    HelpCircle,
    Clock,
    ExternalLink,
    ChevronRight,
    Building,
    Smartphone,
    Star,
    RefreshCw,
    Gift,
} from 'lucide-react';

export interface PlanTier {
    id: 'Starter' | 'Pro' | 'Enterprise';
    name: string;
    tagline: string;
    monthlyPrice: number;
    annualPriceMonthly: number; // price per month when billed annually
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
        cta: 'Ativar Enterprise',
        color: 'violet',
    },
];

type PaymentGatewayType = 'pix' | 'paypal' | 'stripe' | 'sumup';

export const PlansPage: React.FC = () => {
    const { workspace, updateWorkspace } = useAuth();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');

    // Selected plan for checkout modal
    const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
    const [activeGateway, setActiveGateway] = useState<PaymentGatewayType>('pix');
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

    // Stripe form state
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [saveCard, setSaveCard] = useState(true);

    // PayPal form state
    const [paypalEmail, setPaypalEmail] = useState('cliente@stalmind.com');

    // SumUp form state
    const [sumupInstallments, setSumupInstallments] = useState('1');

    // Pix state
    const [pixCopied, setPixCopied] = useState(false);
    const [pixTimer, setPixTimer] = useState(899); // 15 mins in seconds

    // Processing & success states
    const [isProcessing, setIsProcessing] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);

    // Pix Countdown effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCheckoutModalOpen && activeGateway === 'pix' && pixTimer > 0) {
            interval = setInterval(() => {
                setPixTimer((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isCheckoutModalOpen, activeGateway, pixTimer]);

    const currentPlanId = workspace?.plan || 'Pro';

    const formatPixTimer = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleOpenCheckout = (plan: PlanTier) => {
        if (plan.id === currentPlanId && workspace?.planBilling === billingCycle) {
            return; // already active
        }
        if (plan.id === 'Starter') {
            // Downgrade or switch to free starter instantly
            handleCompletePlanUpgrade(plan, 'Grátis');
            return;
        }
        setSelectedPlan(plan);
        setCheckoutSuccess(false);
        setIsProcessing(false);
        setIsCheckoutModalOpen(true);
    };

    const handleCopyPixKey = () => {
        const pixKey =
            '00020126580014BR.GOV.BCB.PIX0136stalmind-planos-checkout-88392103520400005303986540549.005802BR5920Stalmind Tecnologia6009SAO PAULO62070503***6304E8A9';
        navigator.clipboard.writeText(pixKey);
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 3000);
    };

    const handleProcessPayment = async () => {
        if (!selectedPlan) return;
        setIsProcessing(true);

        // Simulate API network call
        setTimeout(async () => {
            const gatewayNames: Record<PaymentGatewayType, string> = {
                pix: 'PIX Instantâneo',
                paypal: 'PayPal Express',
                stripe: 'Stripe (Cartão de Crédito)',
                sumup: 'SumUp Pay',
            };

            await handleCompletePlanUpgrade(selectedPlan, gatewayNames[activeGateway]);
            setIsProcessing(false);
            setCheckoutSuccess(true);
        }, 1800);
    };

    const handleCompletePlanUpgrade = async (plan: PlanTier, gatewayName: string) => {
        await updateWorkspace({
            plan: plan.id,
            planBilling: billingCycle,
        });

        // Fire notification in workspace
        const isFree = plan.id === 'Starter';
        notificationService.getNotifications();
        const updatedNotifs = notificationService.getNotifications();
        updatedNotifs.unshift({
            id: `notif_${Date.now()}`,
            title: isFree ? 'Plano Alterado' : 'Subscrição Atualizada com Sucesso! 🎉',
            message: isFree
                ? 'A sua conta foi alterada para o Plano Starter Gratuito.'
                : `Ativou o ${plan.name} (${billingCycle === 'annually' ? 'Anual' : 'Mensal'}) via ${gatewayName}.`,
            type: 'payment',
            read: false,
            createdAt: new Date().toISOString(),
            link: '/plans',
        });
        localStorage.setItem('stalmind_app_notifications', JSON.stringify(updatedNotifs));
    };

    const getPlanPrice = (plan: PlanTier) => {
        const price = billingCycle === 'annually' ? plan.annualPriceMonthly : plan.monthlyPrice;
        if (price === 0) return 'Gratuito';
        return `€${price.toFixed(2)}`;
    };

    const formatCardNumber = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    };

    const formatExpiry = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) {
            return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        }
        return digits;
    };

    return (
        <div className="space-y-8 pb-12 max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="text-center space-y-4 max-w-3xl mx-auto pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-xs">
                    <Crown className="w-3.5 h-3.5" />
                    <span>Planos Comerciais & Subscrição Corporativa</span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Planos transparentes para cada etapa do seu negócio
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                    Subscreva sem fidelização. Mude de plano ou cancele quando quiser com suporte total para
                    <span className="font-bold text-slate-800 dark:text-slate-200"> PIX, PayPal, Stripe e SumUp</span>.
                </p>

                {/* Current Plan Indicator Banner */}
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                        Plano do Espaço de Trabalho Atual:{' '}
                        <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                            Plano {currentPlanId}
                        </strong>
                    </span>
                </div>

                {/* Billing Cycle Switcher */}
                <div className="pt-4 flex items-center justify-center gap-3">
                    <span
                        onClick={() => setBillingCycle('monthly')}
                        className={`text-xs sm:text-sm font-semibold cursor-pointer transition-colors ${billingCycle === 'monthly'
                                ? 'text-slate-900 dark:text-white'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Faturação Mensal
                    </span>

                    <button
                        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annually' : 'monthly')}
                        className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${billingCycle === 'annually' ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                            }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${billingCycle === 'annually' ? 'translate-x-7' : 'translate-x-0'
                                }`}
                        />
                    </button>

                    <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setBillingCycle('annually')}>
                        <span
                            className={`text-xs sm:text-sm font-semibold transition-colors ${billingCycle === 'annually'
                                    ? 'text-slate-900 dark:text-white'
                                    : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Faturação Anual
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 animate-pulse">
                            Poupe até 20%
                        </span>
                    </div>
                </div>
            </div>

            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {PLAN_TIERS.map((plan) => {
                    const isCurrent = workspace?.plan === plan.id;
                    const isPopular = plan.popular;

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 ${isPopular
                                    ? 'bg-gradient-to-b from-indigo-900/10 via-slate-900/90 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 dark:from-indigo-950/40 dark:to-slate-900'
                                    : 'bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-lg'
                                }`}
                        >
                            {/* Popular Badge */}
                            {isPopular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-current" />
                                    Mais Recomendado
                                </div>
                            )}

                            <div>
                                {/* Header */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                                    {isCurrent && (
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                            Plano Atual
                                        </span>
                                    )}
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px]">
                                    {plan.tagline}
                                </p>

                                {/* Pricing Display */}
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
                                    {billingCycle === 'annually' && plan.monthlyPrice > 0 && (
                                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                                            Faturado anualmente (€{(plan.annualPriceMonthly * 12).toFixed(2)}/ano)
                                        </p>
                                    )}
                                </div>

                                {/* Features List */}
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                                        O que está incluído:
                                    </p>
                                    <ul className="space-y-2.5">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                                                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="pt-8">
                                <button
                                    onClick={() => handleOpenCheckout(plan)}
                                    disabled={isCurrent}
                                    className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${isCurrent
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                            : isPopular
                                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/30'
                                                : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'
                                        }`}
                                >
                                    <span>{isCurrent ? 'Plano Atual Ativo' : plan.cta}</span>
                                    {!isCurrent && <ArrowRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Payment Gateways Banner */}
            <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
                <div className="space-y-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Processamento Seguro & Flexível</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold">Aceitamos os seus métodos de pagamento favoritos</h3>
                    <p className="text-xs text-slate-400 max-w-xl">
                        Ativação imediata da sua subscrição através de PIX, PayPal, Stripe ou maquininhas SumUp.
                        Segurança encriptada de ponta a ponta.
                    </p>
                </div>

                {/* Logos & Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                        <QrCode className="w-4 h-4" />
                        <span>PIX</span>
                    </div>

                    <div className="px-3.5 py-2 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-bold flex items-center gap-1.5">
                        <span className="font-extrabold italic text-blue-400">PayPal</span>
                    </div>

                    <div className="px-3.5 py-2 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-xs font-bold flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        <span>Stripe</span>
                    </div>

                    <div className="px-3.5 py-2 rounded-xl bg-sky-950/80 border border-sky-800 text-sky-300 text-xs font-bold flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4" />
                        <span>SumUp</span>
                    </div>
                </div>
            </div>

            {/* Frequently Asked Questions */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6">
                <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dúvidas Frequentes sobre os Planos</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white">Como funciona o pagamento via PIX?</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Ao selecionar o PIX, um QR Code dinâmico e uma chave "Copia e Cola" são gerados instantaneamente. Assim que efetuar o pagamento na app do seu banco, a sua conta Stalmind é atualizada automaticamente em poucos segundos.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white">Posso mudar de plano a qualquer momento?</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sim! Pode realizar o upgrade ou downgrade do seu plano quando desejar. No caso de upgrade, o novo acesso às funcionalidades de IA e gestão é libertado imediatamente.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white">É seguro pagar via Stripe, PayPal ou SumUp?</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Totalmente. Todas as transações com cartão utilizam encriptação SSL de 256 bits direta nos servidores seguros da Stripe, PayPal e SumUp. O Stalmind nunca armazena o número do seu cartão.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white">Recebo fatura/recibo com o meu NIF / CNPJ?</h4>
                        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sim! A fatura/recibo é emitida automaticamente com o NIF/CNPJ configurado no seu espaço de trabalho e enviada diretamente para o seu e-mail cadastrado.
                        </p>
                    </div>
                </div>
            </div>

            {/* CHECKOUT & PAYMENT METHOD MODAL */}
            <Modal
                isOpen={isCheckoutModalOpen}
                onClose={() => {
                    if (!isProcessing) setIsCheckoutModalOpen(false);
                }}
                title={checkoutSuccess ? 'Subscrição Concluída!' : `Checkout - ${selectedPlan?.name}`}
            >
                {checkoutSuccess ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center mx-auto animate-bounce shadow-lg">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                Pagamento Confirmado!
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                O seu espaço de trabalho foi atualizado para o{' '}
                                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    {selectedPlan?.name}
                                </strong>
                                . Já tem acesso total às funcionalidades contratadas.
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 text-left text-xs space-y-2 max-w-sm mx-auto">
                            <div className="flex justify-between text-slate-500">
                                <span>Plano:</span>
                                <strong className="text-slate-900 dark:text-white font-semibold">{selectedPlan?.name}</strong>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Ciclo:</span>
                                <strong className="text-slate-900 dark:text-white font-semibold">
                                    {billingCycle === 'annually' ? 'Anual (20% Desc.)' : 'Mensal'}
                                </strong>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Método de Pagamento:</span>
                                <strong className="text-indigo-600 dark:text-indigo-400 font-bold capitalize">
                                    {activeGateway.toUpperCase()}
                                </strong>
                            </div>
                            <div className="flex justify-between text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span>Valor Processado:</span>
                                <strong className="text-slate-900 dark:text-white font-bold">
                                    {selectedPlan && getPlanPrice(selectedPlan)}
                                </strong>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-center gap-3">
                            <button
                                onClick={() => setIsCheckoutModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                                Ir para o Dashboard
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Plan Order Summary */}
                        <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                    Resumo do Pedido
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {selectedPlan?.name} ({billingCycle === 'annually' ? 'Anual' : 'Mensal'})
                                </h4>
                            </div>

                            <div className="text-right">
                                <span className="text-lg font-black text-slate-900 dark:text-white">
                                    {selectedPlan && getPlanPrice(selectedPlan)}
                                </span>
                                <p className="text-[10px] text-slate-500">
                                    {billingCycle === 'annually' ? 'por mês (faturado 1x)' : 'por mês'}
                                </p>
                            </div>
                        </div>

                        {/* Select Gateway Navigation */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-900 dark:text-slate-200">
                                Escolha a forma de pagamento:
                            </label>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {/* PIX */}
                                <button
                                    type="button"
                                    onClick={() => setActiveGateway('pix')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${activeGateway === 'pix'
                                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <QrCode className="w-5 h-5 text-emerald-500" />
                                    <span className="text-xs">PIX</span>
                                </button>

                                {/* PAYPAL */}
                                <button
                                    type="button"
                                    onClick={() => setActiveGateway('paypal')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${activeGateway === 'paypal'
                                            ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="font-black italic text-blue-500 text-sm">PayPal</span>
                                    <span className="text-xs">PayPal</span>
                                </button>

                                {/* STRIPE */}
                                <button
                                    type="button"
                                    onClick={() => setActiveGateway('stripe')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${activeGateway === 'stripe'
                                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <CreditCard className="w-5 h-5 text-indigo-500" />
                                    <span className="text-xs">Stripe</span>
                                </button>

                                {/* SUMUP */}
                                <button
                                    type="button"
                                    onClick={() => setActiveGateway('sumup')}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${activeGateway === 'sumup'
                                            ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <Smartphone className="w-5 h-5 text-sky-500" />
                                    <span className="text-xs">SumUp</span>
                                </button>
                            </div>
                        </div>

                        {/* GATEWAY CONTENT BODY */}

                        {/* 1. PIX BODY */}
                        {activeGateway === 'pix' && (
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                        <Zap className="w-3.5 h-3.5" />
                                        Pagamento Instantâneo via QR Code
                                    </span>
                                    <span className="flex items-center gap-1 font-mono font-semibold text-slate-700 dark:text-slate-300">
                                        <Clock className="w-3.5 h-3.5" />
                                        Expira em: {formatPixTimer(pixTimer)}
                                    </span>
                                </div>

                                {/* QR CODE BOX */}
                                <div className="bg-white p-4 rounded-2xl inline-block border border-slate-200 shadow-md">
                                    <svg className="w-40 h-40 mx-auto" viewBox="0 0 100 100">
                                        <rect width="100" height="100" fill="#ffffff" />
                                        {/* Simulated Pix QR Code design */}
                                        <path
                                            d="M10 10h30v30H10zM15 15v20h20V15zM20 20h10v10H20zM60 10h30v30H60zM65 15v20h20V15zM70 20h10v10H70zM10 60h30v30H10zM15 65v20h20V65zM20 70h10v10H20zM45 10h10v10H45zM45 25h10v10H45zM45 45h10v10H45zM10 45h10v10H10zM25 45h15v5H25zM60 45h30v10H60zM45 60h10v30H45zM60 60h10v10H60zM75 60h15v10H75zM60 75h15v15H60zM80 80h10v10H80z"
                                            fill="#000000"
                                        />
                                        <circle cx="50" cy="50" r="8" fill="#10B981" />
                                    </svg>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Abra a aplicação do seu banco, escolha <strong>PIX</strong> e leia o QR Code acima ou copie a chave abaixo.
                                    </p>

                                    <div className="flex items-center gap-2 max-w-sm mx-auto">
                                        <input
                                            type="text"
                                            readOnly
                                            value="00020126580014BR.GOV.BCB.PIX0136stalmind-planos-checkout-88392103520400005303986540549"
                                            className="w-full px-3 py-2 text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 truncate"
                                        />
                                        <button
                                            onClick={handleCopyPixKey}
                                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                                        >
                                            {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{pixCopied ? 'Copiado!' : 'Copiar'}</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProcessPayment}
                                    disabled={isProcessing}
                                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                                >
                                    {isProcessing ? (
                                        <span>A verificar pagamento PIX...</span>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Simular Confirmação de Pagamento PIX</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* 2. PAYPAL BODY */}
                        {activeGateway === 'paypal' && (
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                        Checkout Seguro PayPal Express
                                    </span>
                                    <span className="text-[10px]">Proteção ao Comprador 100%</span>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Conta do PayPal (E-mail):
                                        </label>
                                        <input
                                            type="email"
                                            value={paypalEmail}
                                            onChange={(e) => setPaypalEmail(e.target.value)}
                                            placeholder="seu.email@exemplo.com"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>
                                            Será redirecionado com segurança para a janela oficial do PayPal para autorizar a subscrição recorrente.
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProcessPayment}
                                    disabled={isProcessing}
                                    className="w-full py-3 rounded-xl bg-[#0070BA] hover:bg-[#005ea6] text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isProcessing ? (
                                        <span>A ligar ao PayPal...</span>
                                    ) : (
                                        <>
                                            <span className="font-black italic text-yellow-300">PayPal</span>
                                            <span>Pagar com PayPal</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* 3. STRIPE BODY */}
                        {activeGateway === 'stripe' && (
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                        <Lock className="w-3.5 h-3.5" />
                                        Stripe 256-Bit SSL Encrypted
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-[9px] font-bold rounded">
                                            VISA
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-[9px] font-bold rounded">
                                            MC
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Nome no Cartão
                                        </label>
                                        <input
                                            type="text"
                                            value={cardName}
                                            onChange={(e) => setCardName(e.target.value)}
                                            placeholder="Alex Silva"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Número do Cartão
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                maxLength={19}
                                                value={cardNumber}
                                                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                                                placeholder="4532 •••• •••• 8821"
                                                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                                            />
                                            <CreditCard className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Validade (MM/AA)
                                            </label>
                                            <input
                                                type="text"
                                                maxLength={5}
                                                value={cardExpiry}
                                                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                                                placeholder="12/28"
                                                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                                Código CVC
                                            </label>
                                            <input
                                                type="password"
                                                maxLength={4}
                                                value={cardCvc}
                                                onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                                                placeholder="123"
                                                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                                        <input
                                            type="checkbox"
                                            checked={saveCard}
                                            onChange={(e) => setSaveCard(e.target.checked)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                                            Guardar dados com segurança na Stripe para renovação automática.
                                        </span>
                                    </label>
                                </div>

                                <button
                                    onClick={handleProcessPayment}
                                    disabled={isProcessing}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isProcessing ? (
                                        <span>A processar cartão na Stripe...</span>
                                    ) : (
                                        <>
                                            <Lock className="w-3.5 h-3.5" />
                                            <span>Confirmar Pagamento com Stripe</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* 4. SUMUP BODY */}
                        {activeGateway === 'sumup' && (
                            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                        <Smartphone className="w-3.5 h-3.5" />
                                        SumUp Pay & Terminal Reader
                                    </span>
                                    <span className="text-[10px]">Contactless / Chip / Parcelamento</span>
                                </div>

                                <div className="space-y-3 text-left">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Opções de Parcelamento (SumUp):
                                        </label>
                                        <select
                                            value={sumupInstallments}
                                            onChange={(e) => setSumupInstallments(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        >
                                            <option value="1">1x À vista (Sem juros)</option>
                                            <option value="2">2x sem juros</option>
                                            <option value="3">3x sem juros</option>
                                            <option value="6">6x com juros transparentes SumUp</option>
                                            <option value="12">12x no cartão de crédito SumUp</option>
                                        </select>
                                    </div>

                                    <div className="p-3 bg-sky-50/50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-900 text-xs text-sky-700 dark:text-sky-300 space-y-1">
                                        <p className="font-bold flex items-center gap-1">
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Pagamento via SumUp Link ou Maquininha
                                        </p>
                                        <p className="text-[11px] text-sky-600/80 dark:text-sky-400/80">
                                            Aceita cartões Visa, Mastercard, Elo, Hipercard, Amex e Google/Apple Pay por aproximação.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleProcessPayment}
                                    disabled={isProcessing}
                                    className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isProcessing ? (
                                        <span>A autorizar no SumUp Pay...</span>
                                    ) : (
                                        <>
                                            <Smartphone className="w-4 h-4" />
                                            <span>Concluir com SumUp</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};
