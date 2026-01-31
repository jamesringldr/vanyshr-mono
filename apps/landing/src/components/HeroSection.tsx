import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function HeroSection() {
  const dataPoints = [
    'Phone Number',
    'Email',
    'Home Address',
    'Birthdate',
    'Relatives',
    'Government Records',
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % dataPoints.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [dataPoints.length]);

  return (
    <section className="section-padding bg-brand-text overflow-hidden">
      <div className="container-max">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto"
        >
          <h1 className="text-white mb-6 leading-tight">
            <div className="mb-2">It's easy to find your</div>
            <div className="h-[1.2em] md:h-[1.4em] flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentIndex}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="block font-bold"
                  style={{ color: '#FF8400' }}
                >
                  {dataPoints[currentIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="mt-2 text-3xl md:text-5xl lg:text-6xl">
              We make it <span className="text-brand-accent italic">Vanysh</span>.
            </div>
          </h1>
          <p className="text-gray-300 mb-10 max-w-2xl mx-auto text-lg md:text-xl">
            <span className="font-bold italic" style={{ color: '#FF8400' }}>
              Spammers, Scammers, and Internet Sleuths
            </span>{' '}
            use data brokers to access your exposed private data. We use AI to hunt down which
            brokers have your data, demand removal, and monitor their compliance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
            <a
              href="/quick-scan"
              className="w-full sm:w-auto bg-brand-accent hover:bg-brand-accent2 text-white font-bold py-4 px-10 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg shadow-brand-accent/20"
            >
              Start Free QuickScan
            </a>
            <p className="text-sm font-bold text-white/60 sm:hidden">No Credit Card Required</p>
          </div>
          <p className="hidden sm:block text-base font-bold text-brand-accent">No Credit Card Required</p>
          
          <p className="text-white/80 font-bold italic mt-4 text-base">
            Test us out! Your first removal is free.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
