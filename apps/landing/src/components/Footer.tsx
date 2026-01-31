import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-text text-white py-12">
      <div className="container-max">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <div className="sm:col-span-2">
            <div className="mb-6">
              <img
                src="/assets/Logo/PrimaryLogo-DarkMode.svg"
                alt="Vanyshr Logo"
                className="h-8 md:h-10 w-auto"
              />
            </div>
            <p className="text-gray-300 mb-8 max-w-md text-base leading-relaxed">
              Protecting your privacy by removing personal information from data brokers and helping
              you regain control of your digital footprint.
            </p>
            <div className="flex space-x-6">
              <div className="w-12 h-12 bg-gray-800 hover:bg-brand-accent rounded-full flex items-center justify-center transition-colors cursor-pointer group">
                <Mail className="w-5 h-5 text-gray-400 group-hover:text-white" />
              </div>
              <div className="w-12 h-12 bg-gray-800 hover:bg-brand-accent rounded-full flex items-center justify-center transition-colors cursor-pointer group">
                <Phone className="w-5 h-5 text-gray-400 group-hover:text-white" />
              </div>
              <div className="w-12 h-12 bg-gray-800 hover:bg-brand-accent rounded-full flex items-center justify-center transition-colors cursor-pointer group">
                <MapPin className="w-5 h-5 text-gray-400 group-hover:text-white" />
              </div>
            </div>
          </div>

          <div className="mt-8 lg:mt-0">
            <h4 className="font-bold text-lg mb-6">Product</h4>
            <ul className="space-y-4 text-gray-400">
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div className="mt-8 lg:mt-0">
            <h4 className="font-bold text-lg mb-6">Company</h4>
            <ul className="space-y-4 text-gray-400">
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-brand-accent transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; 2026 Vanyshr. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
