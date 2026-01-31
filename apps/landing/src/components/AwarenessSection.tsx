import { motion } from 'framer-motion';
import { Mail, Phone, Shield, Search } from 'lucide-react';

export default function AwarenessSection() {
  const awarenessCards = [
    {
      icon: Mail,
      title: 'Reduce Hacking and Phishing Risk',
      description:
        'Hackers easily find info like your phone number or email to send fake failed login notifications to trick you into entering your real credentials that they use to take over your banking or social media accounts.',
    },
    {
      icon: Phone,
      title: 'Decrease Spam Calls and Texts',
      description:
        'Predatory lead generation companies harvest and sell data like your phone number, age and address to hundreds of companies that use it to relentlessly try and sell you unwanted products.',
    },
    {
      icon: Shield,
      title: 'Prevent Identity Theft Attempts',
      description:
        'Identity theives can use your public information like your address, date of birth and court records to open new credit cards in your name.',
    },
    {
      icon: Search,
      title: 'Minimize Your Digital Footprint',
      description:
        'Limiting the amount of personal information thats easily availabe makes it harder for malicious actors to find and exploit your data. Preventing unwanted prowlers from being able to track you.',
    },
  ];

  return (
    <section className="section-padding bg-brand-bg">
      <div className="container-max">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center md:text-left mb-12 md:mb-16"
        >
          <h2 className="text-brand-text mb-4">
            Why <span className="text-brand-accent">removing my data</span> matters?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {awarenessCards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-sm p-6 md:p-8 relative border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-accent/10 rounded-xl mb-6">
                <card.icon className="w-6 h-6 text-brand-accent" />
              </div>
              <h3 className="text-xl font-bold text-brand-text mb-4 leading-snug">{card.title}</h3>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
