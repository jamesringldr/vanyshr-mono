import { motion } from 'framer-motion';
import { Search, RotateCcw, Calendar, PieChart, Trash2, Lock } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Search,
      title: 'AI Powered Discovery',
      description: 'Scan and remove from 100+ data broker websites',
    },
    {
      icon: RotateCcw,
      title: 'Automated Process',
      description: 'Set it and forget it - we handle everything automatically',
    },
    {
      icon: Calendar,
      title: 'Ongoing Protection',
      description: 'Monthly scans ensure new data is caught and removed',
    },
    {
      icon: PieChart,
      title: 'Detailed Reports',
      description: 'Get comprehensive reports on your data removal progress',
    },
    {
      icon: Trash2,
      title: 'Fast Removal',
      description: 'Most removals completed within 30-90 days',
    },
    {
      icon: Lock,
      title: 'Secure & Private',
      description:
        'We never sell or share your data. You can remove it permanently at any time.',
    },
  ];

  return (
    <section className="section-padding bg-brand-bg/50">
      <div className="container-max">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-brand-text">
            A comprehensive solution to privacy
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 bg-brand-accent/10 rounded-xl flex items-center justify-center mb-6">
                <feature.icon className="w-7 h-7 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold text-brand-text mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed text-base">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
