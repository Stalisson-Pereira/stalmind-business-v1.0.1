import React from 'react';
import { Navbar } from '../components/landing/Navbar';
import { HeroSection } from '../components/landing/HeroSection';
import { BenefitsSection } from '../components/landing/BenefitsSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { AIAssistantSection } from '../components/landing/AIAssistantSection';
import { TargetAudienceSection } from '../components/landing/TargetAudienceSection';
import { FAQSection } from '../components/landing/FAQSection';
import { CTASection } from '../components/landing/CTASection';
import { FooterSection } from '../components/landing/FooterSection';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar onNavigate={onNavigate} />
      <HeroSection onNavigate={onNavigate} />
      <BenefitsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <AIAssistantSection />
      <TargetAudienceSection />
      <FAQSection />
      <CTASection onNavigate={onNavigate} />
      <FooterSection onNavigate={onNavigate} />
    </div>
  );
};
