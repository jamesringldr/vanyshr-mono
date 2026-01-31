import {
  Navigation,
  HeroSection,
  AwarenessSection,
  HowItWorksSection,
  FeaturesSection,
  PricingSection,
  FAQSection,
  Footer,
} from './components';

export default function App() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <Navigation />
      <HeroSection />
      <AwarenessSection />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <Footer />
    </div>
  );
}
