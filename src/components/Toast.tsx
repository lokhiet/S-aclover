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
    success: 'bg-emerald-600 dark:bg-emerald-500',
    info: 'bg-zinc-800 dark:bg-zinc-700',
    error: 'bg-red-600 dark:bg-red-500',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg shadow-emerald-950/10 text-white font-medium pointer-events-auto ${bgColor[type]}`}
        >
          {type === 'success' ? (
            <div className="p-1 rounded-full bg-white/20">
              <Check className="w-4 h-4 text-white" />
            </div>
          ) : (
            <div className="p-1 rounded-full bg-white/20">
              <Info className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="text-sm tracking-wide">{message}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
