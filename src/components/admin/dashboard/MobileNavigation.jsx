import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import SidebarContent from './SidebarContent';

export const MobileTopbar = ({ onMenuClick, title }) => (
  <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b-2 border-pink-200 sticky top-0 z-40 shadow-sm">
    <div className="flex items-center gap-4">
      <button 
        onClick={onMenuClick}
        className="p-2 -ml-2 text-gray-500 hover:text-pink-600 transition-colors"
      >
        <Menu size={24} />
      </button>
      <h2 className="text-xl font-black tracking-tighter bg-gradient-to-r from-pink-600 to-rose-500 bg-clip-text text-transparent" style={{ textShadow: '0 0 1px rgba(219, 39, 119, 0.2)' }}>
        {title}
      </h2>
    </div>
  </header>
);

export const MobileDrawer = ({ isOpen, onClose, ...sidebarProps }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] md:hidden"
        />
        
        {/* Drawer */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 left-0 w-[280px] bg-white z-[70] md:hidden shadow-2xl overflow-hidden"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-pink-600 z-10 transition-colors"
          >
            <X size={20} />
          </button>
          
          <div className="h-full" onClick={(e) => {
            // Se clicar em um item de menu (botão), fecha o drawer
            if (e.target.closest('button')) {
              onClose();
            }
          }}>
            <SidebarContent {...sidebarProps} />
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
