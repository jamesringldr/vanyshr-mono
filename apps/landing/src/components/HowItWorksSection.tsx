import { motion } from 'framer-motion';
import { Search, Trash2, Shield } from 'lucide-react';

export default function HowItWorksSection() {
  const steps = [
    {
      icon: Search,
      title: 'Scan & Discover',
      description: 'We scan hundreds of data broker websites to find your personal information',
    },
    {
      icon: Trash2,
      title: 'Remove & Clean',
      description: 'Automatically submit removal requests to delete your data from these sites',
    },
    {
      icon: Shield,
      title: 'Monitor & Protect',
      description: 'Continuously monitor for new data and maintain your privacy protection',
    },
  ];

  return (
    <section id="how-it-works-section" className="section-padding bg-brand-text relative overflow-hidden">
      <div className="container-max relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-white mb-6">How It Works</h2>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Our three-step process makes protecting your privacy simple and effective
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="text-center group"
            >
              <div className="w-20 h-20 bg-brand-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-brand-accent/30 group-hover:bg-brand-accent transition-colors duration-300">
                <step.icon className="w-10 h-10 text-brand-accent group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-gray-400 text-lg leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center mt-20 p-8 md:p-12 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm"
        >
          <p className="text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto leading-relaxed">
            <span className="font-bold italic text-brand-accent">Start with a scan!</span> Create a free account and we will hunt down what personal information is exposed.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="btn-primary w-full sm:w-auto text-lg py-4 px-12">Scan My Data Now</button>
            <p className="text-brand-accent2 font-bold flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Free First Removal
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
