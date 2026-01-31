import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

export default function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqData = [
    {
      question: 'What is Vanyshr and how does it work?',
      answer:
        'Vanyshr is a comprehensive privacy protection service that automatically removes your personal information from data broker websites. We scan hundreds of data broker sites, identify your information, and submit removal requests on your behalf.',
    },
    {
      question: 'How long does it take to remove my data?',
      answer:
        'Data removal typically takes 30-90 days, depending on the data broker. We continuously monitor and follow up on removal requests to ensure your information is properly deleted.',
    },
    {
      question: 'Is my information safe with Vanyshr?',
      answer:
        'Absolutely. We use bank-level encryption and never store your sensitive personal information. Your privacy and security are our top priorities.',
    },
    {
      question: 'How often do you scan for new data?',
      answer:
        'We perform monthly scans to check for new instances of your personal information appearing on data broker sites, ensuring ongoing protection.',
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer:
        "Yes, you can cancel your subscription at any time. Your data removal requests will continue to be processed, and you'll maintain access until the end of your billing period.",
    },
    {
      question: 'Do you offer a money-back guarantee?',
      answer:
        "Yes, we offer a 30-day money-back guarantee. If you're not satisfied with our service, we'll refund your payment in full.",
    },
  ];

  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="container-max relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-brand-text mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
            Get answers to the most common questions about our privacy protection service
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-4">
          {faqData.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              viewport={{ once: true }}
              className={`border rounded-2xl transition-all duration-300 ${
                openFaq === index ? 'border-brand-accent shadow-md bg-brand-bg/30' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full px-6 md:px-8 py-5 md:py-6 text-left flex justify-between items-center gap-4 focus:outline-none"
              >
                <span className={`text-base md:text-lg font-bold transition-colors ${openFaq === index ? 'text-brand-accent' : 'text-brand-text'}`}>
                  {faq.question}
                </span>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${openFaq === index ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-300 ${
                      openFaq === index ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
              <AnimatePresence>
                {openFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 md:px-8 pb-6">
                      <p className="text-gray-600 text-base md:text-lg leading-relaxed border-t border-gray-100 pt-4">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
