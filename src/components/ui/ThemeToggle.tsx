import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { Theme } from '../../types';

export const ThemeToggle: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options: {
    id: Theme;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'light',
      label: 'Modo Claro',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Modo Escuro',
      icon: Moon,
    },
    {
      id: 'system',
      label: `Modo Sistema (Automático - ${
        resolvedTheme === 'dark' ? 'Escuro' : 'Claro'
      })`,
      icon: Monitor,
    },
  ];

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 sm:p-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors shrink-0 ${className}`}
      role="group"
      aria-label="Alternar Tema"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.id;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setTheme(option.id)}
            title={option.label}
            aria-label={option.label}
            aria-pressed={isActive}
            className={`p-1.5 rounded-full transition-all duration-200 select-none flex items-center justify-center ${
              isActive
                ? 'bg-indigo-600 text-white shadow-xs font-bold scale-105'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/70 dark:hover:bg-slate-800/80'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};