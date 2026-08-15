import React, { useState } from 'react';
import { AuthLayout } from '../components/layouts/AuthLayout';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  AlertCircle,
} from 'lucide-react';
import { authService } from '../services/authService';

interface ForgotPasswordPageProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigate,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSent(false);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanEmail) {
        throw new Error('Informe o e-mail da sua conta.');
      }

      console.log('[Forgot Password] Solicitando recuperação:', cleanEmail);

      await authService.resetPassword(cleanEmail);

      console.log(
        '[Forgot Password] Solicitação enviada com sucesso.'
      );

      setSent(true);
    } catch (err: any) {
      console.error(
        '[Forgot Password] Erro:',
        err
      );

      setError(
        err?.message ||
          'Não foi possível enviar o e-mail de recuperação.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar palavra-passe"
      subtitle="Introduza o seu e-mail para receber as instruções de redefinição."
      onNavigateHome={() => onNavigate('/')}
    >
      {sent ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-white">
            E-mail de recuperação enviado!
          </h3>

          <p className="text-xs text-slate-400">
            Enviámos um link seguro para{' '}
            <strong className="text-slate-200">
              {email}
            </strong>{' '}
            com as instruções para criar uma nova palavra-passe.
          </p>

          <p className="text-[11px] text-slate-500">
            Verifique também a pasta de spam ou lixo eletrónico.
          </p>

          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold mt-4 transition-all"
          >
            Voltar para o Login
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="forgot-email-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Endereço de E-mail da Conta
            </label>

            <input
              id="forgot-email-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="seu@email.com"
              disabled={loading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            id="forgot-submit-btn"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Enviar Link de Recuperação
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/login')}
            disabled={loading}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200 pt-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Login
          </button>
        </form>
      )}
    </AuthLayout>
  );
};
