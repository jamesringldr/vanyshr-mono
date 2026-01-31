import { motion } from 'framer-motion';
import { CheckCircle, Shield } from 'lucide-react';
import { useState } from 'react';

export default function PricingSection() {
  const [isYearly, setIsYearly] = useState(true);

  const plans = [
    {
      name: 'One Time',
      price: '$20',
      period: 'One Time',
      features: ['Scan 100+ Brokers', 'Remove Exposed Data', 'Status Reporting', 'Email Support'],
      popular: false,
    },
    {
      name: 'Family',
      price: isYearly ? '$15' : '$20',
      period: 'per month',
      features: [
        'Up to 5 family members',
        'Priority removal',
        'Priority Email Support',
        'Advanced reporting',
        'Custom alerts',
      ],
      popular: true,
    },
    {
      name: 'Basic',
      price: isYearly ? '$10' : '$15',
      period: 'per month',
      features: ['Monthly Broker Scan', 'Priority Removal', 'Advanced Reporting', 'Custom Alerts'],
      popular: false,
    },
  ];

  return (
    <section id="pricing-section" className="section-padding bg-brand-text relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(0,174,239,0.1),transparent_50%)]" />
      
      <div className="container-max relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-20"
        >
          <h2 className="text-white mb-6">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Choose the plan that fits your privacy protection needs
          </p>

          <div className="flex items-center justify-center mt-10 space-x-6">
            <span className={`text-sm md:text-base font-medium transition-colors ${!isYearly ? 'text-white' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-brand-text ${
                isYearly ? 'bg-brand-accent' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  isYearly ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm md:text-base font-medium transition-colors ${isYearly ? 'text-white' : 'text-gray-500'}`}>
              Yearly
            </span>
            {isYearly && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-brand-accent2 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
              >
                Save 25%
              </motion.span>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              viewport={{ once: true }}
              className={`relative bg-white p-8 md:p-6 lg:p-10 rounded-3xl shadow-xl flex flex-col ${
                plan.popular ? 'ring-2 ring-brand-accent2 md:scale-105 z-20' : 'border border-gray-100 z-10'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-brand-accent2 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="text-center mb-10">
                <h3 className="text-2xl font-bold text-brand-text mb-4">{plan.name}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-extrabold text-brand-text tracking-tight">{plan.price}</span>
                  <span className="text-gray-500 font-medium">/{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-brand-accent mt-0.5 mr-3 flex-shrink-0" />
                    <span className="text-gray-700 leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 ${
                  plan.popular
                    ? 'bg-brand-accent hover:bg-brand-accent/90 text-white shadow-brand-accent/20'
                    : 'bg-gray-50 hover:bg-gray-100 text-brand-text border border-gray-200'
                }`}
              >
                Get Started
              </button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-gray-400 font-medium flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-brand-accent" />
            30 Day Money Back Guarantee - No Questions Asked
          </p>
        </motion.div>
      </div>
    </section>
  );
}
