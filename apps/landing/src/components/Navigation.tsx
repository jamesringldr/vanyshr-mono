import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing-section');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  const navLinks = [
    { label: 'DIY Removal', href: '#' },
    { label: 'Pricing', onClick: scrollToPricing },
    { label: 'Brokers we Target', href: '#' },
    { label: 'Manifesto', href: '#' },
  ];

  return (
    <nav className="bg-brand-text py-4 px-6 lg:px-8 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <a href="/" className="flex items-center">
            <img
              src="/assets/Logo/PrimaryLogo-DarkMode.svg"
              alt="Vanyshr Logo"
              className="h-8 md:h-10 w-auto"
            />
          </a>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={link.onClick}
              className="text-white hover:text-brand-accent transition-colors duration-200 font-medium"
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center space-x-4">
          <button className="px-6 py-2 border-2 border-white text-white font-semibold rounded-lg hover:bg-brand-accent2 hover:border-brand-accent2 transition-all duration-200">
            Sign In
          </button>
          <button className="px-6 py-2 bg-brand-accent text-white font-semibold rounded-lg hover:bg-brand-accent2 transition-all duration-200">
            Sign Up
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white hover:text-brand-accent transition-colors focus:outline-none"
          >
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-brand-text border-t border-gray-700 py-4 px-6 shadow-xl animate-fade-in">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={link.onClick}
                className="text-white hover:text-brand-accent text-left transition-colors duration-200 font-medium py-2"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-4 flex flex-col space-y-3">
              <button className="w-full px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-brand-accent2 hover:border-brand-accent2 transition-all duration-200">
                Sign In
              </button>
              <button className="w-full px-6 py-3 bg-brand-accent text-white font-bold rounded-lg hover:bg-brand-accent2 transition-all duration-200">
                Sign Up Free
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
