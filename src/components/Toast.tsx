import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'error';
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success:
      'bg-[#39755D] border-[#265240] text-[#FFF9EA] dark:bg-[#343D37] dark:border-[#A3BDA8] dark:text-[#E4E1D8]',
    info:
      'bg-[#264236] border-[#39755D] text-[#FFF9EA] dark:bg-[#292E2B] dark:border-[#49554D] dark:text-[#E4E1D8]',
    error:
      'bg-[#9E3543] border-[#782430] text-[#FFF9EA] dark:bg-[#292E2B] dark:border-[#9A666B] dark:text-[#E4A6AA]',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 pointer-events-none max-w-[calc(100vw-2.5rem)]">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-md border shadow-md dark:shadow-none font-medium pointer-events-auto ${bgColor[type]}`}
        >
          {type === 'success' ? (
            <div className="p-1 rounded bg-white/15 dark:bg-[#202423] flex-shrink-0">
              <Check className="w-3.5 h-3.5 text-[#FFF9EA] dark:text-[#A3BDA8]" />
            </div>
          ) : (
            <div className="p-1 rounded bg-white/15 dark:bg-[#202423] flex-shrink-0">
              <Info className="w-3.5 h-3.5 text-[#FFF9EA] dark:text-[#A3BDA8]" />
            </div>
          )}
          <span className="text-xs sm:text-sm leading-snug">{message}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
